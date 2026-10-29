import {
  expect,
  test,
  type APIRequestContext,
  type BrowserContext,
  type Locator,
  type Page,
} from '@playwright/test';
import { chatDictionary as t } from '../src/features/chat/chat.dictionary';
import { JoinPage } from './pages/join.page';
import { RoomPage } from './pages/room.page';

// Participants created here leave in afterAll. The api has no delete for
// messages (D2), so the messages stay; they carry the prefix.
const PREFIX = 'e2e-web-';
const API_URL = process.env['E2E_API_URL'] ?? 'http://localhost:3333';
// The api host inside the compose network (docker-compose.yml, web.API_URL).
const INTERNAL_API_HOST =
  process.env['E2E_INTERNAL_API_HOST'] ?? `api:${new URL(API_URL).port}`;
const RUN = Date.now().toString(36).slice(-5);
const SESSION_COOKIE = 'chat_session';

type Created = { id: string; token: string };
const created: Created[] = [];

/** Name with up to 20 characters, unique per run. */
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

async function sessionOf(context: BrowserContext) {
  const cookies = await context.cookies();
  return cookies.find((cookie) => cookie.name === SESSION_COOKIE);
}

/** Keeps the session so afterAll can leave even if the test fails midway. */
async function rememberSession(context: BrowserContext) {
  const value = (await sessionOf(context))!.value;
  const [id, token] = value.split('.') as [string, string];
  created.push({ id, token });
}

async function withSessionCookie(
  context: BrowserContext,
  baseURL: string,
  { id, token }: Created,
) {
  await context.addCookies([
    { name: SESSION_COOKIE, value: `${id}.${token}`, url: baseURL },
  ]);
}

/** Center of the bubble's text relative to the page's middle. */
async function side(page: Page, bubble: Locator): Promise<'left' | 'right'> {
  const box = (await bubble.getByTestId('message-content').boundingBox())!;
  const width = page.viewportSize()!.width;
  return box.x + box.width / 2 > width / 2 ? 'right' : 'left';
}

test.afterAll(async ({ request }) => {
  for (const participant of created) {
    // 401 for whoever already left: nothing to do.
    await leaveByApi(request, participant);
  }
});

test('A e B conversam recarregando; B sai, A vê a saída e B entra de novo', async ({
  browser,
  baseURL,
}) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const requests: string[] = [];
  for (const context of [contextA, contextB]) {
    context.on('request', (request) => requests.push(request.url()));
  }
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();
  const joinA = new JoinPage(pageA);
  const joinB = new JoinPage(pageB);
  const roomA = new RoomPage(pageA);
  const roomB = new RoomPage(pageB);
  const nameA = nameFor('a');
  const nameB = nameFor('b');
  const content = `${PREFIX}${RUN} olá de A`;

  // A entra.
  await joinA.goto();
  await joinA.join(nameA);
  await roomA.expectLoaded();
  await rememberSession(contextA);
  await expect(roomA.systemMessage(t.system.joined(nameA))).toBeVisible();

  // B tenta o nome de A em outra caixa.
  await joinB.goto();
  await joinB.join(nameA.toUpperCase());
  await expect(
    joinB.fieldError('Esse nome já está em uso na sala.'),
  ).toBeVisible();
  await expect(joinB.nameInput).toHaveAttribute('aria-invalid', 'true');
  await expect(pageB).toHaveURL(`${baseURL}/`);

  // B entra com outro nome.
  await joinB.join(nameB);
  await roomB.expectLoaded();
  await rememberSession(contextB);

  // A envia: a mensagem aparece no fim, à direita, como "Você"; o campo limpa.
  await roomA.send(content);
  const ownBubble = roomA.bubble(content);
  await expect(ownBubble).toBeVisible();
  await expect(roomA.messages.getByRole('listitem').last()).toContainText(
    content,
  );
  await expect(ownBubble).toContainText(t.room.you);
  // The optimistic bubble (F3) is replaced once confirmed: measure the final one.
  await expect(ownBubble).not.toContainText(t.message.sending);
  expect(await side(pageA, ownBubble)).toBe('right');
  await expect(roomA.composer).toHaveValue('');

  // Depois de recarregar, B vê a mensagem no HTML: à esquerda, com o nome de A.
  await pageB.reload();
  const otherBubble = roomB.bubble(content);
  await expect(otherBubble).toBeVisible();
  await expect(otherBubble).toContainText(nameA);
  await expect(otherBubble).not.toContainText(t.room.you);
  expect(await side(pageB, otherBubble)).toBe('left');

  // B sai: volta para / sem o cookie.
  await pageA.reload();
  await roomA.expectLoaded();
  const before = await roomA.onlineCount();
  await roomB.leaveButton.click();
  await expect(pageB).toHaveURL(`${baseURL}/`);
  await expect(joinB.heading).toBeVisible();
  expect(await sessionOf(contextB)).toBeUndefined();

  // A recarrega: vê a saída e o contador com um a menos.
  await pageA.reload();
  await expect(roomA.systemMessage(`${nameB} saiu do chat`)).toBeVisible();
  expect(await roomA.onlineCount()).toBe(before - 1);

  // O nome de B ficou livre.
  await joinB.join(nameB);
  await roomB.expectLoaded();
  await rememberSession(contextB);

  // BFF-01: o navegador só falou com o Next.
  const api = new URL(API_URL);
  expect(requests.length).toBeGreaterThan(0);
  expect(requests.filter((url) => new URL(url).host === api.host)).toEqual([]);
  expect(
    requests.filter((url) => new URL(url).origin !== new URL(baseURL!).origin),
  ).toEqual([]);

  await contextA.close();
  await contextB.close();
});

