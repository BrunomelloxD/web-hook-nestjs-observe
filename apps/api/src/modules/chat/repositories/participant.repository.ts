import { Injectable } from '@nestjs/common';
import { MessageType, type Participant } from '@/generated/prisma/client.js';
import { PrismaService } from '@/common/prisma/prisma.service.js';
import {
  WITH_AUTHOR,
  type MessageWithAuthor,
} from './message.repository.interface.js';
import {
  IParticipantRepository,
  type CreateParticipantData,
} from './participant.repository.interface.js';

const ONLINE = { leftAt: null };

@Injectable()
export class ParticipantRepository extends IParticipantRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  createWithJoinMessage(
    data: CreateParticipantData,
  ): Promise<{ participant: Participant; message: MessageWithAuthor }> {
    return this.prisma.$transaction(async (tx) => {
      const participant = await tx.participant.create({ data });
      const message = await tx.message.create({
        data: {
          type: MessageType.JOINED,
          content: '',
          participantId: participant.id,
        },
        ...WITH_AUTHOR,
      });
      return { participant, message };
    });
  }

  leaveWithMessage(id: string): Promise<MessageWithAuthor> {
    return this.prisma.$transaction(async (tx) => {
      await tx.participant.update({
        where: { id },
        data: { leftAt: new Date() },
      });
      return tx.message.create({
        data: { type: MessageType.LEFT, content: '', participantId: id },
        ...WITH_AUTHOR,
      });
    });
  }

  findById(id: string): Promise<Participant | null> {
    return this.prisma.participant.findUnique({ where: { id } });
  }

  findActiveByTokenHash(tokenHash: string): Promise<Participant | null> {
    return this.prisma.participant.findFirst({
      where: { tokenHash, ...ONLINE },
    });
  }

  listOnline(): Promise<Pick<Participant, 'id' | 'name'>[]> {
    return this.prisma.participant.findMany({
      where: ONLINE,
      select: { id: true, name: true },
      orderBy: { joinedAt: 'asc' },
    });
  }

  countOnline(): Promise<number> {
    return this.prisma.participant.count({ where: ONLINE });
  }
}
