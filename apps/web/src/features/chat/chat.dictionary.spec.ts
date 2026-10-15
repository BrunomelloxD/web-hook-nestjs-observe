import { chatDictionary as t } from './chat.dictionary';

describe('chatDictionary', () => {
  it.each([
    [1, '1 pessoa online'],
    [3, '3 pessoas online'],
  ])('online(%i) → %j', (count, text) => {
    expect(t.online(count)).toBe(text);
  });

  it.each([
    [['Ana'], 'Ana está digitando…'],
    [['Ana', 'Carlos'], 'Ana e Carlos estão digitando…'],
    [['Ana', 'Carlos', 'Bia'], 'Várias pessoas estão digitando…'],
  ])('typing(%j) → %j', (names, text) => {
    expect(t.typing(names)).toBe(text);
  });

  it('rótulos do botão de tema (THEME-03 AC5/AC6)', () => {
    expect(t.theme).toEqual({
      toDark: 'Usar tema escuro',
      toLight: 'Usar tema claro',
    });
  });

  it('erro ao carregar a sala (ROOM-01 AC13)', () => {
    expect(t.room.loadError).toBe('Não foi possível carregar a sala');
    expect(t.room.retry).toBe('Tentar novamente');
  });

  it('mensagens de sistema de entrada e saída', () => {
    expect(t.system.joined('Ana')).toBe('Ana entrou no chat');
    expect(t.system.left('Ana')).toBe('Ana saiu do chat');
  });
});
