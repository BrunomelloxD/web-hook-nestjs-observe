import type { Prisma } from '@/generated/prisma/client.js';

/** Every chat read loads the author's id and name only. */
export const WITH_AUTHOR = {
  include: { participant: { select: { id: true, name: true } } },
} as const satisfies Prisma.MessageDefaultArgs;

/** A message with its author, as every chat read returns it. */
export type MessageWithAuthor = Prisma.MessageGetPayload<typeof WITH_AUTHOR>;

export interface FindMessagePageParams {
  limit: number;
  before?: bigint;
  after?: bigint;
}

export interface CreateMessageData {
  participantId: string;
  content: string;
  clientId: string | null;
}

/** Insert-only domain: no IBaseRepository (see ARCHITECTURE §14). */
export abstract class IMessageRepository {
  /** Always ascending by seq; `after` pages forward, otherwise the latest. */
  abstract findPage(
    params: FindMessagePageParams,
  ): Promise<MessageWithAuthor[]>;
  abstract create(data: CreateMessageData): Promise<MessageWithAuthor>;
}
