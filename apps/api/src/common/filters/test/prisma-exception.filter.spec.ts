import type { ArgumentsHost } from '@nestjs/common';
import { Prisma } from '@/generated/prisma/client.js';
import { PrismaExceptionFilter } from '../prisma-exception.filter.js';

function prismaError(code: string) {
  return new Prisma.PrismaClientKnownRequestError('erro', {
    code,
    clientVersion: 'test',
  });
}

describe('PrismaExceptionFilter', () => {
  const filter = new PrismaExceptionFilter();
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  } as unknown as ArgumentsHost;

  beforeEach(() => vi.clearAllMocks());

  it.each([
    ['P2002', 409],
    ['P2003', 409],
    ['P2025', 404],
  ])('converte %s em %i', (code, expected) => {
    filter.catch(prismaError(code), host);

    expect(status).toHaveBeenCalledWith(expected);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: expected }),
    );
  });

  it('responde 500 para códigos não mapeados', () => {
    vi.spyOn(filter['logger'], 'error').mockImplementation(() => undefined);

    filter.catch(prismaError('P9999'), host);

    expect(status).toHaveBeenCalledWith(500);
  });
});
