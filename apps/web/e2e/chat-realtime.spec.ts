import {
  expect,
  test,
  type APIRequestContext,
  type Browser,
  type BrowserContext,
} from '@playwright/test';
import { JoinPage } from './pages/join.page';
import { RoomPage } from './pages/room.page';

// No page.reload() in this file: everything arrives over SSE.
const PREFIX = 'e2e-web-';
const API_URL = process.env['E2E_API_URL'] ?? 'http://localhost:3333';
// The api host inside the compose network (docker-compose.yml, web.API_URL).
const INTERNAL_API_HOST =
  process.env['E2E_INTERNAL_API_HOST'] ?? `api:${new URL(API_URL).port}`;
const API_HOSTS = [new URL(API_URL).host, INTERNAL_API_HOST];
const RUN = Date.now().toString(36).slice(-5);
const SESSION_COOKIE = 'chat_session';
const STREAM_PATH = '/chat/stream';

type Created = { id: string; token: string };
const created: Created[] = [];
const contexts: BrowserContext[] = [];

function nameFor(tag: string) {
  return `${PREFIX}${RUN}${tag}`;
}

async function rememberSession(context: BrowserContext) {
  const cookie = (await context.cookies()).find(
    (c) => c.name === SESSION_COOKIE,
  )!;
  const [id, token] = cookie.value.split('.') as [string, string];
  created.push({ id, token });
  return token;
}

/** Records the data of every SSE event the page's EventSource receives. */
function recordSseData() {
  const target = window as unknown as { __sseData: string[] };
  target.__sseData = [];
  const Native = window.EventSource;
  window.EventSource = class extends Native {
    constructor(url: string | URL, init?: EventSourceInit) {
      super(url, init);
      for (const type of ['message', 'presence']) {
        this.addEventListener(type, (event) =>
          target.__sseData.push((event as MessageEvent<string>).data),
        );
      }
    }
  };
}

/** Event data that carries any of the secrets (BFF-01 for the stream). */
function leaks(data: string[], secrets: string[]) {
  return data.filter((item) => secrets.some((secret) => item.includes(secret)));
}

async function leaveByApi(request: APIRequestContext, { id, token }: Created) {
  return request.post(`${API_URL}/api/v1/chat/participants/${id}/leave`, {
    headers: { 'X-Participant-Token': token },
  });
}

/** A participant in its own browser context, already in the Sala. */
async function enter(browser: Browser, tag: string) {
  const context = await browser.newContext();
  contexts.push(context);
  await context.addInitScript(recordSseData);
  const page = await context.newPage();
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  const join = new JoinPage(page);
  const room = new RoomPage(page);
  const name = nameFor(tag);
  await join.goto();
  await join.join(name);
  await room.expectLoaded();
  const token = await rememberSession(context);
  return { context, page, room, name, requests, token };
}

function streamRequests(urls: string[]) {
  return urls.filter((url) => new URL(url).pathname === STREAM_PATH);
}

test.afterAll(async ({ request }) => {
  for (const context of contexts) await context.close();
  for (const participant of created) {
    // 401 for whoever already left: nothing to do.
    await leaveByApi(request, participant);
  }
});

