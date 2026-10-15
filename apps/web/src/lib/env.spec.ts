import { TEST_WEBHOOK_SECRET } from '../../test/webhooks';
import { getEnv } from './env';

const VALID = {
  API_URL: 'http://api:3333',
  WEBHOOK_SECRET: 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw',
};

describe('getEnv', () => {
  it('retorna as variáveis válidas', () => {
    expect(getEnv(VALID)).toEqual({
      API_URL: 'http://api:3333',
      WEBHOOK_SECRET: 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw',
    });
  });

  it('lê do process.env por padrão', () => {
    expect(getEnv().API_URL).toBe('http://api.test');
    expect(getEnv().WEBHOOK_SECRET).toBe(TEST_WEBHOOK_SECRET);
  });

  it('falha com mensagem clara quando a API_URL é inválida', () => {
    expect(() => getEnv({ ...VALID, API_URL: 'nao-e-url' })).toThrow(
      /Variáveis de ambiente inválidas:[\s\S]*API_URL/,
    );
  });

  describe('WEBHOOK_SECRET', () => {
    it('falha com mensagem clara quando está ausente', () => {
      expect(() => getEnv({ API_URL: VALID.API_URL })).toThrow(
        /Variáveis de ambiente inválidas:[\s\S]*WEBHOOK_SECRET/,
      );
    });

    it.each([
      ['vazio', ''],
      ['sem o prefixo whsec_', 'MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw'],
      ['só o prefixo', 'whsec_'],
      ['com caractere fora do base64', 'whsec_MfKQ9r8GKYqr-TwjUPD8ILPZ'],
      ['com padding a mais', 'whsec_AAEC/w==='],
      ['com o placeholder do .env.example', '<webhook-secret>'],
    ])('falha com mensagem clara quando está %s', (_, secret) => {
      expect(() => getEnv({ ...VALID, WEBHOOK_SECRET: secret })).toThrow(
        /Variáveis de ambiente inválidas:[\s\S]*deve ser whsec_ seguido de base64[\s\S]*WEBHOOK_SECRET/,
      );
    });

    it('aceita whsec_ seguido de base64 com padding', () => {
      expect(
        getEnv({ ...VALID, WEBHOOK_SECRET: 'whsec_AAEC/w==' }).WEBHOOK_SECRET,
      ).toBe('whsec_AAEC/w==');
    });
  });
});
