import { http, HttpResponse } from 'msw';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { server } from '../../../../test/msw/server';
import { endInvalidSession } from './end-invalid-session';

vi.mock('next/headers', () => ({ cookies: vi.fn() }));
// Like Next, redirect() throws: anything after it never runs.
vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
}));

describe('endInvalidSession', () => {
  it('apaga o cookie chat_session, redireciona para / e não chama a api', async () => {
    const jar = new Map([
      ['chat_session', 'a1b2c3d4-0000-4000-8000-000000000001.tok'],
      ['theme', 'dark'],
    ]);
    vi.mocked(cookies).mockResolvedValue({
      delete: (name: string) => jar.delete(name),
    } as unknown as Awaited<ReturnType<typeof cookies>>);
    const calls: string[] = [];
    server.use(
      http.all('*', ({ request }) => {
        calls.push(request.url);
        return HttpResponse.json({});
      }),
    );

    await expect(endInvalidSession()).rejects.toThrow('NEXT_REDIRECT');

    expect([...jar.keys()]).toEqual(['theme']);
    expect(redirect).toHaveBeenCalledExactlyOnceWith('/');
    expect(calls).toEqual([]);
  });
});
