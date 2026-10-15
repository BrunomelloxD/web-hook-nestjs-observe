import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Mocked } from 'vitest';
import { WebhookDispatcher } from '@/modules/webhooks/services/webhook-dispatcher.service.js';
import { IMessageRepository } from '../../repositories/message.repository.interface.js';
import { makeMessage, makeParticipant } from '../../test-fixtures.js';
import { MessagesService } from '../messages.service.js';

const BIA_ID = '7d9f1e2a-4b3c-4d5e-9f60-1a2b3c4d5e6f';
const CLIENT_ID = '0b8f7c6d-5e4a-4b3c-9d2e-1f0a9b8c7d6e';

describe('MessagesService', () => {
  let service: MessagesService;
  let repository: Mocked<IMessageRepository>;
  let dispatcher: { dispatch: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    repository = { findPage: vi.fn(), create: vi.fn() };
    dispatcher = { dispatch: vi.fn() };

    const module = await Test.createTestingModule({
      providers: [
        MessagesService,
        { provide: IMessageRepository, useValue: repository },
        { provide: WebhookDispatcher, useValue: dispatcher },
      ],
    }).compile();

    service = module.get(MessagesService);
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
  });
});
