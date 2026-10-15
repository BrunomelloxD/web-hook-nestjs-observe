import crypto from 'node:crypto';
import { signTestWebhook } from '../../../../test/webhooks';
import { verifyWebhook } from './verify-webhook';

// Official vector: standard-webhooks/standard-webhooks,
// libraries/python/tests/test_webhooks.py, test_sign_function (same as the api signing spec).
// https://github.com/standard-webhooks/standard-webhooks/blob/main/libraries/python/tests/test_webhooks.py
const VECTOR = {
  secret: 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw',
  id: 'msg_p5jXN8AQM9LWM0D4loKWxJek',
  timestamp: 1614265330,
  body: '{"test": 2432232314}',
  signature: 'v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=',
};

const OTHER_SECRET = 'whsec_AAECAwQFBgcICQoLDA0ODw==';

function params(
  overrides: Partial<Parameters<typeof verifyWebhook>[0]> = {},
): Parameters<typeof verifyWebhook>[0] {
  return {
    id: VECTOR.id,
    timestamp: String(VECTOR.timestamp),
    signature: VECTOR.signature,
    rawBody: VECTOR.body,
    secret: VECTOR.secret,
    nowSeconds: VECTOR.timestamp,
    ...overrides,
  };
}

describe('verifyWebhook', () => {
  it('aceita a assinatura do vetor oficial', () => {
    expect(verifyWebhook(params())).toEqual({ ok: true });
  });

  it('aceita os headers gerados por signTestWebhook', () => {
    const headers = signTestWebhook({
      id: VECTOR.id,
      timestamp: VECTOR.timestamp,
      body: VECTOR.body,
      secret: VECTOR.secret,
    });

    expect(headers['webhook-signature']).toBe(VECTOR.signature);
    expect(
      verifyWebhook(
        params({
          id: headers['webhook-id'],
          timestamp: headers['webhook-timestamp'],
          signature: headers['webhook-signature'],
        }),
      ),
    ).toEqual({ ok: true });
  });

  describe('header ausente → missing', () => {
    it.each([
      ['webhook-id', { id: null }],
      ['webhook-timestamp', { timestamp: null }],
      ['webhook-signature', { signature: null }],
      ['webhook-signature vazio', { signature: '' }],
    ])('%s', (_, overrides) => {
      expect(verifyWebhook(params(overrides))).toEqual({
        ok: false,
        reason: 'missing',
      });
    });
  });

  describe('tolerância de 300 s', () => {
    it.each([
      ['300 s no passado', VECTOR.timestamp + 300],
      ['300 s no futuro', VECTOR.timestamp - 300],
    ])('%s passa', (_, nowSeconds) => {
      expect(verifyWebhook(params({ nowSeconds }))).toEqual({ ok: true });
    });

    it.each([
      ['301 s no passado', VECTOR.timestamp + 301],
      ['301 s no futuro', VECTOR.timestamp - 301],
    ])('%s → timestamp', (_, nowSeconds) => {
      expect(verifyWebhook(params({ nowSeconds }))).toEqual({
        ok: false,
        reason: 'timestamp',
      });
    });

    it('timestamp que não é um número inteiro → timestamp', () => {
      expect(
        verifyWebhook(params({ timestamp: `${VECTOR.timestamp}.5` })),
      ).toEqual({ ok: false, reason: 'timestamp' });
    });
  });

  describe('assinatura que não confere → signature', () => {
    it.each([
      ['corpo com um byte a mais', { rawBody: `${VECTOR.body} ` }],
      ['corpo com um byte trocado', { rawBody: '{"test": 2432232315}' }],
      ['outro segredo', { secret: OTHER_SECRET }],
      ['outro webhook-id', { id: 'msg_other' }],
      ['outro webhook-timestamp', { timestamp: String(VECTOR.timestamp + 1) }],
      [
        'prefixo de versão errado',
        { signature: VECTOR.signature.replace('v1,', 'v2,') },
      ],
      ['sem o prefixo de versão', { signature: VECTOR.signature.slice(3) }],
      [
        'lista só com assinaturas erradas',
        {
          signature:
            'v1,AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA= v1,BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=',
        },
      ],
    ])('%s', (_, overrides) => {
      expect(verifyWebhook(params(overrides))).toEqual({
        ok: false,
        reason: 'signature',
      });
    });

    it('assinatura de tamanho diferente não lança', () => {
      expect(() =>
        verifyWebhook(params({ signature: 'v1,abc' })),
      ).not.toThrow();
      expect(verifyWebhook(params({ signature: 'v1,abc' }))).toEqual({
        ok: false,
        reason: 'signature',
      });
    });
  });

  it('lista com uma assinatura errada e uma certa → ok', () => {
    expect(
      verifyWebhook(
        params({
          signature: `v1,AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA= ${VECTOR.signature}`,
        }),
      ),
    ).toEqual({ ok: true });
  });

  it('compara a assinatura com timingSafeEqual (tempo constante)', () => {
    const timingSafeEqual = vi.spyOn(crypto, 'timingSafeEqual');

    expect(verifyWebhook(params())).toEqual({ ok: true });
    expect(timingSafeEqual).toHaveBeenCalledWith(
      Buffer.from(VECTOR.signature.slice(3)),
      Buffer.from(VECTOR.signature.slice(3)),
    );
    timingSafeEqual.mockRestore();
  });
});
