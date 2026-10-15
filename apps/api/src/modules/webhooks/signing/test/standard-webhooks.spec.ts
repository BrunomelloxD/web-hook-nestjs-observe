import { decodeSecret, signWebhook } from '../standard-webhooks.js';

// Official vector: standard-webhooks/standard-webhooks,
// libraries/python/tests/test_webhooks.py, test_sign_function
// https://github.com/standard-webhooks/standard-webhooks/blob/main/libraries/python/tests/test_webhooks.py
const VECTOR = {
  secret: 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw',
  id: 'msg_p5jXN8AQM9LWM0D4loKWxJek',
  timestamp: 1614265330,
  body: '{"test": 2432232314}',
  signature: 'v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=',
};

describe('Standard Webhooks', () => {
  describe('decodeSecret', () => {
    it('tira o prefixo whsec_ e decodifica o base64', () => {
      expect([...decodeSecret('whsec_AAEC/w==')]).toEqual([0, 1, 2, 255]);
    });

    it('decodifica o segredo do vetor oficial em 24 bytes', () => {
      expect(decodeSecret(VECTOR.secret)).toEqual(
        Buffer.from('MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw', 'base64'),
      );
      expect(decodeSecret(VECTOR.secret)).toHaveLength(24);
    });
  });

  describe('signWebhook', () => {
    const key = decodeSecret(VECTOR.secret);

    it('reproduz a assinatura do vetor oficial', () => {
      expect(
        signWebhook({
          key,
          id: VECTOR.id,
          timestamp: VECTOR.timestamp,
          body: VECTOR.body,
        }),
      ).toBe(VECTOR.signature);
    });

    it('um byte a mais no corpo muda a assinatura', () => {
      const signature = signWebhook({
        key,
        id: VECTOR.id,
        timestamp: VECTOR.timestamp,
        body: `${VECTOR.body} `,
      });

      expect(signature).toMatch(/^v1,[A-Za-z0-9+/]{43}=$/);
      expect(signature).not.toBe(VECTOR.signature);
    });

    it('outro id ou outro timestamp mudam a assinatura', () => {
      const base = { key, body: VECTOR.body };

      expect(
        signWebhook({ ...base, id: 'msg_x', timestamp: VECTOR.timestamp }),
      ).not.toBe(VECTOR.signature);
      expect(
        signWebhook({
          ...base,
          id: VECTOR.id,
          timestamp: VECTOR.timestamp + 1,
        }),
      ).not.toBe(VECTOR.signature);
    });
  });
});
