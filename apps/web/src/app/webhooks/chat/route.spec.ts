import { handleChatWebhook } from '@/features/chat';
import { POST } from './route';

vi.mock('@/features/chat', () => ({
  handleChatWebhook: vi.fn(async () => new Response(null, { status: 204 })),
}));

describe('POST /webhooks/chat', () => {
  it('delega a handleChatWebhook com a requisição', async () => {
    const request = new Request('http://web.test/webhooks/chat', {
      method: 'POST',
      body: '{}',
    });

    const response = await POST(request);

    expect(handleChatWebhook).toHaveBeenCalledWith(request);
    expect(response.status).toBe(204);
  });
});