test('/chat sem sessão → 307 para / e mostra a tela Entrar', async ({
  page,
  baseURL,
}) => {
  const response = await page.request.get('/chat', { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  // Next sends same-origin redirects as a relative Location.
  expect(response.headers()['location']).toBe('/');

  await page.goto('/chat');

  await expect(page).toHaveURL(`${baseURL}/`);
  await expect(new JoinPage(page).heading).toBeVisible();
});

test('/ com sessão → 307 para /chat e mostra a Sala', async ({
  page,
  context,
  request,
  baseURL,
}) => {
  const participant = await joinByApi(request, nameFor('c'));
  await withSessionCookie(context, baseURL!, participant);

  const response = await page.request.get('/', { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(response.headers()['location']).toBe('/chat');

  await page.goto('/');

  await new RoomPage(page).expectLoaded();
});

test('cookie de quem saiu → /session/end → / sem o cookie', async ({
  page,
  context,
  request,
  baseURL,
}) => {
  const participant = await joinByApi(request, nameFor('d'));
  expect((await leaveByApi(request, participant)).status()).toBe(204);
  await withSessionCookie(context, baseURL!, participant);
  const visited: string[] = [];
  page.on('request', (r) => visited.push(new URL(r.url()).pathname));

  await page.goto('/chat');

  await expect(page).toHaveURL(`${baseURL}/`);
  await expect(new JoinPage(page).heading).toBeVisible();
  expect(visited).toContain('/session/end');
  expect(await sessionOf(context)).toBeUndefined();
});

test('GET /session/end apaga o cookie chat_session e responde 307 para /', async ({
  page,
  context,
  request,
  baseURL,
}) => {
  const participant = await joinByApi(request, nameFor('e'));
  await withSessionCookie(context, baseURL!, participant);

  const response = await page.request.get('/session/end', {
    maxRedirects: 0,
  });

  expect(response.status()).toBe(307);
  expect(response.headers()['location']).toBe('/');
  const setCookie = response
    .headersArray()
    .filter((h) => h.name.toLowerCase() === 'set-cookie')
    .map((h) => h.value);
  expect(setCookie).toHaveLength(1);
  expect(setCookie[0]).toMatch(/^chat_session=;/);
  expect(setCookie[0]).toContain('Path=/');
  expect(setCookie[0]).toContain('Expires=Thu, 01 Jan 1970 00:00:00 GMT');
  expect(await sessionOf(context)).toBeUndefined();
});

test('com 60 mensagens, o HTML do servidor de /chat traz as 50 últimas em ordem', async ({
  request,
}) => {
  // SPEC_DEVIATION: 12 participants × 5, not 60 from one participant.
  // Reason: RATE-01 (F3) refuses a 6th message within 10 s.
  const senders: Created[] = [];
  for (let i = 0; i < 12; i++) {
    senders.push(await joinByApi(request, nameFor(`f${i}`)));
  }
  const participant = senders[0]!;
  const sent = Array.from(
    { length: 60 },
    (_, i) => `${PREFIX}${RUN}-m${String(i + 1).padStart(2, '0')}`,
  );
  for (const [i, content] of sent.entries()) {
    const response = await request.post(`${API_URL}/api/v1/chat/messages`, {
      headers: { 'X-Participant-Token': senders[Math.floor(i / 5)]!.token },
      data: { content },
    });
    expect(response.status()).toBe(201);
  }

  const response = await request.get('/chat', {
    headers: {
      cookie: `${SESSION_COOKIE}=${participant.id}.${participant.token}`,
    },
    maxRedirects: 0,
  });
  expect(response.status()).toBe(200);
  const html = await response.text();

  // Only the rendered HTML has this attribute (not the RSC payload).
  const contents = [
    ...html.matchAll(/data-testid="message-content"[^>]*>([^<]*)</g),
  ].map((match) => match[1]);
  expect(contents).toEqual(sent.slice(10));
});

test('BFF-01: nada que /chat manda ao navegador traz o token ou a URL da api', async ({
  page,
  context,
}) => {
  // Every body the browser receives: documents, scripts, Server Action
  // responses and RSC payloads (the join action and the reload included).
  const bodies: Promise<string>[] = [];
  page.on('response', (response) => {
    // The SSE body never ends, so text() would hang; chat-realtime.spec.ts
    // checks the events the page receives instead.
    if (response.headers()['content-type']?.includes('text/event-stream')) {
      return;
    }
    bodies.push(
      response.text().catch(() => ''), // redirects have no body
    );
  });
  const join = new JoinPage(page);
  const room = new RoomPage(page);
  await join.goto();
  await join.join(nameFor('g'));
  await room.expectLoaded();
  await rememberSession(context);
  await page.reload();
  await room.expectLoaded();

  // Cookie format: "<participantId>.<token>" (the token has no ".").
  const [, token] = (await sessionOf(context))!.value.split('.') as [
    string,
    string,
  ];
  expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);

  // The same request, read directly: the HTML document and the RSC payload.
  const html = await context.request.get('/chat', { maxRedirects: 0 });
  expect(html.status()).toBe(200);
  expect(html.headers()['content-type']).toContain('text/html');
  const rsc = await context.request.get('/chat', { headers: { RSC: '1' } });
  expect(rsc.status()).toBe(200);
  expect(rsc.headers()['content-type']).toContain('text/x-component');

  const received = [
    await html.text(),
    await rsc.text(),
    ...(await Promise.all(bodies)),
  ];
  // The api as the host sees it (apps/web/.env) and as the web container
  // sees it (docker-compose.yml: http://api:<API_PORT>).
  const apiHosts = [new URL(API_URL).host, INTERNAL_API_HOST];
  expect(received.join('').length).toBeGreaterThan(0);
  for (const body of received) {
    expect(body.includes(token), 'token sent to the browser').toBe(false);
    for (const host of apiHosts) {
      expect(body.includes(host), `${host} sent to the browser`).toBe(false);
    }
  }
});

test('o tema escolhido no ThemeToggle continua depois de recarregar', async ({
  page,
  context,
}) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await new JoinPage(page).goto();
  const html = page.locator('html');
  await expect(html).not.toHaveAttribute('data-theme');

  await page.getByRole('button', { name: t.theme.toDark }).click();
  await expect(html).toHaveAttribute('data-theme', 'dark');

  await page.reload();

  await expect(html).toHaveAttribute('data-theme', 'dark');
  await expect(
    page.getByRole('button', { name: t.theme.toLight }),
  ).toBeVisible();
  const theme = (await context.cookies()).find((c) => c.name === 'theme');
  expect(theme?.value).toBe('dark');
});
