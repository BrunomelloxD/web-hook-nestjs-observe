import {
  expect,
  test,
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  type Page,
} from '@playwright/test';
import { connect, createServer, type AddressInfo, type Socket } from 'node:net';
import { chatDictionary as t } from '../src/features/chat/chat.dictionary';
import { JoinPage } from './pages/join.page';
import { RoomPage } from './pages/room.page';

// No page.reload() except in the F5 test: everything arrives over SSE.
const PREFIX = 'e2e-web-';
const API_URL = process.env['E2E_API_URL'] ?? 'http://localhost:3333';
const BASE_URL = process.env['E2E_BASE_URL'] ?? 'http://localhost:3000';
const RUN = Date.now().toString(36).slice(-5);
const SESSION_COOKIE = 'chat_session';
/** The web's away delay (AWAY-01) plus the 1 s tolerance of the spec. */
const AWAY_MS = 31_000;

type Created = { id: string; token: string };
const created: Created[] = [];
const contexts: BrowserContext[] = [];

function nameFor(tag: string) {
  return `${PREFIX}${RUN}${tag}`;
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

/**
 * TCP proxy to the web that can drop the network for real. Chromium's
 * setOffline only fails new requests: an open EventSource stays connected.
 */
async function networkProxy(target: URL) {
  const sockets = new Set<Socket>();
  let online = true;
  const server = createServer((client) => {
    if (!online) return client.destroy();
    const upstream = connect(Number(target.port), target.hostname);
    for (const socket of [client, upstream]) {
      sockets.add(socket);
      socket.on('error', () => socket.destroy());
      socket.on('close', () => {
        sockets.delete(socket);
        client.destroy();
        upstream.destroy();
      });
    }
    client.pipe(upstream).pipe(client);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://localhost:${port}`,
    drop() {
      online = false;
      for (const socket of sockets) socket.destroy();
    },
    restore() {
      online = true;
    },
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

/** A participant in its own browser context, already in the Sala. */
async function enter(browser: Browser, tag: string, baseURL = BASE_URL) {
  const context = await browser.newContext({ baseURL });
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
  // Hydrated and listening: the server HTML alone has no stream.
  await page.waitForFunction(() =>
    (window as unknown as { __sources: EventSource[] }).__sources.some(
      (source) => source.readyState === EventSource.OPEN,
    ),
  );
  return { context, page, room, name };
}

/** How many times each text shows in the page's message list. */
async function countsOf(page: Page, texts: string[]) {
  return page.evaluate((wanted) => {
    const shown = [
      ...document.querySelectorAll('[data-testid="message-content"]'),
    ].map((node) => node.textContent);
    return wanted.map((text) => shown.filter((item) => item === text).length);
  }, texts);
}

test.afterAll(async ({ request }) => {
  for (const context of contexts) await context.close();
  for (const participant of created) {
    // 401 for whoever already left (by the button or the away timeout).
    await leaveByApi(request, participant);
  }
});

test('B fica offline, A envia 3 mensagens, B volta e vê as 3 em ordem sem recarregar (RECON-01, RECON-02)', async ({
  browser,
}) => {
  test.setTimeout(60_000);
  const proxy = await networkProxy(new URL(BASE_URL));
  try {
    const a = await enter(browser, 'xa');
    const b = await enter(browser, 'xb', proxy.url);
    let reloads = 0;
    b.page.on('load', () => reloads++);
    const sent = [1, 2, 3].map((i) => `${PREFIX}${RUN} offline #${i}`);
    // B gets no message over SSE before the drop, so the browser has no
    // Last-Event-ID: recovery starts from the seq the page rendered.

    // SPEC_DEVIATION: the proxy also cuts the open stream.
    // Reason: Chromium's setOffline leaves an open EventSource connected.
    await b.context.setOffline(true);
    proxy.drop();
    // Only send once B's EventSource has noticed the drop (design risk).
    await expect(b.page.getByText(t.errors.reconnecting)).toBeVisible();
    for (const content of sent) {
      await a.room.send(content);
      await expect(a.room.bubble(content)).toHaveCount(1);
      await expect(a.page.getByText(t.message.sending)).toHaveCount(0);
    }
    await expect.poll(() => countsOf(b.page, sent)).toEqual([0, 0, 0]);
    proxy.restore();
    await b.context.setOffline(false);

    await expect(b.page.getByText(t.errors.reconnecting)).toBeHidden({
      timeout: 15_000,
    });
    await expect.poll(() => countsOf(b.page, sent)).toEqual([1, 1, 1]);
    const contents = await b.room.messages
      .getByTestId('message-content')
      .allTextContents();
    expect(contents.filter((text) => sent.includes(text))).toEqual(sent);
    expect(reloads).toBe(0);

    // Leaving now cancels B's away timeout, which would fire mid next test.
    await b.room.leaveButton.click();
    await expect(b.page).toHaveURL(/\/$/);
  } finally {
    // close() waits for open connections: B's stream would hold it forever.
    proxy.drop();
    await proxy.close();
  }
});

test('B fecha a aba: A vê "B saiu do chat" e o contador cair em até 31 s (AWAY-01)', async ({
  browser,
}) => {
  test.setTimeout(45_000);
  const a = await enter(browser, 'ya');
  const b = await enter(browser, 'yb');
  const online = await b.room.onlineCount();
  await expect(a.room.onlineBadge).toHaveText(t.online(online));

  const closedAt = Date.now();
  await b.page.close();

  await expect(a.room.systemMessage(t.system.left(b.name))).toBeVisible({
    timeout: AWAY_MS,
  });
  await expect(a.room.onlineBadge).toHaveText(t.online(online - 1), {
    timeout: Math.max(0, AWAY_MS - (Date.now() - closedAt)),
  });
  expect(Date.now() - closedAt).toBeLessThanOrEqual(AWAY_MS);
});

test('B dá F5: depois de mais de 30 s, ninguém vê "B saiu do chat" (AWAY-01 AC2)', async ({
  browser,
}) => {
  test.setTimeout(60_000);
  const a = await enter(browser, 'za');
  const b = await enter(browser, 'zb');
  const online = await b.room.onlineCount();

  await b.page.reload();
  await b.room.expectLoaded();
  await a.page.waitForTimeout(AWAY_MS + 1_000);

  await expect(a.room.systemMessage(t.system.left(b.name))).toHaveCount(0);
  await expect(b.room.systemMessage(t.system.left(b.name))).toHaveCount(0);
  await expect(a.room.onlineBadge).toHaveText(t.online(online));
});

test('100 envios com o SSE ativo (20 participantes × 5) não duplicam nenhuma mensagem (OPT-01)', async ({
  browser,
}) => {
  // SPEC_DEVIATION: 20 participants × 5 messages, not 100 from one.
  // Reason: RATE-01 allows 5 messages in 10 s per participant.
  test.setTimeout(120_000);
  const senders = [];
  for (let i = 0; i < 20; i++) senders.push(await enter(browser, `o${i}`));
  const contentsOf = (i: number) =>
    [1, 2, 3, 4, 5].map((n) => `${PREFIX}${RUN} dup ${i}.${n}`);
  const all = senders.flatMap((_, i) => contentsOf(i));

  await Promise.all(
    senders.map(async (sender, i) => {
      for (const content of contentsOf(i)) await sender.room.send(content);
    }),
  );

  for (const sender of senders) {
    await expect
      .poll(() => countsOf(sender.page, all), { timeout: 30_000 })
      .toEqual(all.map(() => 1));
    await expect(sender.page.getByText(t.message.sending)).toHaveCount(0);
    await expect(sender.page.getByText(t.message.failed)).toHaveCount(0);
  }
});
