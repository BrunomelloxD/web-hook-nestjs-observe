import { randomUUID } from 'node:crypto';
import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '@/app/app.module.js';
import { setupApp } from '@/app/app.setup.js';
import { AppConfigService } from '@/common/config/app-config.service.js';
import { PrismaService } from '@/common/prisma/prisma.service.js';
import {
  decodeSecret,
  signWebhook,
} from '@/modules/webhooks/signing/standard-webhooks.js';

// Requires the database: docker compose up -d database.
// WEBHOOK_TARGET_URL points here (vitest.config.ts, project e2e).
const PORT = 4599;
const PREFIX = 'e2e-wh-';
const CHAT = '/api/v1/chat';
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

interface Received {
  id: string;
  timestamp: string;
  signature: string;
  contentType: string;
  body: string;
}

interface Envelope {
  type: string;
  occurredAt: string;
  data: Record<string, unknown> & { author?: { id: string } };
}

const header = (headers: IncomingHttpHeaders, name: string) =>
  String(headers[name]);

/** Polls until `check` returns a value (not undefined) or the time is up. */
async function waitFor<T>(
  check: () => T | undefined | Promise<T | undefined>,
  timeoutMs = 3000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await check();
    if (value !== undefined) return value;
    if (Date.now() > deadline) throw new Error('waitFor: timed out');
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('Webhooks (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let key: Buffer;
  let server: Server | undefined;
  let received: Received[] = [];
  let respond: (request: Received) => number = () => 204;
  const participantIds: string[] = [];
  // Every event id seen, for cleanup; `received` is reset per test.
  const eventIds = new Set<string>();

  const envelope = (r: Received) => JSON.parse(r.body) as Envelope;

  function startServer(): Promise<void> {
    server = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        const entry: Received = {
          id: header(req.headers, 'webhook-id'),
          timestamp: header(req.headers, 'webhook-timestamp'),
          signature: header(req.headers, 'webhook-signature'),
          contentType: header(req.headers, 'content-type'),
          body: Buffer.concat(chunks).toString('utf8'),
        };
        received.push(entry);
        eventIds.add(entry.id);
        res.statusCode = respond(entry);
        res.end();
      });
    });
    return new Promise((resolve) => server!.listen(PORT, resolve));
  }

  function stopServer(): Promise<void> {
    const current = server;
    server = undefined;
    if (!current) return Promise.resolve();
    current.closeAllConnections();
    return new Promise((resolve) => current.close(() => resolve()));
  }

  async function createApp(): Promise<INestApplication<App>> {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const instance = moduleRef.createNestApplication<INestApplication<App>>({
      logger: false,
    });
    setupApp(instance);
    await instance.init();
    return instance;
  }

  async function join(name: string, on = app) {
    const res = await request(on.getHttpServer())
      .post(`${CHAT}/participants`)
      .send({ name })
      .expect(201);
    participantIds.push(res.body.id);
    return res.body as { id: string; token: string };
  }

  const send = (token: string, content: string, on = app, clientId?: string) =>
    request(on.getHttpServer())
      .post(`${CHAT}/messages`)
      .set('X-Participant-Token', token)
      .send({ content, clientId });

  const deliveryOf = (eventId: string) =>
    prisma.webhookDelivery.findUnique({
      where: { eventId },
      include: { history: { orderBy: { attempt: 'asc' } } },
    });

  /** Deliveries whose message belongs to this file's participants. */
  const ownDeliveries = () => ({
    OR: [
      { eventId: { in: [...eventIds] } },
      ...participantIds.map((id) => ({
        payload: { path: ['data', 'author', 'id'], equals: id },
      })),
    ],
  });

  async function cleanup() {
    await prisma.webhookDelivery.deleteMany({ where: ownDeliveries() });
    const ours = { name: { startsWith: PREFIX } };
    await prisma.message.deleteMany({ where: { participant: ours } });
    await prisma.participant.deleteMany({ where: ours });
  }

  beforeAll(async () => {
    await startServer();
    app = await createApp();
    prisma = app.get(PrismaService);
    key = decodeSecret(app.get(AppConfigService).webhookSecret);
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
    await stopServer();
  });

  beforeEach(() => {
    received = [];
    respond = () => 204;
  });

  it('POST /messages responde 201 antes de o servidor receber; o webhook chega assinado', async () => {
    const ana = await join(`${PREFIX}Ana`);
    // Let the JOINED and presence webhooks arrive before counting.
    await waitFor(() => (received.length >= 2 ? true : undefined));
    received = [];

    const res = await send(ana.token, 'olá, webhook').expect(201);
    const atResponse = received.filter(
      (r) => envelope(r).data.id === res.body.id,
    );

    const hook = await waitFor(() =>
      received.find((r) => envelope(r).data.id === res.body.id),
    );
    expect(atResponse).toEqual([]);
    expect(hook.contentType).toBe('application/json');
    expect(hook.signature).toBe(
      signWebhook({
        key,
        id: hook.id,
        timestamp: Number(hook.timestamp),
        body: hook.body,
      }),
    );
    expect(
      Math.abs(Number(hook.timestamp) - Math.floor(Date.now() / 1000)),
    ).toBeLessThanOrEqual(5);
    expect(Object.keys(envelope(hook))).toEqual(['type', 'occurredAt', 'data']);
    expect(envelope(hook)).toEqual({
      type: 'message.created',
      occurredAt: expect.stringMatching(ISO_DATE),
      data: res.body,
    });

    const delivery = await waitFor(async () => {
      const row = await deliveryOf(hook.id);
      return row?.status === 'SUCCEEDED' ? row : undefined;
    });
    expect(delivery).toMatchObject({
      eventType: 'message.created',
      payload: envelope(hook),
      attempts: 1,
      lastStatus: 204,
      lastError: null,
    });
    expect(delivery.history).toHaveLength(1);
    expect(delivery.history[0]).toMatchObject({
      attempt: 1,
      statusCode: 204,
      error: null,
    });
  });

  it('500, 500 e 204: 3 tentativas com o mesmo id e corpo, e SUCCEEDED', async () => {
    const bia = await join(`${PREFIX}Bia`);
    const counts = new Map<string, number>();
    respond = (r) => {
      if (envelope(r).data.content !== 'retentar') return 204;
      const n = (counts.get(r.id) ?? 0) + 1;
      counts.set(r.id, n);
      return n <= 2 ? 500 : 204;
    };

    const res = await send(bia.token, 'retentar').expect(201);

    const delivery = await waitFor(async () => {
      const hook = received.find((r) => envelope(r).data.id === res.body.id);
      const row = hook && (await deliveryOf(hook.id));
      return row?.status === 'SUCCEEDED' ? row : undefined;
    }, 12_000);

    const attempts = received.filter((r) => r.id === delivery.eventId);
    expect(attempts).toHaveLength(3);
    expect(new Set(attempts.map((r) => r.body)).size).toBe(1);
    for (const attempt of attempts) {
      expect(attempt.signature).toBe(
        signWebhook({
          key,
          id: attempt.id,
          timestamp: Number(attempt.timestamp),
          body: attempt.body,
        }),
      );
    }
    const [t1, t2, t3] = attempts.map((r) => Number(r.timestamp));
    expect(t2 - t1).toBeGreaterThanOrEqual(1);
    expect(t3 - t2).toBeGreaterThanOrEqual(5);

    expect(delivery).toMatchObject({
      eventType: 'message.created',
      attempts: 3,
      lastStatus: 204,
      lastError: null,
    });
    expect(
      delivery.history.map(({ attempt, statusCode, error }) => ({
        attempt,
        statusCode,
        error,
      })),
    ).toEqual([
      { attempt: 1, statusCode: 500, error: null },
      { attempt: 2, statusCode: 500, error: null },
      { attempt: 3, statusCode: 204, error: null },
    ]);
    for (const row of delivery.history) {
      expect(Number.isInteger(row.durationMs)).toBe(true);
      expect(row.durationMs).toBeGreaterThanOrEqual(0);
    }
  }, 15_000);

  it('POST /participants gera message.created (JOINED) e presence.changed com o online certo', async () => {
    const caio = await join(`${PREFIX}Caio`);
    const online = await prisma.participant.count({ where: { leftAt: null } });

    const joined = await waitFor(() =>
      received.find((r) => envelope(r).data.author?.id === caio.id),
    );
    const presence = await waitFor(() =>
      received.find((r) => envelope(r).type === 'presence.changed'),
    );

    expect(envelope(joined)).toEqual({
      type: 'message.created',
      occurredAt: expect.stringMatching(ISO_DATE),
      data: {
        id: expect.any(String),
        seq: expect.any(Number),
        type: 'JOINED',
        content: '',
        clientId: null,
        author: { id: caio.id, name: 'e2e-wh-Caio' },
        createdAt: expect.stringMatching(ISO_DATE),
      },
    });
    expect(envelope(presence)).toEqual({
      type: 'presence.changed',
      occurredAt: expect.stringMatching(ISO_DATE),
      data: { online },
    });
    expect(presence.id).not.toBe(joined.id);
  });

  it('o mesmo clientId duas vezes → dois 201 com o mesmo id, uma linha no banco e uma entrega', async () => {
    const eli = await join(`${PREFIX}Eli`);
    const clientId = randomUUID();

    const first = await send(eli.token, 'só uma vez', app, clientId).expect(
      201,
    );
    const second = await send(eli.token, 'só uma vez', app, clientId).expect(
      201,
    );

    expect(second.body.id).toBe(first.body.id);
    expect(second.body).toEqual(first.body);
    expect(
      await prisma.message.count({
        where: { participantId: eli.id, clientId },
      }),
    ).toBe(1);
    await waitFor(() =>
      received.find((r) => envelope(r).data.id === first.body.id),
    );
    // A second dispatch would be scheduled right after its response.
    await sleep(300);
    expect(
      received.filter((r) => envelope(r).data.id === first.body.id),
    ).toHaveLength(1);
    expect(
      await prisma.webhookDelivery.count({
        where: {
          eventType: 'message.created',
          payload: { path: ['data', 'id'], equals: first.body.id },
        },
      }),
    ).toBe(1);
  });

  it('com o servidor desligado, POST /messages responde 201; app.close() cancela a retentativa', async () => {
    const other = await createApp();
    const duda = await join(`${PREFIX}Duda`, other);
    await waitFor(() => (received.length >= 2 ? true : undefined));
    await stopServer();

    const res = await send(duda.token, 'sem destino', other);

    expect(res.status).toBe(201);
    const delivery = await waitFor(async () => {
      const row = await prisma.webhookDelivery.findFirst({
        where: { payload: { path: ['data', 'id'], equals: res.body.id } },
        include: { history: true },
      });
      // The include runs a second query: wait for both sides of the transaction.
      return row && row.history.length === 1 && row.attempts === 1
        ? row
        : undefined;
    });
    expect(delivery).toMatchObject({ status: 'PENDING', attempts: 1 });
    expect(delivery.history[0]).toMatchObject({
      attempt: 1,
      statusCode: null,
      error: 'fetch failed',
    });

    // The 1 s retry is pending; closing the app must cancel it.
    await other.close();
    await startServer();
    await sleep(1500);

    expect(received.filter((r) => r.id === delivery.eventId)).toEqual([]);
    expect((await deliveryOf(delivery.eventId))?.attempts).toBe(1);
  }, 10_000);
});
