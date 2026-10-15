import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Participant } from '@/generated/prisma/client.js';
import { WebhookDispatcher } from '@/modules/webhooks/services/webhook-dispatcher.service.js';
import type { JoinParticipantDto } from '../dtos/request/join-participant.dto.js';
import type { OnlineParticipantsResponseDto } from '../dtos/response/online-participants-response.dto.js';
import type { ParticipantJoinedResponseDto } from '../dtos/response/participant-joined-response.dto.js';
import { MessageMapper } from '../mappers/message.mapper.js';
import { ParticipantMapper } from '../mappers/participant.mapper.js';
import type { MessageWithAuthor } from '../repositories/message.repository.interface.js';
import { IParticipantRepository } from '../repositories/participant.repository.interface.js';
import {
  generateToken,
  hashToken,
  toNameKey,
} from '../security/participant-token.js';

@Injectable()
export class ParticipantsService {
  constructor(
    private readonly participants: IParticipantRepository,
    private readonly webhooks: WebhookDispatcher,
  ) {}

  /** A name already online fails with P2002 (409 via the global filter). */
  async join({
    name,
  }: JoinParticipantDto): Promise<ParticipantJoinedResponseDto> {
    const token = generateToken();
    const { participant, message } =
      await this.participants.createWithJoinMessage({
        name,
        nameKey: toNameKey(name),
        tokenHash: hashToken(token),
      });
    await this.notifyPresence(message);
    return ParticipantMapper.toJoined(participant, token);
  }

  async listOnline(): Promise<OnlineParticipantsResponseDto> {
    const online = await this.participants.listOnline();
    return {
      items: online.map((p) => ParticipantMapper.toOnline(p)),
      total: online.length,
    };
  }

  async leave(id: string, actor: Participant): Promise<void> {
    const participant = await this.participants.findById(id);
    if (!participant) {
      throw new NotFoundException('Participante não encontrado');
    }
    if (participant.id !== actor.id) {
      throw new UnauthorizedException(
        'O token não pertence a este participante',
      );
    }
    const message = await this.participants.leaveWithMessage(id);
    await this.notifyPresence(message);
  }

  /** After the JOINED/LEFT transaction: the message, then the online count. */
  private async notifyPresence(message: MessageWithAuthor): Promise<void> {
    this.webhooks.dispatch(
      'message.created',
      MessageMapper.toResponse(message),
    );
    this.webhooks.dispatch('presence.changed', {
      online: await this.participants.countOnline(),
    });
  }

  authenticate(token: string): Promise<Participant | null> {
    return this.participants.findActiveByTokenHash(hashToken(token));
  }
}
