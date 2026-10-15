import { Test } from '@nestjs/testing';
import type { Mocked } from 'vitest';
import type { MessageResponseDto } from '../../dtos/response/message-response.dto.js';
import { ParticipantTokenGuard } from '../../guards/participant-token.guard.js';
import { MessagesService } from '../../services/messages.service.js';
import { makeParticipant } from '../../test-fixtures.js';
import { MessagesController } from '../messages.controller.js';

const ANA = makeParticipant();
const CLIENT_ID = '0b8f7c6d-5e4a-4b3c-9d2e-1f0a9b8c7d6e';

const SENT: MessageResponseDto = {
  id: '6f1c2b9e-3d4a-4c5b-8e7f-0a1b2c3d4e5f',
  seq: 1040,
  type: 'USER',
  content: 'olá',
  clientId: CLIENT_ID,
  author: { id: ANA.id, name: 'Ana' },
  createdAt: '2026-01-01T00:00:01.000Z',
};

describe('MessagesController', () => {
  let controller: MessagesController;
  let service: Mocked<Pick<MessagesService, 'list' | 'send'>>;

  beforeEach(async () => {
    service = { list: vi.fn(), send: vi.fn() };

    const module = await Test.createTestingModule({
      controllers: [MessagesController],
      providers: [{ provide: MessagesService, useValue: service }],
    })
      // The guard has its own spec; here only the delegation matters.
      .overrideGuard(ParticipantTokenGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(MessagesController);
  });

  it('list repassa a query ao service e devolve a página', async () => {
    const page = { items: [SENT] };
    service.list.mockResolvedValue(page);

    await expect(controller.list({ limit: 20, before: 1041 })).resolves.toBe(
      page,
    );
    expect(service.list).toHaveBeenCalledWith({ limit: 20, before: 1041 });
  });

  it('send repassa o participante do token e o corpo, e devolve a mensagem gravada', async () => {
    service.send.mockResolvedValue(SENT);

    await expect(
      controller.send(ANA, { content: 'olá', clientId: CLIENT_ID }),
    ).resolves.toBe(SENT);
    expect(service.send).toHaveBeenCalledWith(ANA, {
      content: 'olá',
      clientId: CLIENT_ID,
    });
  });
});
