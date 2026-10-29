import { BadRequestException, type ArgumentsHost } from '@nestjs/common';
import {
  RateLimitedException,
  RateLimitedExceptionFilter,
} from '../rate-limited-exception.filter.js';

describe('RateLimitedException', () => {
  it('é um 429 com retryAfterSeconds e o corpo padrão de erro da api', () => {
    const exception = new RateLimitedException(3);

    expect(exception.getStatus()).toBe(429);
    expect(exception.retryAfterSeconds).toBe(3);
    // Same shape as Nest's built-in exceptions (e.g. BadRequestException).
    expect(Object.keys(exception.getResponse()).sort()).toEqual(
      Object.keys(new BadRequestException('x').getResponse() as object).sort(),
    );
  });
});

describe('RateLimitedExceptionFilter', () => {
  const filter = new RateLimitedExceptionFilter();
  const response = {
    status: vi.fn(),
    setHeader: vi.fn(),
    json: vi.fn(),
  };
  const host = {
    switchToHttp: () => ({ getResponse: () => response }),
  } as unknown as ArgumentsHost;

  beforeEach(() => {
    vi.clearAllMocks();
    response.status.mockReturnValue(response);
    response.setHeader.mockReturnValue(response);
  });

  it('responde 429, Retry-After: 3 e o corpo { statusCode, error, message }', () => {
    filter.catch(new RateLimitedException(3), host);

    expect(response.status).toHaveBeenCalledWith(429);
    expect(response.setHeader).toHaveBeenCalledWith('Retry-After', '3');
    expect(response.json).toHaveBeenCalledWith({
      statusCode: 429,
      error: 'Too Many Requests',
      message:
        'Você está enviando mensagens rápido demais. Aguarde alguns segundos.',
    });
  });
});
