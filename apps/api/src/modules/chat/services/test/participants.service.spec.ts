import { createHash } from 'node:crypto';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Mocked } from 'vitest';
import { Prisma } from '@/generated/prisma/client.js';
import { WebhookDispatcher } from '@/modules/webhooks/services/webhook-dispatcher.service.js';
import { IParticipantRepository } from '../../repositories/participant.repository.interface.js';
import { makeMessage, makeParticipant } from '../../test-fixtures.js';
import { ParticipantsService } from '../participants.service.js';

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');

const ANA = makeParticipant({
  id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'Ana',
});
const BIA = makeParticipant({
  id: '7d9f1e2a-4b3c-4d5e-9f60-1a2b3c4d5e6f',
  name: 'Bia',
  nameKey: 'bia',
});

describe('ParticipantsService', () => {
  let service: ParticipantsService;
  let repository: Mocked<IParticipantRepository>;
  let dispatcher: { dispatch: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    dispatcher = { dispatch: vi.fn() };
    repository = {
      createWithJoinMessage: vi.fn(),
      leaveWithMessage: vi.fn(),
      findById: vi.fn(),
      findActiveByTokenHash: vi.fn(),
      listOnline: vi.fn(),
      countOnline: vi.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        ParticipantsService,
        { provide: IParticipantRepository, useValue: repository },
        { provide: WebhookDispatcher, useValue: dispatcher },
      ],
    }).compile();

    service = module.get(ParticipantsService);
  });

  describe('join', () => {
    const created = makeParticipant({
      id: '7d9f1e2a-4b3c-4d5e-9f60-1a2b3c4d5e6f',
      name: 'ÉRICA',
      nameKey: 'érica',
      joinedAt: new Date('2026-10-14T12:00:00.000Z'),
    });

    beforeEach(() => {
      repository.createWithJoinMessage.mockResolvedValue({
        participant: created,
        message: makeMessage({ type: 'JOINED', content: '' }),
      });
    });

    it('grava o nome, a chave NFC minúscula e só o hash do token', async () => {
      const result = await service.join({ name: 'ÉRICA' });

      const [data] = repository.createWithJoinMessage.mock.calls[0];
      expect(data).toEqual({
        name: 'ÉRICA',
        nameKey: 'érica',
        tokenHash: sha256(result.token),
      });
      expect(data.tokenHash).toMatch(/^[0-9a-f]{64}$/);
      expect(JSON.stringify(data)).not.toContain(result.token);
    });

    it('devolve o participante criado com o token puro (43 caracteres base64url)', async () => {
      const result = await service.join({ name: 'ÉRICA' });

      expect(result).toEqual({
        id: '7d9f1e2a-4b3c-4d5e-9f60-1a2b3c4d5e6f',
        name: 'ÉRICA',
        token: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
        joinedAt: '2026-10-14T12:00:00.000Z',
      });
    });

    it('gera um token novo a cada entrada', async () => {
      const first = await service.join({ name: 'ÉRICA' });
      const second = await service.join({ name: 'ÉRICA' });

      expect(first.token).not.toBe(second.token);
    });

    it('propaga o P2002 do repositório (nome em uso vira 409 no filtro global)', async () => {
      const conflict = new Prisma.PrismaClientKnownRequestError('unique', {
        code: 'P2002',
        clientVersion: 'test',
      });
      repository.createWithJoinMessage.mockRejectedValue(conflict);

      await expect(service.join({ name: 'ana' })).rejects.toBe(conflict);
      expect(dispatcher.dispatch).not.toHaveBeenCalled();
      expect(repository.countOnline).not.toHaveBeenCalled();
    });

    it('depois da transação, dispara message.created (JOINED) e depois presence.changed com o countOnline', async () => {
      repository.createWithJoinMessage.mockResolvedValue({
        participant: created,
        message: makeMessage({
          id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
          seq: 77n,
          type: 'JOINED',
          content: '',
          participantId: created.id,
          participant: { id: created.id, name: 'ÉRICA' },
          createdAt: new Date('2026-10-14T12:00:00.000Z'),
        }),
      });
      repository.countOnline.mockResolvedValue(4);

      await service.join({ name: 'ÉRICA' });

      expect(dispatcher.dispatch.mock.calls).toEqual([
        [
          'message.created',
          {
            id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
            seq: 77,
            type: 'JOINED',
            content: '',
            clientId: null,
            author: {
              id: '7d9f1e2a-4b3c-4d5e-9f60-1a2b3c4d5e6f',
              name: 'ÉRICA',
            },
            createdAt: '2026-10-14T12:00:00.000Z',
          },
        ],
        ['presence.changed', { online: 4 }],
      ]);
      // countOnline is read only after the transaction resolved.
      expect(
        repository.countOnline.mock.invocationCallOrder[0],
      ).toBeGreaterThan(
        repository.createWithJoinMessage.mock.invocationCallOrder[0],
      );
    });
  });

  describe('listOnline', () => {
    it('devolve { items: [{ id, name }], total } na ordem do repositório', async () => {
      repository.listOnline.mockResolvedValue([
        { id: ANA.id, name: 'Ana' },
        { id: BIA.id, name: 'Bia' },
      ]);

      await expect(service.listOnline()).resolves.toEqual({
        items: [
          { id: '550e8400-e29b-41d4-a716-446655440000', name: 'Ana' },
          { id: '7d9f1e2a-4b3c-4d5e-9f60-1a2b3c4d5e6f', name: 'Bia' },
        ],
        total: 2,
      });
    });

    it('devolve total 0 com a sala vazia', async () => {
      repository.listOnline.mockResolvedValue([]);

      await expect(service.listOnline()).resolves.toEqual({
        items: [],
        total: 0,
      });
    });
  });

  describe('leave', () => {
    it('id inexistente → NotFoundException, sem gravar a saída', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.leave(BIA.id, ANA)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(repository.findById).toHaveBeenCalledWith(BIA.id);
      expect(repository.leaveWithMessage).not.toHaveBeenCalled();
      expect(dispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('id de outro participante → UnauthorizedException, sem gravar a saída', async () => {
      repository.findById.mockResolvedValue(BIA);

      await expect(service.leave(BIA.id, ANA)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(repository.leaveWithMessage).not.toHaveBeenCalled();
      expect(dispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('o próprio id → leaveWithMessage(id)', async () => {
      repository.findById.mockResolvedValue(ANA);
      repository.leaveWithMessage.mockResolvedValue(
        makeMessage({ type: 'LEFT', content: '' }),
      );

      await expect(service.leave(ANA.id, ANA)).resolves.toBeUndefined();
      expect(repository.leaveWithMessage).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440000',
      );
    });

    it('depois da transação, dispara message.created (LEFT) e depois presence.changed com o countOnline', async () => {
      repository.findById.mockResolvedValue(ANA);
      repository.leaveWithMessage.mockResolvedValue(
        makeMessage({
          id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
          seq: 78n,
          type: 'LEFT',
          content: '',
          createdAt: new Date('2026-10-14T12:05:00.000Z'),
        }),
      );
      repository.countOnline.mockResolvedValue(0);

      await service.leave(ANA.id, ANA);

      expect(dispatcher.dispatch.mock.calls).toEqual([
        [
          'message.created',
          {
            id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
            seq: 78,
            type: 'LEFT',
            content: '',
            clientId: null,
            author: { id: '550e8400-e29b-41d4-a716-446655440000', name: 'Ana' },
            createdAt: '2026-10-14T12:05:00.000Z',
          },
        ],
        ['presence.changed', { online: 0 }],
      ]);
      expect(
        repository.countOnline.mock.invocationCallOrder[0],
      ).toBeGreaterThan(
        repository.leaveWithMessage.mock.invocationCallOrder[0],
      );
    });

    it('erro na transação de saída → propaga, sem disparar nada', async () => {
      const failure = new Error('db down');
      repository.findById.mockResolvedValue(ANA);
      repository.leaveWithMessage.mockRejectedValue(failure);

      await expect(service.leave(ANA.id, ANA)).rejects.toBe(failure);
      expect(dispatcher.dispatch).not.toHaveBeenCalled();
    });
  });

  describe('authenticate', () => {
    it('busca o participante online pelo SHA-256 do token', async () => {
      repository.findActiveByTokenHash.mockResolvedValue(ANA);

      await expect(service.authenticate('token-da-ana')).resolves.toBe(ANA);
      expect(repository.findActiveByTokenHash).toHaveBeenCalledWith(
        sha256('token-da-ana'),
      );
    });
  });
});