test('A envia e B vê sem recarregar; C entra e sai e A e B veem o contador mudar', async ({
  browser,
}) => {
  const a = await enter(browser, 'ra');
  const b = await enter(browser, 'rb');
  let reloads = 0;
  for (const page of [a.page, b.page]) page.on('load', () => reloads++);

  // B's own count comes from the server; A gets it through `presence`.
  const online = await b.room.onlineCount();
  expect(online).toBeGreaterThanOrEqual(2);
  await expect(a.room.onlineBadge).toHaveText(`${online} pessoas online`);

  // A envia: B vê a mensagem uma vez, com o nome de A; A vê a própria uma vez.
  const content = `${PREFIX}${RUN} ao vivo de A`;
  await a.room.send(content);
  const inB = b.room.bubble(content);
  await expect(inB).toHaveCount(1);
  await expect(inB).toContainText(a.name);
  await expect(inB).not.toContainText('Você');
  const inA = a.room.bubble(content);
  await expect(inA).toHaveCount(1);
  await expect(inA).toContainText('Você');
  await expect(a.room.composer).toHaveValue('');

  // C entra: o contador sobe em A e em B.
  const c = await enter(browser, 'rc');
  await expect(a.room.onlineBadge).toHaveText(`${online + 1} pessoas online`);
  await expect(b.room.onlineBadge).toHaveText(`${online + 1} pessoas online`);
  await expect(a.room.systemMessage(`${c.name} entrou no chat`)).toBeVisible();
  await expect(b.room.systemMessage(`${c.name} entrou no chat`)).toBeVisible();

  // C sai: o contador desce em A e em B.
  await c.room.leaveButton.click();
  await expect(c.page).toHaveURL(/\/$/);
  await expect(a.room.onlineBadge).toHaveText(`${online} pessoas online`);
  await expect(b.room.onlineBadge).toHaveText(`${online} pessoas online`);
  await expect(a.room.systemMessage(`${c.name} saiu do chat`)).toBeVisible();
  await expect(b.room.systemMessage(`${c.name} saiu do chat`)).toBeVisible();

  // Nobody reloaded, and each Sala kept the one stream it opened.
  expect(reloads).toBe(0);
  expect(streamRequests(a.requests)).toHaveLength(1);
  expect(streamRequests(b.requests)).toHaveLength(1);

  // BFF-01 over SSE: what B received carries no session token or api host.
  const received = await b.page.evaluate(
    () => (window as unknown as { __sseData: string[] }).__sseData,
  );
  // A's message, C's JOINED and LEFT, and the presence changes.
  expect(received.filter((item) => item.includes(content))).toHaveLength(1);
  expect(received.length).toBeGreaterThanOrEqual(5);
  const secrets = [a.token, b.token, c.token, ...API_HOSTS];
  // The check itself flags a planted token and host (discrimination).
  expect(
    leaks(
      [...received, `{"x":"${b.token}"}`, `http://${API_HOSTS[1]}/`],
      secrets,
    ),
  ).toEqual([`{"x":"${b.token}"}`, `http://${API_HOSTS[1]}/`]);
  expect(leaks(received, secrets)).toEqual([]);
});

test('20 mensagens de A: p95 entre o clique e a exibição em B < 1 s', async ({
  browser,
}) => {
  // SPEC_DEVIATION: A waits 2.1 s between sends, so the run takes ~45 s.
  // Reason: RATE-01 (F3) allows 5 messages in 10 s per participant.
  test.setTimeout(90_000);
  const a = await enter(browser, 'pa');
  const b = await enter(browser, 'pb');
  const latencies: number[] = [];

  for (let i = 1; i <= 20; i++) {
    if (i > 1) await a.page.waitForTimeout(2_100);
    const content = `${PREFIX}${RUN} p95 #${String(i).padStart(2, '0')}`;
    await a.room.composer.fill(content);
    const started = Date.now();
    await a.room.sendButton.click();
    // Polls on every animation frame, so the wait adds little to the latency.
    await b.page.waitForFunction(
      (text) =>
        [...document.querySelectorAll('[data-testid="message-content"]')].some(
          (node) => node.textContent === text,
        ),
      content,
      { polling: 'raf', timeout: 5_000 },
    );
    latencies.push(Date.now() - started);
  }

  const sorted = [...latencies].sort((x, y) => x - y);
  const p95 = sorted[Math.ceil(0.95 * sorted.length) - 1]!;
  console.log(
    `p95 A → B: ${p95} ms (20 mensagens; mín ${sorted[0]} ms, máx ${sorted.at(-1)} ms)`,
  );
  expect(p95).toBeLessThan(1_000);
});

test('B abre uma só conexão a /chat/stream e não faz nenhuma requisição em 30 s parado', async ({
  browser,
}) => {
  test.setTimeout(60_000);
  const b = await enter(browser, 'sb');
  // The quiet window starts once the stream is open.
  await expect.poll(() => streamRequests(b.requests).length).toBe(1);
  const before = b.requests.length;

  await b.page.waitForTimeout(30_000);

  expect(b.requests.slice(before)).toEqual([]);
  // B's own JOINED is on the page, so the stream starts after it (RECON-01 AC8).
  expect(streamRequests(b.requests)).toEqual([
    expect.stringMatching(/\/chat\/stream\?after=\d+$/),
  ]);
});
