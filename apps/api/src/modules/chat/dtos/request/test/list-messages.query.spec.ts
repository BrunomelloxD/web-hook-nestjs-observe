import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListMessagesQuery } from '../list-messages.query.js';

async function parse(query: Record<string, string>) {
  const dto = plainToInstance(ListMessagesQuery, query);
  return { dto, errors: await validate(dto) };
}

describe('ListMessagesQuery', () => {
  it('usa limit=50 por padrão, sem cursor', async () => {
    const { dto, errors } = await parse({});

    expect(errors).toEqual([]);
    expect(dto.limit).toBe(50);
    expect(dto.before).toBeUndefined();
    expect(dto.after).toBeUndefined();
  });

  it.each([
    ['1', 1],
    ['100', 100],
  ])('aceita limit=%s', async (limit, expected) => {
    const { dto, errors } = await parse({ limit });

    expect(errors).toEqual([]);
    expect(dto.limit).toBe(expected);
  });

  it.each(['0', '101', '-1', '1.5', 'abc'])(
    'rejeita limit=%s',
    async (limit) => {
      const { errors } = await parse({ limit });

      expect(errors.map((e) => e.property)).toEqual(['limit']);
    },
  );

  it.each(['before', 'after'])(
    'converte %s da query string em número, inclusive acima de 2^31',
    async (cursor) => {
      const one = await parse({ [cursor]: '1' });
      const big = await parse({ [cursor]: '3000000000' });

      expect(one.errors).toEqual([]);
      expect(one.dto[cursor as 'before' | 'after']).toBe(1);
      expect(big.errors).toEqual([]);
      expect(big.dto[cursor as 'before' | 'after']).toBe(3_000_000_000);
    },
  );

  it.each([
    ['before', 'abc'],
    ['before', '0'],
    ['before', '-1'],
    ['before', '1.5'],
    ['after', 'abc'],
    ['after', '0'],
    ['after', '-1'],
    ['after', '1.5'],
  ])('rejeita %s=%s', async (cursor, value) => {
    const { errors } = await parse({ [cursor]: value });

    expect(errors.map((e) => e.property)).toEqual([cursor]);
  });
});
