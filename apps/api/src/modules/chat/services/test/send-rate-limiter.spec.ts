import { SEND_LIMIT, SendRateLimiter } from '../send-rate-limiter.js';

const BIA = '7d9f1e2a-4b3c-4d5e-9f60-1a2b3c4d5e6f';
const CAIO = '3c2b1a09-8f7e-4d6c-9b5a-4e3d2c1b0a9f';
const T = 1_791_979_200_000;

describe('SendRateLimiter', () => {
  let limiter: SendRateLimiter;

  const fill = (participantId: string, nowMs: number) => {
    for (let i = 0; i < SEND_LIMIT; i++) {
      expect(limiter.tryAcquire(participantId, nowMs)).toEqual({ ok: true });
    }
  };

  beforeEach(() => {
    limiter = new SendRateLimiter();
  });

  it('o limite é de 5 envios', () => {
    expect(SEND_LIMIT).toBe(5);
  });

  it('5 envios no mesmo instante passam; o 6º em t + 9_999 recusa com retryAfterSeconds = 1', () => {
    fill(BIA, T);

    expect(limiter.tryAcquire(BIA, T + 9_999)).toEqual({
      ok: false,
      retryAfterSeconds: 1,
    });
  });

  it('em t + 10_000 os envios de t saem da janela e o envio passa', () => {
    fill(BIA, T);
    limiter.tryAcquire(BIA, T + 9_999);

    expect(limiter.tryAcquire(BIA, T + 10_000)).toEqual({ ok: true });
  });

  it('uma recusa não conta na janela', () => {
    fill(BIA, T);
    limiter.tryAcquire(BIA, T + 5_000);

    // Only the 5 accepted sends at T count: all leave at T + 10_000.
    fill(BIA, T + 10_000);
  });

  it('janela deslizante: libera conforme o envio mais antigo sai dos 10 s', () => {
    for (let i = 0; i < SEND_LIMIT; i++) {
      expect(limiter.tryAcquire(BIA, T + i * 1_000)).toEqual({ ok: true });
    }

    expect(limiter.tryAcquire(BIA, T + 9_000)).toEqual({
      ok: false,
      retryAfterSeconds: 1,
    });
    expect(limiter.tryAcquire(BIA, T + 10_000)).toEqual({ ok: true });
    expect(limiter.tryAcquire(BIA, T + 10_000)).toEqual({
      ok: false,
      retryAfterSeconds: 1,
    });
  });

  it('retryAfterSeconds arredonda para cima', () => {
    fill(BIA, T);

    expect(limiter.tryAcquire(BIA, T + 1)).toEqual({
      ok: false,
      retryAfterSeconds: 10,
    });
    expect(limiter.tryAcquire(BIA, T + 7_000)).toEqual({
      ok: false,
      retryAfterSeconds: 3,
    });
    expect(limiter.tryAcquire(BIA, T + 7_001)).toEqual({
      ok: false,
      retryAfterSeconds: 3,
    });
  });

  it('outro participante não é afetado', () => {
    fill(BIA, T);

    fill(CAIO, T + 1);
    expect(limiter.tryAcquire(BIA, T + 1)).toMatchObject({ ok: false });
  });

  it('depois de a janela esvaziar, o mapa interno não guarda a chave', () => {
    limiter.tryAcquire(BIA, T);
    expect(limiter['windows'].has(BIA)).toBe(true);

    limiter.tryAcquire(CAIO, T + 9_999);
    expect(limiter['windows'].has(BIA)).toBe(true);

    limiter.tryAcquire(CAIO, T + 10_000);
    expect(limiter['windows'].has(BIA)).toBe(false);
    expect([...limiter['windows'].keys()]).toEqual([CAIO]);
  });
});
