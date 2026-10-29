import {
  expect,
  test,
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  type Page,
  type Request,
} from '@playwright/test';
import { chatDictionary as t } from '../src/features/chat/chat.dictionary';
import { JoinPage } from './pages/join.page';
import { RoomPage } from './pages/room.page';

const PREFIX = 'e2e-web-';
const API_URL = process.env['E2E_API_URL'] ?? 'http://localhost:3333';
const RUN = Date.now().toString(36).slice(-5);
const SESSION_COOKIE = 'chat_session';
/** TYPE-02 AC8: the notice lasts 5 s after the last event. */
const TYPING_TTL_MS = 5_000;
/** HIST-01: the first page and each older page have up to 50 messages. */
const PAGE_SIZE = 50;
/** RATE-01: 5 messages per participant in 10 s (plus a margin). */
const RATE_WINDOW_MS = 10_500;
const SENDERS = 12;

type Created = { id: string; token: string };
type ApiMessage = { seq: number; type: string; content: string };
const created: Created[] = [];
const contexts: BrowserContext[] = [];

function nameFor(tag: string) {
  return `${PREFIX}${RUN}${tag}`;
}

async function joinByApi(request: APIRequestContext, name: string) {
  const response = await request.post(`${API_URL}/api/v1/chat/participants`, {
    data: { name },
  });
  expect(response.status()).toBe(201);
  const body = (await response.json()) as Created;
  created.push(body);
  return body;
}

async function leaveByApi(request: APIRequestContext, { id, token }: Created) {
  return request.post(`${API_URL}/api/v1/chat/participants/${id}/leave`, {
    headers: { 'X-Participant-Token': token },
  });
}

async function rememberSession(context: BrowserContext) {
  const cookie = (await context.cookies()).find(
    (c) => c.name === SESSION_COOKIE,
  )!;
  const [id, token] = cookie.value.split('.') as [string, string];
  created.push({ id, token });
}

/** Keeps the page's EventSources, so a test can wait for the stream to open. */
function trackEventSources() {
  const target = window as unknown as { __sources: EventSource[] };
  target.__sources = [];
  const Native = window.EventSource;
  window.EventSource = class extends Native {
    constructor(url: string | URL, init?: EventSourceInit) {
      super(url, init);
      target.__sources.push(this);
    }
  };
}

/** A participant in its own browser context, already in the Sala and listening. */
async function enter(browser: Browser, tag: string) {
  const context = await browser.newContext();
  contexts.push(context);
  await context.addInitScript(trackEventSources);
  const page = await context.newPage();
  const room = new RoomPage(page);
  const name = nameFor(tag);
  const join = new JoinPage(page);
  await join.goto();
  await join.join(name);
  await room.expectLoaded();
  await rememberSession(context);
  await page.waitForFunction(() =>
    (window as unknown as { __sources: EventSource[] }).__sources.some(
      (source) => source.readyState === EventSource.OPEN,
    ),
  );
  return { context, page, room, name };
}

function recordRequests(page: Page) {
  const requests: Request[] = [];
  page.on('request', (request) => requests.push(request));
  return requests;
}

/** Every message in the room, in ascending seq, read from the api. */
async function allMessages(request: APIRequestContext) {
  let messages: ApiMessage[] = [];
  // Pages go backwards from the latest, by the `before` cursor.
  for (let before: number | undefined; ;) {
    const response = await request.get(`${API_URL}/api/v1/chat/messages`, {
      params: before === undefined ? { limit: 100 } : { before, limit: 100 },
    });
    expect(response.status()).toBe(200);
    const { items } = (await response.json()) as { items: ApiMessage[] };
    messages = [...items, ...messages];
    if (items.length < 100) return messages;
    before = items[0]!.seq;
  }
}

test.afterAll(async ({ request }) => {
  for (const context of contexts) await context.close();
  for (const participant of created) await leaveByApi(request, participant);
});

