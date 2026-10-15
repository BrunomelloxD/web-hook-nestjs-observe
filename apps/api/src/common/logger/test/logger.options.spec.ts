import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Options } from 'pino-http';
import type { AppConfigService } from '@/common/config/app-config.service.js';
import { createLoggerOptions } from '../logger.options.js';

function configStub(isProduction: boolean) {
  return {
    get: vi.fn().mockReturnValue('info'),
    isProduction,
  } as unknown as AppConfigService;
}

function pinoHttpOf(isProduction = false) {
  return createLoggerOptions(configStub(isProduction)).pinoHttp as Options;
}

describe('createLoggerOptions', () => {
  it('usa o LOG_LEVEL da configuração', () => {
    expect(pinoHttpOf().level).toBe('info');
  });

  describe('genReqId', () => {
    const res = () =>
      ({ setHeader: vi.fn() }) as unknown as ServerResponse & {
        setHeader: ReturnType<typeof vi.fn>;
      };

    it('reaproveita o x-request-id enviado pelo cliente', () => {
      const response = res();
      const req = {
        headers: { 'x-request-id': 'abc' },
      } as unknown as IncomingMessage;

      const id = pinoHttpOf().genReqId!(req, response);

      expect(id).toBe('abc');
      expect(response.setHeader).toHaveBeenCalledWith('x-request-id', 'abc');
    });

    it('gera um UUID quando o cliente não envia', () => {
      const response = res();
      const req = { headers: {} } as IncomingMessage;

      const id = pinoHttpOf().genReqId!(req, response);

      expect(id).toMatch(/^[0-9a-f-]{36}$/);
      expect(response.setHeader).toHaveBeenCalledWith('x-request-id', id);
    });
  });

  it('serializa só id, método, URL e status', () => {
    const { serializers } = pinoHttpOf();

    expect(
      serializers!.req({ id: '1', method: 'GET', url: '/x', headers: {} }),
    ).toEqual({ id: '1', method: 'GET', url: '/x' });
    expect(serializers!.res({ statusCode: 200, headers: {} })).toEqual({
      statusCode: 200,
    });
  });

  describe('autoLogging.ignore', () => {
    const ignore = (url?: string) => {
      const { autoLogging } = pinoHttpOf();
      return (
        autoLogging as { ignore: (req: IncomingMessage) => boolean }
      ).ignore({
        url,
      } as IncomingMessage);
    };

    it('ignora as rotas de health', () => {
      expect(ignore('/health')).toBe(true);
      expect(ignore('/health/memory')).toBe(true);
    });

    it('loga as demais rotas', () => {
      expect(ignore('/api/v1/chat/messages')).toBe(false);
    });

    it('loga quando a URL não está disponível', () => {
      expect(ignore(undefined)).toBe(false);
    });
  });

  it('usa pino-pretty fora de produção', () => {
    expect(pinoHttpOf(false).transport).toEqual({
      target: 'pino-pretty',
      options: { singleLine: true },
    });
  });

  it('emite JSON puro em produção', () => {
    expect(pinoHttpOf(true).transport).toBeUndefined();
  });
});
