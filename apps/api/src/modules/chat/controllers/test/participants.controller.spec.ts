import { Test } from '@nestjs/testing';
import type { Mocked } from 'vitest';
import { ParticipantsService } from '../../services/participants.service.js';
import { makeParticipant } from '../../test-fixtures.js';
import { ParticipantsController } from '../participants.controller.js';

const ANA = makeParticipant();
const BIA_ID = '7d9f1e2a-4b3c-4d5e-9f60-1a2b3c4d5e6f';

describe('ParticipantsController', () => {
  let controller: ParticipantsController;
  let service: Mocked<
    Pick<ParticipantsService, 'join' | 'listOnline' | 'leave'>
  >;

  beforeEach(async () => {
    service = {
      join: vi.fn(),
      listOnline: vi.fn(),
      leave: vi.fn(),
    };

    const module = await Test.createTestingModule({
      controllers: [ParticipantsController],
      providers: [{ provide: ParticipantsService, useValue: service }],
    }).compile();

    controller = module.get(ParticipantsController);
  });

  it('join repassa o DTO ao service e devolve o participante criado', async () => {
    const joined = {
      id: ANA.id,
      name: 'Ana',
      token: 'token-da-ana',
      joinedAt: '2026-01-01T00:00:00.000Z',
    };
    service.join.mockResolvedValue(joined);

    await expect(controller.join({ name: 'Ana' })).resolves.toBe(joined);
    expect(service.join).toHaveBeenCalledWith({ name: 'Ana' });
  });

  it('listOnline devolve a lista do service', async () => {
    const online = { items: [{ id: ANA.id, name: 'Ana' }], total: 1 };
    service.listOnline.mockResolvedValue(online);

    await expect(controller.listOnline()).resolves.toBe(online);
    expect(service.listOnline).toHaveBeenCalledWith();
  });

  it('leave repassa o id da rota e o participante do token', async () => {
    service.leave.mockResolvedValue(undefined);

    await expect(controller.leave(BIA_ID, ANA)).resolves.toBeUndefined();
    expect(service.leave).toHaveBeenCalledWith(BIA_ID, ANA);
  });
});
