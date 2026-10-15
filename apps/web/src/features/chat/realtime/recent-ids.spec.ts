import { getRecentIds, RecentIds } from './recent-ids';

function fill(ids: RecentIds, count: number) {
  for (let i = 1; i <= count; i++) ids.add(`msg_${i}`);
}

describe('RecentIds', () => {
  it('guarda um id adicionado', () => {
    const ids = new RecentIds();

    expect(ids.has('msg_1')).toBe(false);
    ids.add('msg_1');
    expect(ids.has('msg_1')).toBe(true);
  });

  it('com 1000 inserções, guarda todas', () => {
    const ids = new RecentIds();
    fill(ids, 1000);

    expect(ids.has('msg_1')).toBe(true);
    expect(ids.has('msg_1000')).toBe(true);
  });

  it('depois de 1001 inserções, o primeiro sai e o segundo continua', () => {
    const ids = new RecentIds();
    fill(ids, 1001);

    expect(ids.has('msg_1')).toBe(false);
    expect(ids.has('msg_2')).toBe(true);
    expect(ids.has('msg_1001')).toBe(true);
  });

  it('depois de 1002 inserções, os dois mais antigos saem', () => {
    const ids = new RecentIds();
    fill(ids, 1002);

    expect(ids.has('msg_2')).toBe(false);
    expect(ids.has('msg_3')).toBe(true);
  });
});

describe('getRecentIds', () => {
  it('devolve a mesma instância, guardada em globalThis', () => {
    const first = getRecentIds();

    expect(first).toBeInstanceOf(RecentIds);
    expect(getRecentIds()).toBe(first);
    expect(
      (globalThis as Record<symbol, unknown>)[
        Symbol.for('web-hook.recent-webhook-ids')
      ],
    ).toBe(first);
  });
});
