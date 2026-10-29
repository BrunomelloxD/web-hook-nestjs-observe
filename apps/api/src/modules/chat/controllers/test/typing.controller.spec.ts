import { Test } from '@nestjs/testing';
import type { Mocked } from 'vitest';
import { ParticipantTokenGuard } from '../../guards/participant-token.guard.js';
import { TypingService } from '../../services/typing.service.js';
import { makeParticipant } from '../../test-fixtures.js';
import { TypingController } from '../typing.controller.js';

const ANA = makeParticipant();

describe('TypingController', () => {
  let controller: TypingController;
  let service: Mocked<Pick<TypingService, 'notify'>>;

  beforeEach(async () => {
    service = { notify: vi.fn() };

    const module = await Test.createTestingModule({
      controllers: [TypingController],
      providers: [{ provide: TypingService, useValue: service }],
    })
      // The guard has its own spec; here only the delegation matters.
      .overrideGuard(ParticipantTokenGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(TypingController);
  });

  it('notify repassa o participante do token ao service e não devolve corpo', () => {
    expect(controller.notify(ANA)).toBeUndefined();
    expect(service.notify).toHaveBeenCalledTimes(1);
    expect(service.notify).toHaveBeenCalledWith(ANA);
  });
});
