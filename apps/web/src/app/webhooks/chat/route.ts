import { handleChatWebhook } from '@/features/chat';

export const POST = (request: Request) => handleChatWebhook(request);
