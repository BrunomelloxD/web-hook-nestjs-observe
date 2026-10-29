import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';

/** The send limit refused the message (RATE-01). */
export class RateLimitedException extends HttpException {
  constructor(readonly retryAfterSeconds: number) {
    super(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        error: 'Too Many Requests',
        message:
          'Você está enviando mensagens rápido demais. Aguarde alguns segundos.',
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

/** Writes Retry-After so the controller and service stay free of @Res. */
@Catch(RateLimitedException)
export class RateLimitedExceptionFilter implements ExceptionFilter {
  catch(exception: RateLimitedException, host: ArgumentsHost) {
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(exception.getStatus())
      .setHeader('Retry-After', String(exception.retryAfterSeconds))
      .json(exception.getResponse());
  }
}
