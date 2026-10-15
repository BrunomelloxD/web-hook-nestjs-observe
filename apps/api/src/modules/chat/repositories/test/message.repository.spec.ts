import { Test } from '@nestjs/testing';
import { PrismaService } from '@/common/prisma/prisma.service.js';
import { makeMessage } from '../../test-fixtures.js';
import { MessageRepository } from '../message.repository.js';

const author = { participant: { select: { id: true, name: true } } };
// Beyond 2^31: a cursor squeezed through a 32-bit int would break.
const BIG = 3_000_000_000n;

describe('MessageRepository', () => {
  let repository: MessageRepository;
  const prisma = { message: { findMany: vi.fn(), create: vi.fn() } };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        MessageRepository,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    repository = module.get(MessageRepository);
  });

  describe('findPage', () => {
    const m = (seq: bigint) => makeMessage({ id: `id-${seq}`, seq });

    it('sem cursor: busca as limit de maior seq (desc) e devolve em ordem crescente', async () => {
      prisma.message.findMany.mockResolvedValue([
        m(BIG + 3n),
        m(BIG + 2n),
        m(BIG + 1n),
      ]);

      const page = await repository.findPage({ limit: 3 });

      expect(prisma.message.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { seq: 'desc' },
        take: 3,
        include: author,
      });
      expect(page.map((x) => x.seq)).toEqual([BIG + 1n, BIG + 2n, BIG + 3n]);
    });

    it('before: busca seq < before (desc) e devolve em ordem crescente', async () => {
      prisma.message.findMany.mockResolvedValue([m(BIG - 1n), m(BIG - 2n)]);

      const page = await repository.findPage({ limit: 2, before: BIG });

      expect(prisma.message.findMany).toHaveBeenCalledWith({
        where: { seq: { lt: BIG } },
        orderBy: { seq: 'desc' },
        take: 2,
        include: author,
      });
      expect(page.map((x) => x.seq)).toEqual([BIG - 2n, BIG - 1n]);
    });

    it('after: busca seq > after em ordem crescente, sem inverter', async () => {
      prisma.message.findMany.mockResolvedValue([m(BIG + 1n), m(BIG + 2n)]);

      const page = await repository.findPage({ limit: 2, after: BIG });

      expect(prisma.message.findMany).toHaveBeenCalledWith({
        where: { seq: { gt: BIG } },
        orderBy: { seq: 'asc' },
        take: 2,
        include: author,
      });
      expect(page.map((x) => x.seq)).toEqual([BIG + 1n, BIG + 2n]);
    });
  });

  it('create grava uma mensagem USER com participantId, content e clientId, incluindo o autor', async () => {
    const created = makeMessage({
      clientId: '0b8f7c6d-5e4a-4b3c-9d2e-1f0a9b8c7d6e',
    });
    prisma.message.create.mockResolvedValue(created);

    const result = await repository.create({
      participantId: '7d9f1e2a-4b3c-4d5e-9f60-1a2b3c4d5e6f',
      content: 'olá',
      clientId: '0b8f7c6d-5e4a-4b3c-9d2e-1f0a9b8c7d6e',
    });

    expect(prisma.message.create).toHaveBeenCalledWith({
      data: {
        type: 'USER',
        participantId: '7d9f1e2a-4b3c-4d5e-9f60-1a2b3c4d5e6f',
        content: 'olá',
        clientId: '0b8f7c6d-5e4a-4b3c-9d2e-1f0a9b8c7d6e',
      },
      include: author,
    });
    expect(result).toBe(created);
  });
});
