import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, type Participant } from '@/generated/prisma/client.js';
import { WebhookDispatcher } from '@/modules/webhooks/services/webhook-dispatcher.service.js';
import type { ListMessagesQuery } from '../dtos/request/list-messages.query.js';
import type { SendMessageDto } from '../dtos/request/send-message.dto.js';
import type { MessageResponseDto } from '../dtos/response/message-response.dto.js';
import type { MessagesResponseDto } from '../dtos/response/messages-response.dto.js';
import { RateLimitedException } from '../filters/rate-limited-exception.filter.js';
import { MessageMapper } from '../mappers/message.mapper.js';
import { IMessageRepository } from '../repositories/message.repository.interface.js';
import { SendRateLimiter } from './send-rate-limiter.js';
import { TypingService } from './typing.service.js';

const toCursor = (value?: number) =>
  value === undefined ? undefined : BigInt(value);

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === 'P2002';

@Injectable()
export class MessagesService {
  constructor(
    private readonly messages: IMessageRepository,
    private readonly webhooks: WebhookDispatcher,
    private readonly rateLimiter: SendRateLimiter,
    private readonly typing: TypingService,
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

  /**
   * The DTO already trimmed the content; the repository sets type USER.
   * A retry with a stored clientId returns that message: it neither counts
   * against the limit (RATE-01 AC3) nor fires the webhook again (OPT-02),
   * nor restarts the typing window (TYPE-01 AC13).
   */
  async send(
    actor: Participant,
    { content, clientId }: SendMessageDto,
  ): Promise<MessageResponseDto> {
    if (clientId !== undefined) {
      const stored = await this.messages.findByClientId(actor.id, clientId);
      if (stored) return MessageMapper.toResponse(stored);
    }

    const quota = this.rateLimiter.tryAcquire(actor.id, Date.now());
    if (!quota.ok) throw new RateLimitedException(quota.retryAfterSeconds);

    let message;
    try {
      message = await this.messages.create({
        participantId: actor.id,
        content,
        clientId: clientId ?? null,
      });
    } catch (error) {
      // Two retries raced: the other one inserted it first.
      const stored =
        clientId !== undefined && isUniqueViolation(error)
          ? await this.messages.findByClientId(actor.id, clientId)
          : null;
      if (!stored) throw error;
      return MessageMapper.toResponse(stored);
    }
    this.typing.reset(actor.id);
    const dto = MessageMapper.toResponse(message);
    // After the insert resolved (committed); delivery runs in the background.
    this.webhooks.dispatch('message.created', dto);
    return dto;
  }
}
