import { MessageType, type Participant } from '@/generated/prisma/client.js';
import type { MessageWithAuthor } from './repositories/message.repository.interface.js';

/** Shared by the module's tests. */
export function makeParticipant(
  overrides: Partial<Participant> = {},
): Participant {
  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Ana',
    nameKey: 'ana',
    tokenHash: 'a'.repeat(64),
    joinedAt: new Date('2026-01-01T00:00:00.000Z'),
    leftAt: null,
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

/** A USER message by makeParticipant() unless overridden. */
export function makeMessage(
  overrides: Partial<MessageWithAuthor> = {},
): MessageWithAuthor {
  return {
    id: '6f1c2b9e-3d4a-4c5b-8e7f-0a1b2c3d4e5f',
    seq: 1n,
    type: MessageType.USER,
    content: 'olá',
    clientId: null,
    participantId: '550e8400-e29b-41d4-a716-446655440000',
    participant: { id: '550e8400-e29b-41d4-a716-446655440000', name: 'Ana' },
    createdAt: new Date('2026-01-01T00:00:01.000Z'),
    ...overrides,
  };
}
