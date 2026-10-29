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
const PREFIX = 'e2e-ty-';
const CHAT = '/api/v1/chat';
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

interface Received {
  id: string;
  timestamp: string;
  signature: string;
  body: string;
}

interface Envelope {
  type: string;
  occurredAt: string;
  data: { participant?: { id: string; name: string } };
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

describe('Typing (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let key: Buffer;
  let server: Server;
  let received: Received[] = [];
  let respond: (request: Received) => number = () => 204;
  const participantIds: string[] = [];

  const envelope = (r: Received) => JSON.parse(r.body) as Envelope;

  /** typing.started webhooks received for one participant. */
  const typingOf = (participantId: string) =>
    received.filter(
      (r) =>
        envelope(r).type === 'typing.started' &&
        envelope(r).data.participant?.id === participantId,
    );

  /** typing.started rows in webhook_deliveries for one participant. */
  const deliveriesOf = (participantId: string) =>
    prisma.webhookDelivery.findMany({
      where: {
        eventType: 'typing.started',
        payload: { path: ['data', 'participant', 'id'], equals: participantId },
      },
      include: { history: true },
    });

  function startServer(): Promise<void> {
    server = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        const entry: Received = {
          id: header(req.headers, 'webhook-id'),
          timestamp: header(req.headers, 'webhook-timestamp'),
          signature: header(req.headers, 'webhook-signature'),
          body: Buffer.concat(chunks).toString('utf8'),
        };
        received.push(entry);
        res.statusCode = respond(entry);
        res.end();
      });
    });
    return new Promise((resolve) => server.listen(PORT, resolve));
  }

  async function join(name: string) {
    const res = await request(app.getHttpServer())
      .post(`${CHAT}/participants`)
      .send({ name })
      .expect(201);
    participantIds.push(res.body.id);
    return res.body as { id: string; token: string };
  }

  const typing = (token: string) =>
    request(app.getHttpServer())
      .post(`${CHAT}/typing`)
      .set('X-Participant-Token', token);

  async function cleanup() {
    const ours = { name: { startsWith: PREFIX } };
    const participants = await prisma.participant.findMany({
      where: ours,
      select: { id: true },
    });
    const ids = [
      ...new Set([...participantIds, ...participants.map((p) => p.id)]),
    ];
    await prisma.webhookDelivery.deleteMany({
      where: {
        OR: ids.flatMap((id) => [
          { payload: { path: ['data', 'participant', 'id'], equals: id } },
          { payload: { path: ['data', 'author', 'id'], equals: id } },
        ]),
      },
    });
    await prisma.message.deleteMany({ where: { participant: ours } });
    await prisma.participant.deleteMany({ where: ours });
  }

  beforeAll(async () => {
    await startServer();
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication<INestApplication<App>>({
      logger: false,
    });
    setupApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    key = decodeSecret(app.get(AppConfigService).webhookSecret);
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });

  beforeEach(() => {
    received = [];
    respond = () => 204;
  });

  it('token válido → 204 sem corpo; o servidor recebe typing.started assinado com { participant: { id, name } }', async () => {
    const ana = await join(`${PREFIX}Ana`);

    const res = await typing(ana.token).expect(204);

    expect(res.text).toBe('');
    const [hook] = await waitFor(() => {
      const hooks = typingOf(ana.id);
      return hooks.length > 0 ? hooks : undefined;
    });
    expect(hook.signature).toBe(
      signWebhook({
        key,
        id: hook.id,
        timestamp: Number(hook.timestamp),
        body: hook.body,
      }),
    );
    expect(envelope(hook)).toEqual({
      type: 'typing.started',
      occurredAt: expect.stringMatching(ISO_DATE),
      data: { participant: { id: ana.id, name: 'e2e-ty-Ana' } },
    });

    const [delivery] = await waitFor(async () => {
      const rows = await deliveriesOf(ana.id);
      return rows[0]?.status === 'SUCCEEDED' ? rows : undefined;
    });
    expect(delivery).toMatchObject({
      eventId: hook.id,
      eventType: 'typing.started',
      attempts: 1,
      lastStatus: 204,
    });
  });

  it('token inválido → 401 e nenhum webhook', async () => {
    await typing('token-que-nao-existe').expect(401);
    await request(app.getHttpServer()).post(`${CHAT}/typing`).expect(401);

    await sleep(300);
    expect(
      received.filter((r) => envelope(r).type === 'typing.started'),
    ).toEqual([]);
  });

  it('segunda chamada a menos de 2 s → 204 sem nova entrega em webhook_deliveries', async () => {
    const bia = await join(`${PREFIX}Bia`);

    await typing(bia.token).expect(204);
    await waitFor(async () => {
      const rows = await deliveriesOf(bia.id);
      return rows[0]?.status === 'SUCCEEDED' ? rows : undefined;
    });

    await typing(bia.token).expect(204);
    // A second dispatch would be scheduled right after its response.
    await sleep(300);

    expect(await deliveriesOf(bia.id)).toHaveLength(1);
    expect(typingOf(bia.id)).toHaveLength(1);
  });

  it('servidor responde 500 → a entrega fica FAILED com attempts = 1, sem retentativa', async () => {
    const caio = await join(`${PREFIX}Caio`);
    respond = (r) => (envelope(r).type === 'typing.started' ? 500 : 204);

    await typing(caio.token).expect(204);

    const [delivery] = await waitFor(async () => {
      const rows = await deliveriesOf(caio.id);
      return rows[0]?.status === 'FAILED' ? rows : undefined;
    });
    expect(delivery).toMatchObject({ attempts: 1, lastStatus: 500 });
    expect(delivery.history).toHaveLength(1);

    // The first retry of other events comes 1 s later; none comes here.
    await sleep(1500);
    expect(typingOf(caio.id)).toHaveLength(1);
    expect((await deliveriesOf(caio.id))[0].attempts).toBe(1);
  }, 10_000);
});
