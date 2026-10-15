import 'server-only';
import { getApi } from '@/lib/api';
import type { ChatMessage } from '../chat.types';

type GetMessagesParams = { limit?: number; before?: number; after?: number };

/** Always in ascending `seq` order (the api sorts). */
export async function getMessages(
  params: GetMessagesParams,
): Promise<ChatMessage[]> {
  const { data } = await getApi().GET('/api/v1/chat/messages', {
    params: { query: params },
  });

  if (!data) {
    throw new Error('Falha ao carregar as mensagens');
  }

  return data.items;
}
