import type { Participant } from '@/generated/prisma/client.js';
import type { MessageWithAuthor } from './message.repository.interface.js';

export interface CreateParticipantData {
  name: string;
  nameKey: string;
  tokenHash: string;
}

/** Insert-only domain: no IBaseRepository (see ARCHITECTURE §14). */
export abstract class IParticipantRepository {
  /** Creates the participant and its JOINED message in one transaction. */
  abstract createWithJoinMessage(
    data: CreateParticipantData,
  ): Promise<{ participant: Participant; message: MessageWithAuthor }>;
  /** Sets leftAt and creates the LEFT message in one transaction. */
  abstract leaveWithMessage(id: string): Promise<MessageWithAuthor>;
  abstract findById(id: string): Promise<Participant | null>;
  /** Only participants still online (leftAt null). */
  abstract findActiveByTokenHash(
    tokenHash: string,
  ): Promise<Participant | null>;
  /** Online participants ordered by joinedAt. */
  abstract listOnline(): Promise<Pick<Participant, 'id' | 'name'>[]>;
  abstract countOnline(): Promise<number>;
}
