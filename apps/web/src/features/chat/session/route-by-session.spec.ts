import { routeBySession } from './route-by-session';

describe('routeBySession', () => {
  it('/ com cookie → /chat', () => {
    expect(routeBySession('/', true)).toBe('/chat');
  });

  it('/chat sem cookie → /', () => {
    expect(routeBySession('/chat', false)).toBe('/');
  });

  it('/ sem cookie segue (null)', () => {
    expect(routeBySession('/', false)).toBeNull();
  });

  it('/chat com cookie segue (null)', () => {
    expect(routeBySession('/chat', true)).toBeNull();
  });

  it.each([
    ['/chat/stream', false],
    ['/chat/stream', true],
    ['/chat/', false],
    ['/chats', false],
    ['/chatx', false],
    ['/session/end', true],
    ['/session/end', false],
    ['//', true],
    ['', true],
  ])('caminho parecido %j (cookie %s) segue (null)', (pathname, hasCookie) => {
    expect(routeBySession(pathname, hasCookie)).toBeNull();
  });
});
