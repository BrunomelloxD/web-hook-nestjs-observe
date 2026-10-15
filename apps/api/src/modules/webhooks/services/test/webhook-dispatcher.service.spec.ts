import { createHmac } from 'node:crypto';
import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Mocked } from 'vitest';
import { AppConfigService } from '@/common/config/app-config.service.js';
import type { WebhookPostResult } from '../../http/webhook-http-client.js';
import { WebhookHttpClient } from '../../http/webhook-http-client.js';
import { IWebhookDeliveryRepository } from '../../repositories/webhook-delivery.repository.interface.js';
import { WebhookDispatcher } from '../webhook-dispatcher.service.js';

const TARGET_URL = 'http://localhost:4599/webhooks/chat';
// whsec_ + base64 of the 32 bytes 0x00..0x1f.
const SECRET = 'whsec_AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=';
const KEY = Buffer.from(Array.from({ length: 32 }, (_, i) => i));
const DELIVERY_ID = '3b2a1c0d-9e8f-4a7b-8c6d-5e4f3a2b1c0d';
const NOW = new Date('2026-10-14T12:00:00.000Z');
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const MESSAGE = {
  id: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
  seq: 1041,
  type: 'USER',
  content: 'olá',
  clientId: null,
  author: { id: '7d9f1e2a-4b3c-4d5e-9f60-1a2b3c4d5e6f', name: 'Bia' },
  createdAt: '2026-10-14T11:59:59.000Z',
};

const ok = (status = 204): WebhookPostResult => ({
  status,
  durationMs: 12,
  error: null,
});
const fail = (status: number | null = 500): WebhookPostResult => ({
  status,
  durationMs: 34,
  error: status === null ? 'fetch failed' : null,
});

/** Independent of the code under test: HMAC-SHA256 over "id.ts.body". */
const expectedSignature = (id: string, timestamp: string, body: string) =>
  `v1,${createHmac('sha256', KEY).update(`${id}.${timestamp}.${body}`).digest('base64')}`;

