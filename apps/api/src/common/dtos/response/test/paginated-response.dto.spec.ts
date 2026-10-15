import { PaginatedResponseDto } from '../paginated-response.dto.js';

describe('PaginatedResponseDto.create', () => {
  it('monta data e meta com o last_page calculado', () => {
    const items = [{ id: 'a' }, { id: 'b' }];

    expect(
      PaginatedResponseDto.create(items, 21, { page: 3, limit: 10 }),
    ).toEqual({
      data: items,
      meta: { total: 21, page: 3, limit: 10, last_page: 3 },
    });
  });

  it('mantém last_page em 1 quando não há resultados', () => {
    expect(
      PaginatedResponseDto.create([], 0, { page: 1, limit: 10 }).meta.last_page,
    ).toBe(1);
  });
});
