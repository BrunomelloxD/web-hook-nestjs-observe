import 'server-only';
import { getApi } from '@/lib/api';
import type { OnlineParticipants } from '../chat.types';

export async function getOnline(): Promise<OnlineParticipants> {
  const { data } = await getApi().GET('/api/v1/chat/participants/online');

  if (!data) {
    throw new Error('Falha ao carregar os participantes online');
  }

  return data;
}
