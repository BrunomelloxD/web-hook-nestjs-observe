import { generateToken, hashToken, toNameKey } from '../participant-token.js';

describe('participant-token', () => {
  describe('generateToken', () => {
    it('gera 32 bytes em base64url: 43 caracteres, sem padding, sem "." / "+" / "/"', () => {
      // Many samples so a plain base64 alphabet ("+", "/") would surface.
      const tokens = Array.from({ length: 200 }, () => generateToken());

      for (const token of tokens) {
        expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
        expect(token).not.toContain('.');
        expect(Buffer.from(token, 'base64url')).toHaveLength(32);
      }
    });

    it('gera um token diferente a cada chamada', () => {
      const tokens = new Set(Array.from({ length: 50 }, () => generateToken()));

      expect(tokens.size).toBe(50);
    });
  });

  describe('hashToken', () => {
    it('devolve o SHA-256 em hex (64 caracteres minúsculos)', () => {
      expect(hashToken('abc')).toBe(
        'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
      );
    });

    it('é determinístico e distingue tokens diferentes', () => {
      const token = generateToken();

      expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/);
      expect(hashToken(token)).toBe(hashToken(token));
      expect(hashToken('abd')).not.toBe(hashToken('abc'));
    });
  });

  describe('toNameKey', () => {
    it('ignora maiúsculas e minúsculas', () => {
      expect(toNameKey('ANA')).toBe('ana');
      expect(toNameKey('ana')).toBe('ana');
      expect(toNameKey('Ana')).toBe(toNameKey('ANA'));
    });

    it('dá a mesma chave para as formas NFD e NFC de "Érica"', () => {
      const nfc = 'Érica';
      const nfd = 'Érica';

      expect(nfd).not.toBe(nfc);
      expect(toNameKey(nfc)).toBe('érica');
      expect(toNameKey(nfd)).toBe('érica');
    });

    it('não altera espaços nem outros caracteres permitidos', () => {
      expect(toNameKey('Ana Paula_1.b-c')).toBe('ana paula_1.b-c');
    });
  });
});