describe('WebhookDispatcher', () => {
  let dispatcher: WebhookDispatcher;
  let repository: Mocked<IWebhookDeliveryRepository>;
  let http: { post: ReturnType<typeof vi.fn> };
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  const flush = () => vi.advanceTimersByTimeAsync(0);
  const calls = () =>
    http.post.mock.calls as [string, string, Record<string, string>][];

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    repository = {
      create: vi.fn().mockResolvedValue({ id: DELIVERY_ID }),
      recordAttempt: vi.fn().mockResolvedValue(undefined),
      markStatus: vi.fn().mockResolvedValue(undefined),
    };
    http = { post: vi.fn().mockResolvedValue(ok()) };

    const module = await Test.createTestingModule({
      providers: [
        WebhookDispatcher,
        {
          provide: AppConfigService,
          useValue: { webhookTargetUrl: TARGET_URL, webhookSecret: SECRET },
        },
        { provide: IWebhookDeliveryRepository, useValue: repository },
        { provide: WebhookHttpClient, useValue: http },
      ],
    }).compile();

    dispatcher = module.get(WebhookDispatcher);
    // After compile: only the dispatcher's own lines are captured.
    logSpy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('primeira tentativa', () => {
    it('dispatch volta (void) antes de qualquer gravação ou post', async () => {
      expect(dispatcher.dispatch('message.created', MESSAGE)).toBeUndefined();

      expect(repository.create).not.toHaveBeenCalled();
      expect(http.post).not.toHaveBeenCalled();

      await flush();

      expect(http.post).toHaveBeenCalledTimes(1);
    });

    it('faz POST no WEBHOOK_TARGET_URL com o corpo { type, occurredAt, data }', async () => {
      dispatcher.dispatch('message.created', MESSAGE);
      await flush();

      const [url, body] = calls()[0];
      expect(url).toBe(TARGET_URL);
      expect(body).toBe(
        JSON.stringify({
          type: 'message.created',
          occurredAt: '2026-10-14T12:00:00.000Z',
          data: MESSAGE,
        }),
      );
      expect(Object.keys(JSON.parse(body))).toEqual([
        'type',
        'occurredAt',
        'data',
      ]);
    });

    it('envia webhook-id, webhook-timestamp, webhook-signature e content-type: application/json', async () => {
      dispatcher.dispatch('presence.changed', { online: 3 });
      await flush();

      const [, body, headers] = calls()[0];
      expect(Object.keys(headers).sort()).toEqual([
        'content-type',
        'webhook-id',
        'webhook-signature',
        'webhook-timestamp',
      ]);
      expect(headers['webhook-id']).toMatch(UUID);
      expect(headers['webhook-timestamp']).toBe('1791979200');
      expect(headers['content-type']).toBe('application/json');
      expect(headers['webhook-signature']).toBe(
        expectedSignature(headers['webhook-id'], '1791979200', body),
      );
      expect(JSON.parse(body)).toEqual({
        type: 'presence.changed',
        occurredAt: '2026-10-14T12:00:00.000Z',
        data: { online: 3 },
      });
    });

    it('grava a entrega com o mesmo eventId do header, o tipo e o envelope como payload', async () => {
      dispatcher.dispatch('message.created', MESSAGE);
      await flush();

      const [, body, headers] = calls()[0];
      expect(repository.create).toHaveBeenCalledTimes(1);
      expect(repository.create).toHaveBeenCalledWith({
        eventId: headers['webhook-id'],
        eventType: 'message.created',
        payload: JSON.parse(body),
      });
    });

    it('cada dispatch gera um eventId diferente', async () => {
      dispatcher.dispatch('presence.changed', { online: 1 });
      dispatcher.dispatch('presence.changed', { online: 1 });
      await flush();

      const [first, second] = calls().map(([, , h]) => h['webhook-id']);
      expect(first).not.toBe(second);
    });
  });

  describe('resultado da tentativa', () => {
    it.each([200, 204, 299])(
      '%i → grava a tentativa 1 e marca SUCCEEDED, sem retentar',
      async (status) => {
        http.post.mockResolvedValueOnce({
          status,
          durationMs: 12,
          error: null,
        });

        dispatcher.dispatch('presence.changed', { online: 2 });
        await flush();

        expect(repository.recordAttempt).toHaveBeenCalledWith(DELIVERY_ID, {
          number: 1,
          statusCode: status,
          durationMs: 12,
          error: null,
        });
        expect(repository.markStatus).toHaveBeenCalledWith(
          DELIVERY_ID,
          'SUCCEEDED',
        );
        expect(vi.getTimerCount()).toBe(0);
        await vi.advanceTimersByTimeAsync(3_600_000);
        expect(http.post).toHaveBeenCalledTimes(1);
      },
    );

    it.each([
      ['300', fail(300)],
      ['404', fail(404)],
      ['500', fail(500)],
      ['sem resposta', fail(null)],
      ['timeout', { status: null, durationMs: 5000, error: 'timeout' }],
    ])(
      '%s conta como falha: grava a tentativa e agenda a próxima, sem marcar status',
      async (_case, result) => {
        http.post.mockResolvedValueOnce(result);

        dispatcher.dispatch('presence.changed', { online: 2 });
        await flush();

        expect(repository.recordAttempt).toHaveBeenCalledWith(DELIVERY_ID, {
          number: 1,
          statusCode: result.status,
          durationMs: result.durationMs,
          error: result.error,
        });
        expect(repository.markStatus).not.toHaveBeenCalled();
        expect(vi.getTimerCount()).toBe(1);
      },
    );
  });

  describe('retentativas', () => {
    it('falhas 1..5 esperam 1 s, 5 s, 30 s, 2 min e 10 min; a 6ª marca FAILED e não agenda mais', async () => {
      http.post.mockResolvedValue(fail(500));

      dispatcher.dispatch('presence.changed', { online: 2 });
      await flush();
      expect(http.post).toHaveBeenCalledTimes(1);

      const delays = [1_000, 5_000, 30_000, 120_000, 600_000];
      for (const [index, delay] of delays.entries()) {
        await vi.advanceTimersByTimeAsync(delay - 1);
        expect(http.post).toHaveBeenCalledTimes(index + 1);

        await vi.advanceTimersByTimeAsync(1);
        expect(http.post).toHaveBeenCalledTimes(index + 2);
      }

      expect(
        repository.recordAttempt.mock.calls.map(([, a]) => a.number),
      ).toEqual([1, 2, 3, 4, 5, 6]);
      expect(repository.markStatus).toHaveBeenCalledTimes(1);
      expect(repository.markStatus).toHaveBeenCalledWith(DELIVERY_ID, 'FAILED');
      expect(vi.getTimerCount()).toBe(0);
      await vi.advanceTimersByTimeAsync(24 * 3_600_000);
      expect(http.post).toHaveBeenCalledTimes(6);
    });

    it('falha, falha e 204: 3 tentativas gravadas e SUCCEEDED', async () => {
      http.post
        .mockResolvedValueOnce(fail(500))
        .mockResolvedValueOnce(fail(500))
        .mockResolvedValueOnce(ok(204));

      dispatcher.dispatch('message.created', MESSAGE);
      await flush();
      await vi.advanceTimersByTimeAsync(1_000);
      await vi.advanceTimersByTimeAsync(5_000);

      expect(repository.recordAttempt.mock.calls.map(([, a]) => a)).toEqual([
        { number: 1, statusCode: 500, durationMs: 34, error: null },
        { number: 2, statusCode: 500, durationMs: 34, error: null },
        { number: 3, statusCode: 204, durationMs: 12, error: null },
      ]);
      expect(repository.markStatus).toHaveBeenCalledTimes(1);
      expect(repository.markStatus).toHaveBeenCalledWith(
        DELIVERY_ID,
        'SUCCEEDED',
      );
      expect(repository.create).toHaveBeenCalledTimes(1);
    });

    it('repete o webhook-id e o corpo; o webhook-timestamp e a assinatura mudam', async () => {
      http.post.mockResolvedValueOnce(fail(500)).mockResolvedValueOnce(ok());

      dispatcher.dispatch('message.created', MESSAGE);
      await flush();
      await vi.advanceTimersByTimeAsync(1_000);

      const [[, body1, h1], [, body2, h2]] = calls();
      expect(h2['webhook-id']).toBe(h1['webhook-id']);
      expect(body2).toBe(body1);
      expect(h1['webhook-timestamp']).toBe('1791979200');
      expect(h2['webhook-timestamp']).toBe('1791979201');
      expect(h2['webhook-signature']).not.toBe(h1['webhook-signature']);
      expect(h2['webhook-signature']).toBe(
        expectedSignature(h1['webhook-id'], '1791979201', body1),
      );
    });

    it('maxAttempts: 1 não retenta e marca FAILED', async () => {
      http.post.mockResolvedValue(fail(500));

      dispatcher.dispatch(
        'presence.changed',
        { online: 2 },
        { maxAttempts: 1 },
      );
      await flush();

      expect(repository.markStatus).toHaveBeenCalledWith(DELIVERY_ID, 'FAILED');
      expect(vi.getTimerCount()).toBe(0);
      await vi.advanceTimersByTimeAsync(3_600_000);
      expect(http.post).toHaveBeenCalledTimes(1);
    });
  });

  describe('erros internos', () => {
    it('erro ao criar a entrega é logado e não propaga; nada é enviado', async () => {
      repository.create.mockRejectedValueOnce(new Error('db down'));

      expect(() =>
        dispatcher.dispatch('presence.changed', { online: 2 }),
      ).not.toThrow();
      await flush();

      expect(http.post).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledTimes(1);
      const [entry] = errorSpy.mock.calls[0] as [Record<string, unknown>];
      expect(entry).toEqual({
        msg: 'webhook delivery error',
        eventId: expect.stringMatching(UUID),
        type: 'presence.changed',
        error: 'db down',
      });
    });

    it('erro ao gravar a tentativa é logado e não propaga, nem agenda outra', async () => {
      repository.recordAttempt.mockRejectedValueOnce(new Error('db down'));

      dispatcher.dispatch('message.created', MESSAGE);
      await flush();

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy.mock.calls[0][0]).toMatchObject({
        type: 'message.created',
        error: 'db down',
      });
      expect(vi.getTimerCount()).toBe(0);
    });
  });

  describe('log por tentativa', () => {
    it('sucesso: log com eventId, tipo, tentativa, status e duração, sem o corpo', async () => {
      dispatcher.dispatch('message.created', MESSAGE);
      await flush();

      const [, , headers] = calls()[0];
      expect(logSpy).toHaveBeenCalledTimes(1);
      const [entry] = logSpy.mock.calls[0] as [Record<string, unknown>];
      expect(entry).toEqual({
        msg: 'webhook attempt',
        eventId: headers['webhook-id'],
        type: 'message.created',
        attempt: 1,
        status: 204,
        durationMs: 12,
        error: null,
      });
      expect(JSON.stringify(logSpy.mock.calls)).not.toContain('olá');
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('falha: warn com os mesmos campos e o erro, sem o corpo', async () => {
      http.post.mockResolvedValueOnce(fail(null));

      dispatcher.dispatch('message.created', MESSAGE);
      await flush();

      const [, , headers] = calls()[0];
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toEqual({
        msg: 'webhook attempt',
        eventId: headers['webhook-id'],
        type: 'message.created',
        attempt: 1,
        status: null,
        durationMs: 34,
        error: 'fetch failed',
      });
      expect(JSON.stringify(warnSpy.mock.calls)).not.toContain('olá');
      expect(logSpy).not.toHaveBeenCalled();
    });
  });

  describe('onApplicationShutdown', () => {
    it('cancela o timer da retentativa pendente', async () => {
      http.post.mockResolvedValue(fail(500));
      dispatcher.dispatch('presence.changed', { online: 2 });
      await flush();
      expect(vi.getTimerCount()).toBe(1);

      dispatcher.onApplicationShutdown();

      expect(vi.getTimerCount()).toBe(0);
      await vi.advanceTimersByTimeAsync(3_600_000);
      expect(http.post).toHaveBeenCalledTimes(1);
    });

    it('cancela a primeira tentativa ainda não iniciada', async () => {
      dispatcher.dispatch('presence.changed', { online: 2 });

      dispatcher.onApplicationShutdown();
      await flush();

      expect(vi.getTimerCount()).toBe(0);
      expect(repository.create).not.toHaveBeenCalled();
      expect(http.post).not.toHaveBeenCalled();
    });

    it('uma tentativa em andamento no shutdown não agenda a próxima', async () => {
      let respond!: (result: WebhookPostResult) => void;
      http.post.mockReturnValueOnce(
        new Promise((resolve) => (respond = resolve)),
      );
      dispatcher.dispatch('presence.changed', { online: 2 });
      await flush();

      dispatcher.onApplicationShutdown();
      respond(fail(500));
      await flush();

      expect(vi.getTimerCount()).toBe(0);
      await vi.advanceTimersByTimeAsync(3_600_000);
      expect(http.post).toHaveBeenCalledTimes(1);
    });
  });
});
