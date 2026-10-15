import { validateEnv } from '../env.schema.js';

const DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
const WEBHOOK_TARGET_URL = 'http://localhost:3000/webhooks/chat';
// Secret from the Standard Webhooks test vectors.
const WEBHOOK_SECRET = 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw';
const REQUIRED = { DATABASE_URL, WEBHOOK_TARGET_URL, WEBHOOK_SECRET };

describe('validateEnv', () => {
  it('aplica os valores padrão', () => {
    expect(validateEnv(REQUIRED)).toEqual({
      NODE_ENV: 'development',
      PORT: 3333,
      APP_NAME: 'api',
      LOG_LEVEL: 'info',
      CORS_ORIGIN: ['http://localhost:3000'],
      DATABASE_URL,
      THROTTLE_TTL: 60_000,
      THROTTLE_LIMIT: 60,
      WEBHOOK_TARGET_URL,
      WEBHOOK_SECRET,
    });
  });

  it('converte números e separa as origens do CORS', () => {
    const env = validateEnv({
      ...REQUIRED,
      PORT: '8080',
      CORS_ORIGIN: 'http://a.com, http://b.com',
    });

    expect(env.PORT).toBe(8080);
    expect(env.CORS_ORIGIN).toEqual(['http://a.com', 'http://b.com']);
  });

  it('falha com mensagem clara quando falta variável obrigatória', () => {
    expect(() => validateEnv({})).toThrow(
      /Variáveis de ambiente inválidas:[\s\S]*DATABASE_URL/,
    );
  });

  it('falha quando um valor é inválido', () => {
    expect(() => validateEnv({ ...REQUIRED, NODE_ENV: 'staging' })).toThrow(
      /NODE_ENV/,
    );
  });

  describe('WEBHOOK_TARGET_URL', () => {
    it('é obrigatória', () => {
      const { WEBHOOK_TARGET_URL: _omit, ...rest } = REQUIRED;

      expect(() => validateEnv(rest)).toThrow(/WEBHOOK_TARGET_URL/);
    });

    it.each([
      ['sem o : do esquema', 'http//localhost:3000/webhooks/chat'],
      ['texto com espaço', 'not a url'],
      ['vazia', ''],
      ['só o caminho', '/webhooks/chat'],
    ])('falha com URL inválida (%s)', (_case, value) => {
      expect(() =>
        validateEnv({ ...REQUIRED, WEBHOOK_TARGET_URL: value }),
      ).toThrow(/WEBHOOK_TARGET_URL/);
    });

    it('aceita a URL do Compose', () => {
      const url = 'http://web:3000/webhooks/chat';

      expect(
        validateEnv({ ...REQUIRED, WEBHOOK_TARGET_URL: url })
          .WEBHOOK_TARGET_URL,
      ).toBe(url);
    });
  });

  describe('WEBHOOK_SECRET', () => {
    it('é obrigatório', () => {
      const { WEBHOOK_SECRET: _omit, ...rest } = REQUIRED;

      expect(() => validateEnv(rest)).toThrow(/WEBHOOK_SECRET/);
    });

    it.each([
      ['vazio', ''],
      ['só o prefixo', 'whsec_'],
      ['sem o prefixo', 'MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw'],
      ['prefixo em maiúsculas', 'WHSEC_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw'],
      ['prefixo sem o _', 'whsecMfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw'],
      ['texto antes do prefixo', 'xwhsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw'],
      ['base64url (-)', 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLa-w'],
      ['base64url (_)', 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLa_w'],
      ['espaço no meio', 'whsec_MfKQ9r8GKYqr TwjUPD8ILPZIo2LaLaSw'],
      ['espaço no fim', 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw '],
      ['três =', 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLa==='],
      ['= no meio', 'whsec_MfKQ9r8G=KYqrTwjUPD8ILPZIo2LaLaSw'],
      ['placeholder do .env.example', '<webhook-secret>'],
    ])('falha com segredo %s', (_case, value) => {
      expect(() => validateEnv({ ...REQUIRED, WEBHOOK_SECRET: value })).toThrow(
        /WEBHOOK_SECRET/,
      );
    });

    it.each([
      ['base64 sem padding', WEBHOOK_SECRET],
      ['base64 com + e /', 'whsec_ab+/CD=='],
      ['base64 com um =', 'whsec_abcdeQ='],
      [
        '32 bytes aleatórios',
        'whsec_q83vEjRWeJ8nZ/8YyuxNCiGtSOaPSqdX5Ufmil2tU+Q=',
      ],
    ])('aceita whsec_ + %s', (_case, value) => {
      expect(
        validateEnv({ ...REQUIRED, WEBHOOK_SECRET: value }).WEBHOOK_SECRET,
      ).toBe(value);
    });
  });
});
