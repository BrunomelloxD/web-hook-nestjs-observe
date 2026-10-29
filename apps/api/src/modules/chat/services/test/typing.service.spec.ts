import { Test } from '@nestjs/testing';
import { WebhookDispatcher } from '@/modules/webhooks/services/webhook-dispatcher.service.js';
import { makeParticipant } from '../../test-fixtures.js';
import { TYPING_MIN_INTERVAL_MS, TypingService } from '../typing.service.js';

const ANA = makeParticipant({
  id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'Ana',
});
const BIA = makeParticipant({
  id: '7d9f1e2a-4b3c-4d5e-9f60-1a2b3c4d5e6f',
  name: 'Bia',
  nameKey: 'bia',
});
const T = 1_791_979_200_000;

describe('TypingService', () => {
  let service: TypingService;
  let dispatcher: { dispatch: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    dispatcher = { dispatch: vi.fn() };

    const module = await Test.createTestingModule({
      providers: [
        TypingService,
        { provide: WebhookDispatcher, useValue: dispatcher },
      ],
    }).compile();

    service = module.get(TypingService);
  });

  it('o intervalo mínimo é de 2 s', () => {
    expect(TYPING_MIN_INTERVAL_MS).toBe(2_000);
  });

  it('a primeira chamada dispara typing.started com { participant: { id, name } } e uma tentativa só', () => {
    service.notify(ANA, T);

    expect(dispatcher.dispatch).toHaveBeenCalledTimes(1);
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      'typing.started',
      { participant: { id: ANA.id, name: 'Ana' } },
      { maxAttempts: 1 },
    );
  });

  it('outra chamada em t + 1_999 não dispara; em t + 2_000 dispara', () => {
    service.notify(ANA, T);
    service.notify(ANA, T + 1_999);
    expect(dispatcher.dispatch).toHaveBeenCalledTimes(1);

    service.notify(ANA, T + 2_000);
    expect(dispatcher.dispatch).toHaveBeenCalledTimes(2);
  });

  it('uma chamada ignorada não reinicia a contagem', () => {
    service.notify(ANA, T);
    service.notify(ANA, T + 1_500);

    // Measured from the accepted call at T, not from the ignored one.
    service.notify(ANA, T + 2_000);
    expect(dispatcher.dispatch).toHaveBeenCalledTimes(2);
  });

  it('outro participante não é afetado', () => {
    service.notify(ANA, T);
    service.notify(BIA, T + 1);

    expect(dispatcher.dispatch).toHaveBeenCalledTimes(2);
    expect(dispatcher.dispatch).toHaveBeenLastCalledWith(
      'typing.started',
      { participant: { id: BIA.id, name: 'Bia' } },
      { maxAttempts: 1 },
    );
  });

  it('reset zera o limite: notify em T, reset em T + 500, notify em T + 1_000 → dois disparos (TYPE-01 AC13)', () => {
    service.notify(ANA, T);
    service.reset(ANA.id);
    service.notify(ANA, T + 1_000);

    expect(dispatcher.dispatch).toHaveBeenCalledTimes(2);
  });

  it('reset de um participante não afeta outro', () => {
    service.notify(ANA, T);
    service.notify(BIA, T);
    service.reset(ANA.id);

    service.notify(BIA, T + 1_000);
    expect(dispatcher.dispatch).toHaveBeenCalledTimes(2);
  });

  it('sem nowMs usa o relógio atual', () => {
    vi.useFakeTimers({ now: T });
    try {
      service.notify(ANA);
      service.notify(ANA, T + 1_999);
      expect(dispatcher.dispatch).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('entradas com 2 s ou mais saem do mapa quando ele é consultado', () => {
    service.notify(ANA, T);
    service.notify(BIA, T + 1_999);
    expect([...service['lastAccepted'].keys()]).toEqual([ANA.id, BIA.id]);

    service.notify(BIA, T + 2_000);
    expect([...service['lastAccepted'].keys()]).toEqual([BIA.id]);
  });
});
