import { openChatStream } from '@/features/chat';
import { GET } from './route';

vi.mock('@/features/chat', () => ({
  openChatStream: vi.fn(async () => new Response(null, { status: 401 })),
}));

describe('GET /chat/stream', () => {
  it('delega a openChatStream com a requisição', async () => {
    const request = new Request('http://web.test/chat/stream');

    const response = await GET(request);

    expect(openChatStream).toHaveBeenCalledWith(request);
    expect(response.status).toBe(401);
  });
});
