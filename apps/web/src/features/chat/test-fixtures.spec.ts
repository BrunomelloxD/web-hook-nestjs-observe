// SPEC_DEVIATION: tasks.md planned no test for the fixtures (T10).
// Reason: phase 3's build gate needs 100% coverage before the phase 4 specs use them.
import { carlos, makeConversation, makeMessage, me } from './test-fixtures';

describe('makeConversation', () => {
  it('traz Ana, Carlos, mensagens próprias e de sistema, em ordem de seq', () => {
    const messages = makeConversation();

    expect(messages.map((m) => [m.type, m.author.name])).toEqual([
      ['JOINED', 'Ana'],
      ['USER', 'Ana'],
      ['USER', 'Carlos'],
      ['JOINED', 'Bruno'],
      ['USER', 'Bruno'],
      ['USER', 'Ana'],
    ]);
    expect(messages.map((m) => m.seq)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(new Set(messages.map((m) => m.id)).size).toBe(6);
    expect(messages.filter((m) => m.author.id === me.id)).toHaveLength(2);
    expect(messages.filter((m) => m.author.id === carlos.id)).toHaveLength(1);
  });
});

describe('makeMessage', () => {
  it('aplica os overrides sobre os valores padrão', () => {
    expect(makeMessage().type).toBe('USER');
    expect(makeMessage({ content: 'Oi' })).toMatchObject({
      type: 'USER',
      content: 'Oi',
      author: { name: 'Ana' },
    });
  });
});
