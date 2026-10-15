import type { Participant } from '@/generated/prisma/client.js';
import type { OnlineParticipantDto } from '../dtos/response/online-participants-response.dto.js';
import type { ParticipantJoinedResponseDto } from '../dtos/response/participant-joined-response.dto.js';

export class ParticipantMapper {
  /** The raw token leaves the api only here, once. */
  static toJoined(
    participant: Participant,
    token: string,
  ): ParticipantJoinedResponseDto {
    return {
      id: participant.id,
      name: participant.name,
      token,
      joinedAt: participant.joinedAt.toISOString(),
    };
  }

  static toOnline({
    id,
    name,
  }: Pick<Participant, 'id' | 'name'>): OnlineParticipantDto {
    return { id, name };
  }
}
