import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PaginationDto } from '../pagination.dto.js';

async function parse(query: Record<string, string>) {
  const dto = plainToInstance(PaginationDto, query);
  return { dto, errors: await validate(dto) };
}

describe('PaginationDto', () => {
  it('usa page=1 e limit=10 por padrão', async () => {
    const { dto, errors } = await parse({});

    expect(errors).toHaveLength(0);
    expect(dto).toMatchObject({ page: 1, limit: 10, skip: 0 });
  });

  it('converte a query string em números e calcula o skip', async () => {
    const { dto, errors } = await parse({ page: '3', limit: '20' });

    expect(errors).toHaveLength(0);
    expect(dto).toMatchObject({ page: 3, limit: 20, skip: 40 });
  });

  it.each([
    [{ page: '0' }, 'page'],
    [{ limit: '0' }, 'limit'],
    [{ limit: '101' }, 'limit'],
    [{ page: 'abc' }, 'page'],
    [{ search: 'x'.repeat(101) }, 'search'],
  ])('rejeita %o', async (query, property) => {
    const { errors } = await parse(query);

    expect(errors.map((e) => e.property)).toContain(property);
  });
});
