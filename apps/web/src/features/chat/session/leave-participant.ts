import 'server-only';
import { getApi } from '@/lib/api';

export type LeaveResult = 'left' | 'gone' | 'error';

/** POST /participants/:id/leave, shared by the "Sair" action and the away timeout (AWAY-01). */
export async function leaveParticipant(participant: {
  id: string;
  token: string;
}): Promise<LeaveResult> {
  try {
    const { response } = await getApi().POST(
      '/api/v1/chat/participants/{id}/leave',
      {
        params: {
          path: { id: participant.id },
          header: { 'X-Participant-Token': participant.token },
        },
      },
    );
    if (response.status === 204) return 'left';
    // Already left (the "Sair" button or another away timeout): nothing to do (AWAY-01 AC6).
    if (response.status === 401 || response.status === 404) return 'gone';
    return 'error';
  } catch {
    return 'error';
  }
}
