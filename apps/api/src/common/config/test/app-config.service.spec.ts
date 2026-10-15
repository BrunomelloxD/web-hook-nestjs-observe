import type { ConfigService } from '@nestjs/config';
import { AppConfigService } from '../app-config.service.js';
import type { Env } from '../env.schema.js';

function serviceWith(env: Partial<Env>) {
  const config = {
    get: vi.fn((key: keyof Env) => env[key]),
  } as unknown as ConfigService<Env, true>;
  return new AppConfigService(config);
}

describe('AppConfigService', () => {
  it('lê as variáveis tipadas do ConfigService', () => {
    expect(serviceWith({ PORT: 4000 }).get('PORT')).toBe(4000);
  });

  it('isProduction é true só em produção', () => {
    expect(serviceWith({ NODE_ENV: 'production' }).isProduction).toBe(true);
    expect(serviceWith({ NODE_ENV: 'development' }).isProduction).toBe(false);
  });

  it('webhookTargetUrl e webhookSecret leem WEBHOOK_TARGET_URL e WEBHOOK_SECRET', () => {
    const service = serviceWith({
      WEBHOOK_TARGET_URL: 'http://web:3000/webhooks/chat',
      WEBHOOK_SECRET: 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw',
    });

    expect(service.webhookTargetUrl).toBe('http://web:3000/webhooks/chat');
    expect(service.webhookSecret).toBe(
      'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw',
    );
  });
});
