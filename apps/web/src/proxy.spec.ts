import {
  getRedirectUrl,
  unstable_doesMiddlewareMatch,
} from 'next/experimental/testing/server';
import { NextRequest } from 'next/server';
import { config, proxy } from './proxy';

const BASE = 'http://localhost:3000';
const VALUE = 'a1b2c3d4-0000-4000-8000-000000000001.q1W2e3R4t5Y6u7I8o9P0a_S';

function request(pathname: string, cookie?: string) {
  return new NextRequest(`${BASE}${pathname}`, {
    headers: cookie === undefined ? {} : { cookie },
  });
}

function expectRedirect(response: Response, location: string) {
  expect(response.status).toBe(307);
  expect(response.headers.get('location')).toBe(location);
  expect(getRedirectUrl(response as never)).toBe(location);
}

function expectPassThrough(response: Response) {
  expect(response.headers.get('x-middleware-next')).toBe('1');
  expect(response.headers.get('location')).toBeNull();
}

describe('proxy', () => {
  it('/ com o cookie chat_session → 307 para /chat', () => {
    expectRedirect(
      proxy(request('/', `chat_session=${VALUE}`)),
      'http://localhost:3000/chat',
    );
  });

  it('/chat sem cookie → 307 para /', () => {
    expectRedirect(proxy(request('/chat')), 'http://localhost:3000/');
  });

  it('/ sem cookie segue', () => {
    expectPassThrough(proxy(request('/')));
  });

  it('/chat com o cookie segue (a página valida a sessão)', () => {
    expectPassThrough(proxy(request('/chat', `chat_session=${VALUE}`)));
  });

  it('só a presença conta: cookie com valor malformado em / → /chat', () => {
    expectRedirect(
      proxy(request('/', 'chat_session=lixo')),
      'http://localhost:3000/chat',
    );
  });

  it.each([
    ['vazio', 'chat_session='],
    ['nome parecido', `chat_session_old=${VALUE}`],
    ['outra caixa', `Chat_Session=${VALUE}`],
    ['outro nome', `session=${VALUE}`],
  ])('cookie %s não conta como sessão', (_case, cookie) => {
    expectRedirect(proxy(request('/chat', cookie)), 'http://localhost:3000/');
    expectPassThrough(proxy(request('/', cookie)));
  });

  it('acha o cookie entre outros', () => {
    expectRedirect(
      proxy(request('/', `theme=dark; chat_session=${VALUE}`)),
      'http://localhost:3000/chat',
    );
  });
});

describe('config.matcher', () => {
  it('é exatamente / e /chat', () => {
    expect(config.matcher).toEqual(['/', '/chat']);
  });

  it.each([
    ['/', true],
    ['/chat', true],
    ['/chat/stream', false],
    ['/chat/x', false],
    ['/chats', false],
    ['/session/end', false],
    ['/_next/static/chunk.js', false],
    ['/favicon.ico', false],
  ])('%s → roda o proxy: %s', (url, matches) => {
    expect(unstable_doesMiddlewareMatch({ config, url })).toBe(matches);
  });
});