test('A digita sem enviar: B vê "A está digitando…" em menos de 1 s e o aviso some 5 s depois; nenhuma requisição periódica (TYPE-01, TYPE-02)', async ({
  browser,
}) => {
  test.setTimeout(60_000);
  const a = await enter(browser, 'ta');
  const b = await enter(browser, 'tb');
  const notice = b.page.getByText(t.typing([a.name]), { exact: true });
  const aRequests = recordRequests(a.page);
  const bRequests = recordRequests(b.page);

  const firstKey = Date.now();
  await a.room.composer.pressSequentially('o');

  await expect(notice).toBeVisible({ timeout: 1_000 });
  expect(Date.now() - firstKey).toBeLessThan(1_000);

  // A stopped after one key: the notice goes away 5 s after the event.
  await expect(notice).toBeHidden({ timeout: TYPING_TTL_MS + 1_500 });
  const goneAfter = Date.now() - firstKey;
  expect(goneAfter).toBeGreaterThanOrEqual(TYPING_TTL_MS - 500);
  expect(goneAfter).toBeLessThanOrEqual(TYPING_TTL_MS + 1_500);
  await expect(a.room.composer).toHaveValue('o');

  // The keystroke made one Server Action call; nothing else ran while A was idle.
  await a.page.waitForTimeout(2_000);
  expect(
    aRequests.map((request) => [
      request.method(),
      Boolean(request.headers()['next-action']),
    ]),
  ).toEqual([['POST', true]]);
  expect(bRequests.map((request) => request.url())).toEqual([]);
});

test('120 mensagens criadas pela api: B clica "Carregar mensagens anteriores" floor(total / 50) vezes até o botão sumir e vê todas em ordem de seq, sem duplicata (HIST-01)', async ({
  browser,
  request,
}) => {
  // SPEC_DEVIATION: 12 participants × 10 messages in two rounds, not 120 from one.
  // Reason: RATE-01 allows 5 messages in 10 s per participant. Fewer senders
  // mean fewer JOINED messages: with the room cleaned by the global setup it
  // stays under 150 messages, so B clicks twice, as in the Independent Test.
  test.setTimeout(60_000);
  const sent = Array.from(
    { length: 120 },
    (_, i) => `${PREFIX}${RUN} hist ${String(i + 1).padStart(3, '0')}`,
  );
  const senders: { token: string; lastSentAt: number }[] = [];
  for (let sender = 0; sender < SENDERS; sender++) {
    const { token } = await joinByApi(request, nameFor(`h${sender}`));
    senders.push({ token, lastSentAt: 0 });
  }
  for (let round = 0; round < 2; round++) {
    for (const [index, sender] of senders.entries()) {
      // The second round waits for the sender's 10 s window to pass.
      const wait = sender.lastSentAt + RATE_WINDOW_MS - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      const first = round * SENDERS * 5 + index * 5;
      for (const content of sent.slice(first, first + 5)) {
        const response = await request.post(`${API_URL}/api/v1/chat/messages`, {
          headers: { 'X-Participant-Token': sender.token },
          data: { content },
        });
        expect(response.status()).toBe(201);
      }
      sender.lastSentAt = Date.now();
    }
  }
  const b = await enter(browser, 'hb');
  const load = b.page.getByRole('button', { name: t.room.loadOlder });
  const loading = b.page.getByRole('button', { name: t.room.loadingOlder });
  await expect(load).toBeVisible();

  let clicks = 0;
  while (await load.isVisible()) {
    await load.click();
    clicks++;
    await expect(loading).toHaveCount(0, { timeout: 15_000 });
    // Next's route announcer is also an alert: look for the error text.
    await expect(b.page.getByText(t.errors.loadOlderFailed)).toHaveCount(0);
  }

  const shown = await b.room.messages
    .getByTestId('message-content')
    .allTextContents();
  // Each of the 120 once, in the order they were created.
  expect(shown.filter((content) => sent.includes(content))).toEqual(sent);
  // The whole room, in ascending seq and without duplicates, as the api has it.
  const room = await allMessages(request);
  expect(shown).toEqual(
    room
      .filter((message) => message.type === 'USER')
      .map((message) => message.content),
  );
  // 50 come with the page; each click brings 50 more until a page has fewer
  // (one with 0 when the total is a multiple of 50).
  console.log(`${clicks} cliques (sala com ${room.length} mensagens)`);
  expect(clicks).toBe(Math.floor(room.length / PAGE_SIZE));
  // The global setup keeps the room small: two clicks, as in the Independent Test.
  expect(clicks).toBe(2);
});
