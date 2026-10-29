import type { ChatMessage, ChatParticipant } from './chat.types';
import type { ChatItem } from './state/chat-room.reducer';

/** Shared by tests and stories. */
export function makeParticipant(
  overrides: Partial<ChatParticipant> = {},
): ChatParticipant {
  return {
    id: 'a1b2c3d4-0000-4000-8000-000000000001',
    name: 'Ana',
    ...overrides,
  };
}

export function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'm0000000-0000-4000-8000-000000000001',
    seq: 1,
    type: 'USER',
    content: 'Oi, pessoal! Alguém por aqui?',
    clientId: null,
    author: makeParticipant(),
    createdAt: '2026-10-14T17:03:00.000Z',
    ...overrides,
  };
}

// Ids picked so Ana and Carlos get different avatar tones.
export const ana = makeParticipant();
export const carlos = makeParticipant({
  id: 'a1b2c3d4-0000-4000-8000-000000000002',
  name: 'Carlos',
});
/** The current participant in the design frames. */
export const me = makeParticipant({
  id: 'a1b2c3d4-0000-4000-8000-000000000003',
  name: 'Bruno',
});

/** The Sala frames' conversation (times are 14:02-14:32 in São Paulo). */
export function makeConversation(): ChatMessage[] {
  const rows: [ChatMessage['type'], ChatParticipant, string, string][] = [
    ['JOINED', ana, '', '17:02'],
    ['USER', ana, 'Oi, pessoal! Alguém por aqui?', '17:03'],
    ['USER', carlos, 'Opa, Ana! Cheguei agora. Como tá o dia?', '17:05'],
    ['JOINED', me, '', '17:30'],
    ['USER', me, 'E aí, galera! Primeira vez aqui no chat.', '17:31'],
    ['USER', ana, 'Seja bem-vindo, Bruno! Fica à vontade. 😊', '17:32'],
  ];

  return rows.map(([type, author, content, time], i) =>
    makeMessage({
      id: `m0000000-0000-4000-8000-00000000000${i + 1}`,
      seq: i + 1,
      type,
      content,
      author,
      createdAt: `2026-10-14T${time}:00.000Z`,
    }),
  );
}

/** Confirmed list items, as MessageList takes them. */
export function asItems(messages: ChatMessage[]): ChatItem[] {
  return messages.map((message) => ({ kind: 'confirmed', message }));
}
