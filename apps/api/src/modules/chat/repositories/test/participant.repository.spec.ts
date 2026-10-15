import { Test } from '@nestjs/testing';
import { PrismaService } from '@/common/prisma/prisma.service.js';
import { makeMessage, makeParticipant } from '../../test-fixtures.js';
import { ParticipantRepository } from '../participant.repository.js';

const BIA_ID = '7d9f1e2a-4b3c-4d5e-9f60-1a2b3c4d5e6f';
const author = { participant: { select: { id: true, name: true } } };

describe('ParticipantRepository', () => {
  let repository: ParticipantRepository;
  // Writes inside a transaction must go through tx, never through prisma.
  const tx = {
    participant: { create: vi.fn(), update: vi.fn() },
    message: { create: vi.fn() },
  };
  const prisma = {
    $transaction: vi.fn(),
    participant: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    message: { create: vi.fn() },
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    prisma.$transaction.mockImplementation(
      (fn: (client: typeof tx) => unknown) => fn(tx),
    );

    const module = await Test.createTestingModule({
      providers: [
        ParticipantRepository,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    repository = module.get(ParticipantRepository);
  });

  describe('createWithJoinMessage', () => {
    it('cria o participante e a mensagem JOINED vazia com o mesmo participantId, na transação', async () => {
      const bia = makeParticipant({ id: BIA_ID, name: 'Bia', nameKey: 'bia' });
      const joined = makeMessage({
        type: 'JOINED',
        content: '',
        participantId: BIA_ID,
        participant: { id: BIA_ID, name: 'Bia' },
      });
      tx.participant.create.mockResolvedValue(bia);
      tx.message.create.mockResolvedValue(joined);

      const result = await repository.createWithJoinMessage({
        name: 'Bia',
        nameKey: 'bia',
        tokenHash: 'b'.repeat(64),
      });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(tx.participant.create).toHaveBeenCalledWith({
        data: { name: 'Bia', nameKey: 'bia', tokenHash: 'b'.repeat(64) },
      });
      expect(tx.message.create).toHaveBeenCalledWith({
        data: { type: 'JOINED', content: '', participantId: BIA_ID },
        include: author,
      });
      expect(prisma.participant.create).not.toHaveBeenCalled();
      expect(prisma.message.create).not.toHaveBeenCalled();
      expect(result).toEqual({ participant: bia, message: joined });
    });

    it('propaga o erro do banco (ex.: P2002 do nome em uso)', async () => {
      const conflict = new Error('P2002');
      tx.participant.create.mockRejectedValue(conflict);

      await expect(
        repository.createWithJoinMessage({
          name: 'ANA',
          nameKey: 'ana',
          tokenHash: 'c'.repeat(64),
        }),
      ).rejects.toBe(conflict);
      expect(tx.message.create).not.toHaveBeenCalled();
    });
  });

  describe('leaveWithMessage', () => {
    afterEach(() => vi.useRealTimers());

    it('preenche leftAt com o instante atual e cria a mensagem LEFT, na mesma transação', async () => {
      const now = new Date('2026-10-14T12:34:56.000Z');
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(now);
      const left = makeMessage({
        type: 'LEFT',
        content: '',
        participantId: BIA_ID,
        participant: { id: BIA_ID, name: 'Bia' },
      });
      tx.participant.update.mockResolvedValue(
        makeParticipant({ id: BIA_ID, leftAt: now }),
      );
      tx.message.create.mockResolvedValue(left);

      const result = await repository.leaveWithMessage(BIA_ID);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(tx.participant.update).toHaveBeenCalledWith({
        where: { id: BIA_ID },
        data: { leftAt: now },
      });
      expect(tx.message.create).toHaveBeenCalledWith({
        data: { type: 'LEFT', content: '', participantId: BIA_ID },
        include: author,
      });
      expect(prisma.participant.update).not.toHaveBeenCalled();
      expect(prisma.message.create).not.toHaveBeenCalled();
      expect(result).toBe(left);
    });
  });

  it('findById busca pelo id', async () => {
    const bia = makeParticipant({ id: BIA_ID });
    prisma.participant.findUnique.mockResolvedValue(bia);

    await expect(repository.findById(BIA_ID)).resolves.toBe(bia);
    expect(prisma.participant.findUnique).toHaveBeenCalledWith({
      where: { id: BIA_ID },
    });
  });

  it('findActiveByTokenHash filtra pelo hash e por leftAt null', async () => {
    const ana = makeParticipant();
    prisma.participant.findFirst.mockResolvedValue(ana);

    await expect(
      repository.findActiveByTokenHash('d'.repeat(64)),
    ).resolves.toBe(ana);
    expect(prisma.participant.findFirst).toHaveBeenCalledWith({
      where: { tokenHash: 'd'.repeat(64), leftAt: null },
    });
  });

  it('listOnline devolve id e nome dos online, por joinedAt crescente', async () => {
    const online = [
      { id: '550e8400-e29b-41d4-a716-446655440000', name: 'Ana' },
      { id: BIA_ID, name: 'Bia' },
    ];
    prisma.participant.findMany.mockResolvedValue(online);

    await expect(repository.listOnline()).resolves.toBe(online);
    expect(prisma.participant.findMany).toHaveBeenCalledWith({
      where: { leftAt: null },
      select: { id: true, name: true },
      orderBy: { joinedAt: 'asc' },
    });
  });

  it('countOnline conta só quem tem leftAt null', async () => {
    prisma.participant.count.mockResolvedValue(3);

    await expect(repository.countOnline()).resolves.toBe(3);
    expect(prisma.participant.count).toHaveBeenCalledWith({
      where: { leftAt: null },
    });
  });
});
