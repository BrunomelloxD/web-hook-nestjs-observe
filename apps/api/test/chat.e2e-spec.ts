import { createHash, randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '@/app/app.module.js';
import { setupApp } from '@/app/app.setup.js';
import { PrismaService } from '@/common/prisma/prisma.service.js';
import { WebhookDispatcher } from '@/modules/webhooks/services/webhook-dispatcher.service.js';

// Requires the database: docker compose up -d database
const PREFIX = 'e2e-api-';
// The 2-character boundary name cannot carry the prefix.
const SHORT_NAME = 'Q9';
// 20 characters whose name key has 40 ('İ' lowercases to 'i' + U+0307).
// It cannot carry the prefix either.
const EXPANDING_NAME = 'İ'.repeat(20);
const CHAT = '/api/v1/chat';
const TOKEN_HEADER = 'X-Participant-Token';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');

interface Joined {
  id: string;
  name: string;
  token: string;
  joinedAt: string;
}

describe('Chat (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const http = () => request(app.getHttpServer());

  const ours = {
    OR: [
      { name: { startsWith: PREFIX, mode: 'insensitive' as const } },
      { name: SHORT_NAME },
      { name: EXPANDING_NAME },
    ],
  };

  async function cleanup() {
    await prisma.message.deleteMany({ where: { participant: ours } });
    await prisma.participant.deleteMany({ where: ours });
  }

  async function join(name: string): Promise<Joined> {
    const res = await http()
      .post(`${CHAT}/participants`)
      .send({ name })
      .expect(201);
    return res.body as Joined;
  }

  const send = (token: string | undefined, body: object) => {
    const req = http().post(`${CHAT}/messages`);
    return token === undefined
      ? req.send(body)
      : req.set(TOKEN_HEADER, token).send(body);
  };

  const leave = (id: string, token?: string) => {
    const req = http().post(`${CHAT}/participants/${id}/leave`);
    return token === undefined ? req.send() : req.set(TOKEN_HEADER, token);
  };

  const onlineByKey = (nameKey: string) =>
    prisma.participant.count({ where: { nameKey, leftAt: null } });

  beforeAll(async () => {
    // Delivery is covered by webhooks.e2e-spec.ts; here it would only leave
    // deliveries behind and retry against a closed port.
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(WebhookDispatcher)
      .useValue({ dispatch: () => undefined })
      .compile();

    app = moduleRef.createNestApplication({ logger: false });
    setupApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  describe('POST /chat/participants', () => {
    let ana: Joined;

    it('201 com o nome depois do trim e o token; grava só o hash e a mensagem JOINED', async () => {
      ana = await join('  e2e-api-Ana  ');

      expect(ana).toEqual({
        id: expect.stringMatching(UUID),
        name: 'e2e-api-Ana',
        token: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
        joinedAt: expect.stringMatching(ISO_DATE),
      });

      const stored = await prisma.participant.findUniqueOrThrow({
        where: { id: ana.id },
      });
      expect(stored.name).toBe('e2e-api-Ana');
      expect(stored.nameKey).toBe('e2e-api-ana');
      expect(stored.tokenHash).toBe(sha256(ana.token));
      expect(stored.leftAt).toBeNull();
      expect(stored.joinedAt.toISOString()).toBe(ana.joinedAt);

      const messages = await prisma.message.findMany({
        where: { participantId: ana.id },
      });
      expect(messages).toHaveLength(1);
      expect(messages[0].type).toBe('JOINED');
      expect(messages[0].content).toBe('');
    });

    it('409 para "e2e-api-ana" com "e2e-api-Ana" online, sem criar outro', async () => {
      const res = await http()
        .post(`${CHAT}/participants`)
        .send({ name: 'e2e-api-ana' });

      expect(res.status).toBe(409);
      expect(res.body.statusCode).toBe(409);
      expect(await onlineByKey('e2e-api-ana')).toBe(1);
    });

    it('"e2e-api-Bia" e "E2E-API-BIA" ao mesmo tempo → um 201 e um 409', async () => {
      const responses = await Promise.all(
        ['e2e-api-Bia', 'E2E-API-BIA'].map((name) =>
          http().post(`${CHAT}/participants`).send({ name }),
        ),
      );

      expect(responses.map((r) => r.status).sort((a, b) => a - b)).toEqual([
        201, 409,
      ]);
      expect(await onlineByKey('e2e-api-bia')).toBe(1);
    });

    it.each([
      ['2 caracteres', SHORT_NAME],
      ['20 caracteres', `${PREFIX}Abcdefghijkl`],
    ])('aceita nome com %s', async (_case, name) => {
      expect(name).toHaveLength(name === SHORT_NAME ? 2 : 20);

      const joined = await join(name);

      expect(joined.name).toBe(name);
      expect(await onlineByKey(name.toLowerCase())).toBe(1);
    });

    it('201 para 20 caracteres cuja chave cresce no lowercase; o mesmo nome de novo → 409', async () => {
      expect(EXPANDING_NAME).toHaveLength(20);

      const res = await http()
        .post(`${CHAT}/participants`)
        .send({ name: EXPANDING_NAME });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe(EXPANDING_NAME);
      const key = EXPANDING_NAME.toLowerCase();
      expect(key).toHaveLength(40);
      expect(await onlineByKey(key)).toBe(1);

      const again = await http()
        .post(`${CHAT}/participants`)
        .send({ name: EXPANDING_NAME });

      expect(again.status).toBe(409);
      expect(again.body.statusCode).toBe(409);
      expect(await onlineByKey(key)).toBe(1);
    });

    it.each([
      ['1 caractere', 'Q'],
      ['21 caracteres', `${PREFIX}Abcdefghijklm`],
      ['caractere proibido', 'e2e-api-Ana!'],
      ['só espaços', '     '],
    ])('400 para nome com %s, sem gravar', async (_case, name) => {
      // Rows left by others may already carry the name: compare before/after.
      const stored = () =>
        prisma.participant.count({ where: { name: name.trim() } });
      const before = await stored();

      const res = await http().post(`${CHAT}/participants`).send({ name });

      expect(res.status).toBe(400);
      expect(res.body.statusCode).toBe(400);
      expect(await stored()).toBe(before);
    });

    it('400 sem o campo name', async () => {
      await http().post(`${CHAT}/participants`).send({}).expect(400);
    });
  });

  describe('GET /chat/participants/online', () => {
    it('lista quem está online por ordem de entrada, com total', async () => {
      const first = await join(`${PREFIX}Ola`);
      const second = await join(`${PREFIX}Ugo`);
      const gone = await join(`${PREFIX}Ivo`);
      await leave(gone.id, gone.token).expect(204);

      const res = await http().get(`${CHAT}/participants/online`).expect(200);

      const items = res.body.items as { id: string; name: string }[];
      expect(res.body.total).toBe(items.length);
      expect(res.body.total).toBe(
        await prisma.participant.count({ where: { leftAt: null } }),
      );
      const mine = items.filter((p) =>
        [first.id, second.id, gone.id].includes(p.id),
      );
      expect(mine).toEqual([
        { id: first.id, name: 'e2e-api-Ola' },
        { id: second.id, name: 'e2e-api-Ugo' },
      ]);
    });
  });

  describe('GET /chat/messages', () => {
    let author: Joined;
    const seqs: number[] = [];

    beforeAll(async () => {
      author = await join(`${PREFIX}Leo`);
      for (const content of ['m1', 'm2', 'm3', 'm4']) {
        const res = await send(author.token, { content }).expect(201);
        seqs.push(res.body.seq);
      }
    });

    const list = (query: Record<string, string | number>) =>
      http().get(`${CHAT}/messages`).query(query);

    it('sem cursor: as `limit` de maior seq, em ordem crescente, com seq numérico', async () => {
      const res = await list({ limit: 2 }).expect(200);

      expect(res.body.items).toEqual([
        {
          id: expect.stringMatching(UUID),
          seq: seqs[2],
          type: 'USER',
          content: 'm3',
          clientId: null,
          author: { id: author.id, name: 'e2e-api-Leo' },
          createdAt: expect.stringMatching(ISO_DATE),
        },
        expect.objectContaining({ seq: seqs[3], content: 'm4' }),
      ]);
      expect(typeof res.body.items[0].seq).toBe('number');
      const stored = await prisma.message.findUniqueOrThrow({
        where: { id: res.body.items[0].id },
      });
      expect(Number(stored.seq)).toBe(res.body.items[0].seq);
    });

    it('com before: as `limit` de maior seq abaixo do cursor, em ordem crescente', async () => {
      const res = await list({ limit: 2, before: seqs[3] }).expect(200);

      expect(res.body.items.map((m: { content: string }) => m.content)).toEqual(
        ['m2', 'm3'],
      );
      expect(res.body.items.map((m: { seq: number }) => m.seq)).toEqual([
        seqs[1],
        seqs[2],
      ]);
    });

    it('com after: as `limit` de menor seq acima do cursor, em ordem crescente', async () => {
      const res = await list({ limit: 2, after: seqs[0] }).expect(200);

      expect(res.body.items.map((m: { content: string }) => m.content)).toEqual(
        ['m2', 'm3'],
      );
      expect(res.body.items.map((m: { seq: number }) => m.seq)).toEqual([
        seqs[1],
        seqs[2],
      ]);
    });

    it('400 com before e after juntos', async () => {
      const res = await list({ before: seqs[3], after: seqs[0] });

      expect(res.status).toBe(400);
      expect(res.body.statusCode).toBe(400);
    });

    it.each([
      ['limit=0', { limit: 0 }],
      ['limit=101', { limit: 101 }],
      ['before=-1', { before: -1 }],
      ['before=0', { before: 0 }],
      ['before=abc', { before: 'abc' }],
    ])('400 com %s', async (_case, query) => {
      const res = await list(query);

      expect(res.status).toBe(400);
      expect(res.body.statusCode).toBe(400);
    });
  });

  describe('POST /chat/messages', () => {
    let ana: Joined;
    let bia: Joined;

    beforeAll(async () => {
      ana = await join(`${PREFIX}Ada`);
      bia = await join(`${PREFIX}Bel`);
    });

    const countBy = (participantId: string) =>
      prisma.message.count({ where: { participantId, type: 'USER' } });

    it('201: grava USER com o conteúdo depois do trim e o autor do token', async () => {
      const clientId = randomUUID();

      const res = await send(bia.token, {
        content: '  olá, mundo  ',
        clientId,
      }).expect(201);

      expect(res.body).toEqual({
        id: expect.stringMatching(UUID),
        seq: expect.any(Number),
        type: 'USER',
        content: 'olá, mundo',
        clientId,
        author: { id: bia.id, name: 'e2e-api-Bel' },
        createdAt: expect.stringMatching(ISO_DATE),
      });
      const stored = await prisma.message.findUniqueOrThrow({
        where: { id: res.body.id },
      });
      expect(stored.type).toBe('USER');
      expect(stored.content).toBe('olá, mundo');
      expect(stored.participantId).toBe(bia.id);
      expect(stored.clientId).toBe(clientId);
      expect(Number(stored.seq)).toBe(res.body.seq);
      expect(await countBy(ana.id)).toBe(0);
    });

    it('201 sem clientId grava clientId null', async () => {
      const res = await send(ana.token, { content: 'sem id' }).expect(201);

      expect(res.body.clientId).toBeNull();
      expect(res.body.author).toEqual({ id: ana.id, name: 'e2e-api-Ada' });
    });

    it('aceita conteúdo com exatamente 1000 caracteres', async () => {
      const content = 'a'.repeat(1000);

      const res = await send(ana.token, { content }).expect(201);

      expect(res.body.content).toBe(content);
    });

    it.each([
      ['1001 caracteres', { content: 'a'.repeat(1001) }],
      ['conteúdo vazio', { content: '' }],
      ['só espaços', { content: '   ' }],
      ['sem content', {}],
      ['clientId que não é uuid', { content: 'oi', clientId: 'abc' }],
    ])('400 com %s, sem gravar', async (_case, body) => {
      const before = await countBy(ana.id);

      const res = await send(ana.token, body);

      expect(res.status).toBe(400);
      expect(res.body.statusCode).toBe(400);
      expect(await countBy(ana.id)).toBe(before);
    });

    describe('401 sem um token válido de quem está online', () => {
      it.each([
        ['header ausente', () => undefined],
        ['header vazio', () => ''],
        ['token desconhecido', () => 'x'.repeat(43)],
        ['token com um caractere trocado', () => tamper(ana.token)],
        ['token com prefixo Bearer', () => `Bearer ${ana.token}`],
        ['token com texto a mais', () => `${ana.token} ${ana.token}`],
      ])('%s', async (_case, token) => {
        const before = await countBy(ana.id);

        const res = await send(token(), { content: 'oi' });

        expect(res.status).toBe(401);
        expect(res.body.statusCode).toBe(401);
        expect(await countBy(ana.id)).toBe(before);
      });

      it('token só no header Authorization', async () => {
        const res = await http()
          .post(`${CHAT}/messages`)
          .set('Authorization', `Bearer ${ana.token}`)
          .send({ content: 'oi' });

        expect(res.status).toBe(401);
      });

      it('token de quem saiu', async () => {
        const gone = await join(`${PREFIX}Gil`);
        await leave(gone.id, gone.token).expect(204);

        const res = await send(gone.token, { content: 'oi' });

        expect(res.status).toBe(401);
        expect(res.body.statusCode).toBe(401);
        expect(await countBy(gone.id)).toBe(0);
      });
    });
  });

  describe('POST /chat/participants/:id/leave', () => {
    let duda: Joined;
    let eva: Joined;

    beforeAll(async () => {
      duda = await join(`${PREFIX}Duda`);
      eva = await join(`${PREFIX}Eva`);
    });

    const leftAt = async (id: string) =>
      (await prisma.participant.findUniqueOrThrow({ where: { id } })).leftAt;

    it('401 sem o header', async () => {
      const res = await leave(duda.id);

      expect(res.status).toBe(401);
      expect(await leftAt(duda.id)).toBeNull();
    });

    it('401 com o token de outro participante, sem marcar a saída', async () => {
      const res = await leave(duda.id, eva.token);

      expect(res.status).toBe(401);
      expect(res.body.statusCode).toBe(401);
      expect(await leftAt(duda.id)).toBeNull();
      expect(await leftAt(eva.id)).toBeNull();
    });

    it('404 para id inexistente', async () => {
      const res = await leave(randomUUID(), duda.token);

      expect(res.status).toBe(404);
      expect(res.body.statusCode).toBe(404);
      expect(await leftAt(duda.id)).toBeNull();
    });

    it('400 para id que não é uuid', async () => {
      const res = await leave('nao-e-uuid', duda.token);

      expect(res.status).toBe(400);
    });

    it('204 com o próprio token: preenche leftAt e grava LEFT', async () => {
      const res = await leave(duda.id, duda.token);

      expect(res.status).toBe(204);
      expect(res.body).toEqual({});
      expect(await leftAt(duda.id)).toBeInstanceOf(Date);
      const last = await prisma.message.findFirstOrThrow({
        where: { participantId: duda.id },
        orderBy: { seq: 'desc' },
      });
      expect(last.type).toBe('LEFT');
      expect(last.content).toBe('');
      expect(await leftAt(eva.id)).toBeNull();
    });

    it('sair duas vezes → 401', async () => {
      const res = await leave(duda.id, duda.token);

      expect(res.status).toBe(401);
      expect(
        await prisma.message.count({
          where: { participantId: duda.id, type: 'LEFT' },
        }),
      ).toBe(1);
    });

    it('o nome fica livre depois da saída', async () => {
      const again = await join('e2e-api-DUDA');

      expect(again.name).toBe('e2e-api-DUDA');
      expect(again.id).not.toBe(duda.id);
    });
  });

  describe('rate limit (AD-004)', () => {
    const CALLS = 61;

    it(`${CALLS} envios seguidos não recebem 429; sem limit, GET /messages devolve as 50 últimas`, async () => {
      const sender = await join(`${PREFIX}Rui`);
      const statuses: number[] = [];
      for (let i = 1; i <= CALLS; i++) {
        statuses.push((await send(sender.token, { content: `r${i}` })).status);
      }

      expect(statuses).toEqual(Array(CALLS).fill(201));
      const res = await http().get(`${CHAT}/messages`).expect(200);
      expect(res.body.items).toHaveLength(50);
      expect(res.body.items.at(-1).content).toBe(`r${CALLS}`);
      expect(res.body.items[0].content).toBe(`r${CALLS - 49}`);
    });

    it(`${CALLS} leituras seguidas de /participants/online não recebem 429`, async () => {
      const statuses: number[] = [];
      for (let i = 0; i < CALLS; i++) {
        statuses.push((await http().get(`${CHAT}/participants/online`)).status);
      }

      expect(statuses).toEqual(Array(CALLS).fill(200));
    });
  });
});

/** Same length and alphabet, different last character. */
function tamper(token: string): string {
  const last = token.at(-1) === 'A' ? 'B' : 'A';
  return `${token.slice(0, -1)}${last}`;
}
