import { Test } from '@nestjs/testing';
import { PrismaService } from '@/common/prisma/prisma.service.js';
import { WebhookDeliveryRepository } from '../webhook-delivery.repository.js';

const DELIVERY_ID = '3b2a1c0d-9e8f-4a7b-8c6d-5e4f3a2b1c0d';
const EVENT_ID = 'c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f';

describe('WebhookDeliveryRepository', () => {
  let repository: WebhookDeliveryRepository;
  // Writes inside a transaction must go through tx, never through prisma.
  const tx = {
    webhookDelivery: { update: vi.fn() },
    webhookDeliveryAttempt: { create: vi.fn() },
  };
  const prisma = {
    $transaction: vi.fn(),
    webhookDelivery: { create: vi.fn(), update: vi.fn() },
    webhookDeliveryAttempt: { create: vi.fn() },
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    prisma.$transaction.mockImplementation(
      (fn: (client: typeof tx) => unknown) => fn(tx),
    );

    const module = await Test.createTestingModule({
      providers: [
        WebhookDeliveryRepository,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    repository = module.get(WebhookDeliveryRepository);
  });

  describe('create', () => {
    it('grava eventId, eventType e o envelope inteiro como payload, e devolve a entrega', async () => {
      const payload = {
        type: 'presence.changed',
        occurredAt: '2026-10-14T12:00:00.000Z',
        data: { online: 3 },
      };
      const stored = {
        id: DELIVERY_ID,
        eventId: EVENT_ID,
        eventType: 'presence.changed',
        payload,
        status: 'PENDING',
        attempts: 0,
        lastStatus: null,
        lastError: null,
      };
      prisma.webhookDelivery.create.mockResolvedValue(stored);

      const result = await repository.create({
        eventId: EVENT_ID,
        eventType: 'presence.changed',
        payload,
      });

      expect(prisma.webhookDelivery.create).toHaveBeenCalledWith({
        data: { eventId: EVENT_ID, eventType: 'presence.changed', payload },
      });
      expect(result).toBe(stored);
    });
  });

  describe('recordAttempt', () => {
    it('falha com status: insere a tentativa e atualiza attempts, lastStatus e lastError, na mesma transação', async () => {
      await expect(
        repository.recordAttempt(DELIVERY_ID, {
          number: 2,
          statusCode: 500,
          durationMs: 37,
          error: null,
        }),
      ).resolves.toBeUndefined();

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(tx.webhookDeliveryAttempt.create).toHaveBeenCalledWith({
        data: {
          deliveryId: DELIVERY_ID,
          attempt: 2,
          statusCode: 500,
          durationMs: 37,
          error: null,
        },
      });
      expect(tx.webhookDelivery.update).toHaveBeenCalledWith({
        where: { id: DELIVERY_ID },
        data: { attempts: 2, lastStatus: 500, lastError: null },
      });
      expect(prisma.webhookDeliveryAttempt.create).not.toHaveBeenCalled();
      expect(prisma.webhookDelivery.update).not.toHaveBeenCalled();
    });

    it('sem resposta: statusCode null e o erro gravados na tentativa e na entrega', async () => {
      await repository.recordAttempt(DELIVERY_ID, {
        number: 6,
        statusCode: null,
        durationMs: 5000,
        error: 'timeout',
      });

      expect(tx.webhookDeliveryAttempt.create).toHaveBeenCalledWith({
        data: {
          deliveryId: DELIVERY_ID,
          attempt: 6,
          statusCode: null,
          durationMs: 5000,
          error: 'timeout',
        },
      });
      expect(tx.webhookDelivery.update).toHaveBeenCalledWith({
        where: { id: DELIVERY_ID },
        data: { attempts: 6, lastStatus: null, lastError: 'timeout' },
      });
    });

    it('propaga o erro do banco e não atualiza a entrega se a tentativa falha', async () => {
      const failure = new Error('P2002');
      tx.webhookDeliveryAttempt.create.mockRejectedValueOnce(failure);

      await expect(
        repository.recordAttempt(DELIVERY_ID, {
          number: 1,
          statusCode: 204,
          durationMs: 4,
          error: null,
        }),
      ).rejects.toBe(failure);
      expect(tx.webhookDelivery.update).not.toHaveBeenCalled();
    });
  });

  describe('markStatus', () => {
    it.each(['SUCCEEDED', 'FAILED'] as const)(
      'grava o status %s na entrega',
      async (status) => {
        await expect(
          repository.markStatus(DELIVERY_ID, status),
        ).resolves.toBeUndefined();

        expect(prisma.webhookDelivery.update).toHaveBeenCalledWith({
          where: { id: DELIVERY_ID },
          data: { status },
        });
      },
    );
  });
});
