import { endInvalidSession } from '@/features/chat';
import { GET } from './route';

vi.mock('@/features/chat', () => ({
  // Like the real one: clears the cookie and redirect() throws.
  endInvalidSession: vi.fn(async () => {
    throw new Error('NEXT_REDIRECT');
  }),
}));

describe('GET /session/end', () => {
  it('delega a endInvalidSession', async () => {
    await expect(GET()).rejects.toThrow('NEXT_REDIRECT');

    expect(endInvalidSession).toHaveBeenCalledOnce();
  });
});
