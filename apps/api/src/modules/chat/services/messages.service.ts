import { BadRequestException, Injectable } from '@nestjs/common';
import type { Participant } from '@/generated/prisma/client.js';
import { WebhookDispatcher } from '@/modules/webhooks/services/webhook-dispatcher.service.js';
import type { ListMessagesQuery } from '../dtos/request/list-messages.query.js';
import type { SendMessageDto } from '../dtos/request/send-message.dto.js';
import type { MessageResponseDto } from '../dtos/response/message-response.dto.js';
import type { MessagesResponseDto } from '../dtos/response/messages-response.dto.js';
import { MessageMapper } from '../mappers/message.mapper.js';
import { IMessageRepository } from '../repositories/message.repository.interface.js';

const toCursor = (value?: number) =>
  value === undefined ? undefined : BigInt(value);

@Injectable()
export class MessagesService {
  constructor(
    private readonly messages: IMessageRepository,
    private readonly webhooks: WebhookDispatcher,
  ) {}

  async list({
    limit,
    before,
    after,
  }: ListMessagesQuery): Promise<MessagesResponseDto> {
    if (before !== undefined && after !== undefined) {
      throw new BadRequestException('Use before ou after, não os dois');
    }
    const page = await this.messages.findPage({
      limit,
      before: toCursor(before),
      after: toCursor(after),
    });
    return { items: page.map((m) => MessageMapper.toResponse(m)) };
  }

  /** The DTO already trimmed the content; the repository sets type USER. */
  async send(
    actor: Participant,
    { content, clientId }: SendMessageDto,
  ): Promise<MessageResponseDto> {
    const message = await this.messages.create({
      participantId: actor.id,
      content,
      clientId: clientId ?? null,
    });
    const dto = MessageMapper.toResponse(message);
    // After the insert resolved (committed); delivery runs in the background.
    this.webhooks.dispatch('message.created', dto);
    return dto;
  }
}
