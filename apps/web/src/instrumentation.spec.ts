import { register } from './instrumentation';

describe('register', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('no runtime nodejs, lança quando o WEBHOOK_SECRET é inválido', async () => {
    vi.stubEnv('NEXT_RUNTIME', 'nodejs');
    vi.stubEnv('WEBHOOK_SECRET', 'sem-prefixo');

    await expect(register()).rejects.toThrow(
      /Variáveis de ambiente inválidas:[\s\S]*WEBHOOK_SECRET/,
    );
  });

  it('no runtime nodejs, lança quando o WEBHOOK_SECRET está ausente', async () => {
    vi.stubEnv('NEXT_RUNTIME', 'nodejs');
    vi.stubEnv('WEBHOOK_SECRET', undefined);

    await expect(register()).rejects.toThrow(/WEBHOOK_SECRET/);
  });

  it('no runtime nodejs, sobe com o ambiente válido', async () => {
    vi.stubEnv('NEXT_RUNTIME', 'nodejs');

    await expect(register()).resolves.toBeUndefined();
  });

  // An invalid secret would throw if getEnv() ran, so resolving proves it was skipped.
  it('no runtime edge, não valida o ambiente', async () => {
    vi.stubEnv('NEXT_RUNTIME', 'edge');
    vi.stubEnv('WEBHOOK_SECRET', 'sem-prefixo');

    await expect(register()).resolves.toBeUndefined();
  });

  it('na fase de build, não valida o ambiente', async () => {
    vi.stubEnv('NEXT_RUNTIME', 'nodejs');
    vi.stubEnv('NEXT_PHASE', 'phase-production-build');
    vi.stubEnv('WEBHOOK_SECRET', 'sem-prefixo');

    await expect(register()).resolves.toBeUndefined();
  });
});
