import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Params } from 'nestjs-pino';
import type { AppConfigService } from '@/common/config/app-config.service.js';

/** Reuses the client's x-request-id when present. */
export function createLoggerOptions(config: AppConfigService): Params {
  return {
    pinoHttp: {
      level: config.get('LOG_LEVEL'),
      genReqId: (req: IncomingMessage, res: ServerResponse) => {
        const id = req.headers['x-request-id']?.toString() ?? randomUUID();
        res.setHeader('x-request-id', id);
        return id;
      },
      // No headers or body in request logs.
      serializers: {
        req: (req: { id: string; method: string; url: string }) => ({
          id: req.id,
          method: req.method,
          url: req.url,
        }),
        res: (res: { statusCode: number }) => ({
          statusCode: res.statusCode,
        }),
      },
      autoLogging: {
        ignore: (req: IncomingMessage) =>
          req.url?.startsWith('/health') ?? false,
      },
      transport: config.isProduction
        ? undefined
        : { target: 'pino-pretty', options: { singleLine: true } },
    },
  };
}
