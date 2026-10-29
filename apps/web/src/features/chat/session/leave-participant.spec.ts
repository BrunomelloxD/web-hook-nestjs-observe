import { http, HttpResponse } from 'msw';
import { server, TEST_API_URL } from '../../../../test/msw/server';
import { leaveParticipant } from './leave-participant';

const PARTICIPANT_ID = 'a1b2c3d4-0000-4000-8000-000000000003';
const TOKEN = 'q1W2e3R4t5Y6u7I8o9P0a_S-d1F2g3H4j5K6l7Z8x9C';

/** Records every api request (method, path, token) and answers `reply`. */
function api(reply: () => Response) {
  const calls: { method: string; path: string; token: string | null }[] = [];
  server.use(
    http.all(`${TEST_API_URL}/*`, ({ request }) => {
      calls.push({
        method: request.method,
        path: new URL(request.url).pathname,
        token: request.headers.get('X-Participant-Token'),
      });
      return reply();
    }),
  );
  return calls;
}

describe('leaveParticipant', () => {
  it.each([
    ['204', () => new HttpResponse(null, { status: 204 }), 'left'],
    ['401', () => new HttpResponse(null, { status: 401 }), 'gone'],
    ['404', () => new HttpResponse(null, { status: 404 }), 'gone'],
    ['500', () => new HttpResponse(null, { status: 500 }), 'error'],
    ['falha de rede', () => HttpResponse.error(), 'error'],
  ])(
    'api responde %s → %s, com um POST no leave do participante e o token no header',
    async (_case, reply, expected) => {
      const calls = api(reply);

      await expect(
        leaveParticipant({ id: PARTICIPANT_ID, token: TOKEN }),
      ).resolves.toBe(expected);

      expect(calls).toEqual([
        {
          method: 'POST',
          path: '/api/v1/chat/participants/a1b2c3d4-0000-4000-8000-000000000003/leave',
          token: 'q1W2e3R4t5Y6u7I8o9P0a_S-d1F2g3H4j5K6l7Z8x9C',
        },
      ]);
    },
  );
});
