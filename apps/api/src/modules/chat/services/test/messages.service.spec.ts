import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Mocked } from 'vitest';
import { Prisma } from '@/generated/prisma/client.js';
import { WebhookDispatcher } from '@/modules/webhooks/services/webhook-dispatcher.service.js';
import { RateLimitedException } from '../../filters/rate-limited-exception.filter.js';
import { IMessageRepository } from '../../repositories/message.repository.interface.js';
import { makeMessage, makeParticipant } from '../../test-fixtures.js';
import { MessagesService } from '../messages.service.js';
import { SendRateLimiter } from '../send-rate-limiter.js';
import { TypingService } from '../typing.service.js';

const BIA_ID = '7d9f1e2a-4b3c-4d5e-9f60-1a2b3c4d5e6f';
const CLIENT_ID = '0b8f7c6d-5e4a-4b3c-9d2e-1f0a9b8c7d6e';
const NOW = 1_791_979_200_000;

function prismaError(code: string) {
  return new Prisma.PrismaClientKnownRequestError('erro', {
    code,
    clientVersion: 'test',
  });
}

describe('MessagesService', () => {
  let service: MessagesService;
  let repository: Mocked<IMessageRepository>;
  let dispatcher: { dispatch: ReturnType<typeof vi.fn> };
  let limiter: { tryAcquire: ReturnType<typeof vi.fn> };
  let typing: TypingService;

  /** typing.started dispatches so far (the real TypingService on the dispatcher mock). */
  const typingDispatches = () =>
    dispatcher.dispatch.mock.calls.filter(([type]) => type === 'typing.started')
      .length;

  beforeEach(async () => {
    repository = {
      findPage: vi.fn(),
      findByClientId: vi.fn(),
      create: vi.fn(),
    };
    dispatcher = { dispatch: vi.fn() };
    limiter = { tryAcquire: vi.fn().mockReturnValue({ ok: true }) };

    const module = await Test.createTestingModule({
      providers: [
        MessagesService,
        { provide: IMessageRepository, useValue: repository },
        { provide: WebhookDispatcher, useValue: dispatcher },
        { provide: SendRateLimiter, useValue: limiter },
        TypingService,
      ],
    }).compile();

    service = module.get(MessagesService);
    typing = module.get(TypingService);
  });

  describe('list', () => {
    it('before e after juntos → BadRequestException, sem consultar o repositório', async () => {
      await expect(
        service.list({ limit: 50, before: 10, after: 5 }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repository.findPage).not.toHaveBeenCalled();
    });

    it('sem cursor: repassa o limit e devolve os itens mapeados, na ordem do repositório', async () => {
      repository.findPage.mockResolvedValue([
        makeMessage({
          id: 'a',
          seq: 1039n,
          createdAt: new Date('2026-10-14T12:00:00.000Z'),
        }),
        makeMessage({
          id: 'b',
          seq: 1040n,
          createdAt: new Date('2026-10-14T12:00:01.000Z'),
        }),
      ]);

      const result = await service.list({ limit: 50 });

      expect(repository.findPage).toHaveBeenCalledWith({
        limit: 50,
        before: undefined,
        after: undefined,
      });
      expect(result).toEqual({
        items: [
          {
            id: 'a',
            seq: 1039,
            type: 'USER',
            content: 'olá',
            clientId: null,
            author: { id: '550e8400-e29b-41d4-a716-446655440000', name: 'Ana' },
            createdAt: '2026-10-14T12:00:00.000Z',
          },
          {
            id: 'b',
            seq: 1040,
            type: 'USER',
            content: 'olá',
            clientId: null,
            author: { id: '550e8400-e29b-41d4-a716-446655440000', name: 'Ana' },
            createdAt: '2026-10-14T12:00:01.000Z',
          },
        ],
      });
    });

    it('before: repassa o cursor como bigint, inclusive acima de 2^31', async () => {
      repository.findPage.mockResolvedValue([]);

      await expect(
        service.list({ limit: 20, before: 3_000_000_000 }),
      ).resolves.toEqual({ items: [] });
      expect(repository.findPage).toHaveBeenCalledWith({
        limit: 20,
        before: 3_000_000_000n,
        after: undefined,
      });
    });

    it('after: repassa o cursor como bigint', async () => {
      repository.findPage.mockResolvedValue([]);

      await service.list({ limit: 100, after: 1040 });

      expect(repository.findPage).toHaveBeenCalledWith({
        limit: 100,
        before: undefined,
        after: 1040n,
      });
    });
  });

  describe('send', () => {
    const bia = makeParticipant({ id: BIA_ID, name: 'Bia', nameKey: 'bia' });

    it('grava com o participantId do ator, o content e o clientId, e devolve o DTO mapeado', async () => {
      repository.create.mockResolvedValue(
        makeMessage({
          id: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
          seq: 1041n,
          content: 'olá',
          clientId: CLIENT_ID,
          participantId: BIA_ID,
          participant: { id: BIA_ID, name: 'Bia' },
          createdAt: new Date('2026-10-14T12:00:02.000Z'),
        }),
      );

      const result = await service.send(bia, {
        content: 'olá',
        clientId: CLIENT_ID,
      });

      expect(repository.create).toHaveBeenCalledWith({
        participantId: BIA_ID,
        content: 'olá',
        clientId: CLIENT_ID,
      });
      expect(result).toEqual({
        id: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
        seq: 1041,
        type: 'USER',
        content: 'olá',
        clientId: CLIENT_ID,
        author: { id: BIA_ID, name: 'Bia' },
        createdAt: '2026-10-14T12:00:02.000Z',
      });
    });

    it('sem clientId grava clientId null', async () => {
      repository.create.mockResolvedValue(makeMessage());

      await service.send(bia, { content: 'olá' });

      expect(repository.create).toHaveBeenCalledWith({
        participantId: BIA_ID,
        content: 'olá',
        clientId: null,
      });
    });

    it('depois de gravar, dispara message.created uma vez com o mesmo DTO devolvido', async () => {
      repository.create.mockResolvedValue(
        makeMessage({
          id: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
          seq: 1042n,
          content: 'oi',
          participantId: BIA_ID,
          participant: { id: BIA_ID, name: 'Bia' },
          createdAt: new Date('2026-10-14T12:00:03.000Z'),
        }),
      );

      const result = await service.send(bia, { content: 'oi' });

      expect(dispatcher.dispatch).toHaveBeenCalledTimes(1);
      expect(dispatcher.dispatch).toHaveBeenCalledWith('message.created', {
        id: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
        seq: 1042,
        type: 'USER',
        content: 'oi',
        clientId: null,
        author: { id: BIA_ID, name: 'Bia' },
        createdAt: '2026-10-14T12:00:03.000Z',
      });
      expect(dispatcher.dispatch.mock.calls[0][1]).toEqual(result);
    });

    it('não dispara nada se o repositório lança', async () => {
      const failure = new Error('db down');
      repository.create.mockRejectedValue(failure);

      await expect(service.send(bia, { content: 'oi' })).rejects.toBe(failure);
      expect(dispatcher.dispatch).not.toHaveBeenCalled();
    });

    describe('idempotência e limite', () => {
      const stored = makeMessage({
        id: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
        seq: 1041n,
        content: 'olá',
        clientId: CLIENT_ID,
        participantId: BIA_ID,
        participant: { id: BIA_ID, name: 'Bia' },
        createdAt: new Date('2026-10-14T12:00:02.000Z'),
      });
      const storedDto = {
        id: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
        seq: 1041,
        type: 'USER',
        content: 'olá',
        clientId: CLIENT_ID,
        author: { id: BIA_ID, name: 'Bia' },
        createdAt: '2026-10-14T12:00:02.000Z',
      };

      beforeEach(() => {
        vi.spyOn(Date, 'now').mockReturnValue(NOW);
      });

      afterEach(() => {
        vi.restoreAllMocks();
      });

      it('reenvio com clientId já gravado devolve a existente, sem limiter, create nem dispatch', async () => {
        repository.findByClientId.mockResolvedValue(stored);

        const result = await service.send(bia, {
          content: 'olá',
          clientId: CLIENT_ID,
        });

        expect(repository.findByClientId).toHaveBeenCalledWith(
          BIA_ID,
          CLIENT_ID,
        );
        expect(result).toEqual(storedDto);
        expect(limiter.tryAcquire).not.toHaveBeenCalled();
        expect(repository.create).not.toHaveBeenCalled();
        expect(dispatcher.dispatch).not.toHaveBeenCalled();
      });

      it('clientId novo: consulta o limiter com o id do ator e o relógio, grava e dispara', async () => {
        repository.findByClientId.mockResolvedValue(null);
        repository.create.mockResolvedValue(stored);

        const result = await service.send(bia, {
          content: 'olá',
          clientId: CLIENT_ID,
        });

        expect(limiter.tryAcquire).toHaveBeenCalledWith(BIA_ID, NOW);
        expect(repository.create).toHaveBeenCalledTimes(1);
        expect(result).toEqual(storedDto);
        expect(dispatcher.dispatch).toHaveBeenCalledWith(
          'message.created',
          storedDto,
        );
      });

      it('limiter recusa → RateLimitedException com retryAfterSeconds, sem create nem dispatch', async () => {
        repository.findByClientId.mockResolvedValue(null);
        limiter.tryAcquire.mockReturnValue({ ok: false, retryAfterSeconds: 4 });

        const error = await service
          .send(bia, { content: 'olá', clientId: CLIENT_ID })
          .catch((e: unknown) => e);

        expect(error).toBeInstanceOf(RateLimitedException);
        expect((error as RateLimitedException).getStatus()).toBe(429);
        expect((error as RateLimitedException).retryAfterSeconds).toBe(4);
        expect(repository.create).not.toHaveBeenCalled();
        expect(dispatcher.dispatch).not.toHaveBeenCalled();
      });

      it('P2002 em create (corrida entre reenvios) → busca pelo clientId e devolve a existente, sem dispatch', async () => {
        repository.findByClientId
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(stored);
        repository.create.mockRejectedValue(prismaError('P2002'));

        const result = await service.send(bia, {
          content: 'olá',
          clientId: CLIENT_ID,
        });

        expect(repository.findByClientId).toHaveBeenCalledTimes(2);
        expect(repository.findByClientId).toHaveBeenLastCalledWith(
          BIA_ID,
          CLIENT_ID,
        );
        expect(result).toEqual(storedDto);
        expect(dispatcher.dispatch).not.toHaveBeenCalled();
      });

      it('P2002 sem mensagem com o clientId propaga o erro original', async () => {
        const failure = prismaError('P2002');
        repository.findByClientId.mockResolvedValue(null);
        repository.create.mockRejectedValue(failure);

        await expect(
          service.send(bia, { content: 'olá', clientId: CLIENT_ID }),
        ).rejects.toBe(failure);
        expect(dispatcher.dispatch).not.toHaveBeenCalled();
      });

      it('outro erro do Prisma em create propaga, sem buscar pelo clientId de novo', async () => {
        const failure = prismaError('P2003');
        repository.findByClientId.mockResolvedValue(null);
        repository.create.mockRejectedValue(failure);

        await expect(
          service.send(bia, { content: 'olá', clientId: CLIENT_ID }),
        ).rejects.toBe(failure);
        expect(repository.findByClientId).toHaveBeenCalledTimes(1);
        expect(dispatcher.dispatch).not.toHaveBeenCalled();
      });

      describe('janela de digitação (TYPE-01 AC13)', () => {
        it('mensagem USER nova zera o limite de 2 s: o próximo notify, a 1 s do anterior, dispara', async () => {
          repository.findByClientId.mockResolvedValue(null);
          repository.create.mockResolvedValue(stored);
          typing.notify(bia, NOW);

          await service.send(bia, { content: 'olá', clientId: CLIENT_ID });
          typing.notify(bia, NOW + 1_000);

          expect(typingDispatches()).toBe(2);
        });

        it('mensagem nova sem clientId também zera', async () => {
          repository.create.mockResolvedValue(stored);
          typing.notify(bia, NOW);

          await service.send(bia, { content: 'olá' });
          typing.notify(bia, NOW + 1_000);

          expect(typingDispatches()).toBe(2);
        });

        it('zera só o autor: o limite de outro participante continua', async () => {
          const ana = makeParticipant();
          repository.create.mockResolvedValue(stored);
          typing.notify(ana, NOW);

          await service.send(bia, { content: 'olá' });
          typing.notify(ana, NOW + 1_000);

          expect(typingDispatches()).toBe(1);
        });

        it('reenvio com clientId já gravado não zera', async () => {
          repository.findByClientId.mockResolvedValue(stored);
          typing.notify(bia, NOW);

          await service.send(bia, { content: 'olá', clientId: CLIENT_ID });
          typing.notify(bia, NOW + 1_000);

          expect(typingDispatches()).toBe(1);
        });

        it('corrida de P2002 (outro reenvio gravou antes) não zera', async () => {
          repository.findByClientId
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(stored);
          repository.create.mockRejectedValue(prismaError('P2002'));
          typing.notify(bia, NOW);

          await service.send(bia, { content: 'olá', clientId: CLIENT_ID });
          typing.notify(bia, NOW + 1_000);

          expect(typingDispatches()).toBe(1);
        });

        it('falha do create não zera', async () => {
          repository.create.mockRejectedValue(new Error('db down'));
          typing.notify(bia, NOW);

          await expect(service.send(bia, { content: 'olá' })).rejects.toThrow(
            'db down',
          );
          typing.notify(bia, NOW + 1_000);

          expect(typingDispatches()).toBe(1);
        });
      });

      it('sem clientId: pula a busca e o P2002 em create propaga', async () => {
        const failure = prismaError('P2002');
        repository.create.mockRejectedValue(failure);

        await expect(service.send(bia, { content: 'olá' })).rejects.toBe(
          failure,
        );
        expect(repository.findByClientId).not.toHaveBeenCalled();
        expect(limiter.tryAcquire).toHaveBeenCalledWith(BIA_ID, NOW);
      });
    });
  });
});
