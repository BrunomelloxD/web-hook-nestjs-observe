import { Injectable } from '@nestjs/common';
import { MessageType } from '@/generated/prisma/client.js';
import { PrismaService } from '@/common/prisma/prisma.service.js';
import {
  IMessageRepository,
  WITH_AUTHOR,
  type CreateMessageData,
  type FindMessagePageParams,
  type MessageWithAuthor,
} from './message.repository.interface.js';

@Injectable()
export class MessageRepository extends IMessageRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findPage({
    limit,
    before,
    after,
  }: FindMessagePageParams): Promise<MessageWithAuthor[]> {
    if (after !== undefined) {
      return this.prisma.message.findMany({
        where: { seq: { gt: after } },
        orderBy: { seq: 'asc' },
        take: limit,
        ...WITH_AUTHOR,
      });
    }
    // Latest page: newest first from the database, returned oldest first.
    const page = await this.prisma.message.findMany({
      where: before === undefined ? {} : { seq: { lt: before } },
      orderBy: { seq: 'desc' },
      take: limit,
      ...WITH_AUTHOR,
    });
    return page.reverse();
  }

  create(data: CreateMessageData): Promise<MessageWithAuthor> {
    return this.prisma.message.create({
      data: { type: MessageType.USER, ...data },
      ...WITH_AUTHOR,
    });
  }
}
