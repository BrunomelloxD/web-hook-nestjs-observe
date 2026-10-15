import { openChatStream } from '@/features/chat';

export const GET = (request: Request) => openChatStream(request);
