import { Controller, Get, INestApplication, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppConfigService } from '@/common/config/app-config.service.js';
import { setupApp, SWAGGER_PATH } from '../app.setup.js';

@Controller('ping')
class PingController {
  @Get()
  ping() {
    return { ok: true };
  }
}

@Module({ controllers: [PingController] })
class PingModule {}

async function createApp(isProduction: boolean) {
  const moduleRef = await Test.createTestingModule({
    imports: [PingModule],
    providers: [
      {
        provide: AppConfigService,
        useValue: {
          isProduction,
          get: (key: string) =>
            key === 'CORS_ORIGIN' ? ['http://localhost:3000'] : 'test-app',
        },
      },
    ],
  }).compile();

  const app: INestApplication<App> = moduleRef.createNestApplication({
    logger: false,
  });
  setupApp(app);
  await app.init();
  return app;
}

describe('setupApp', () => {
  describe('fora de produção', () => {
    let app: INestApplication<App>;
    beforeAll(async () => (app = await createApp(false)));
    afterAll(() => app.close());

    it('expõe o Swagger', () => {
      return request(app.getHttpServer()).get(`/${SWAGGER_PATH}`).expect(200);
    });

    it('desliga o CSP do helmet para a UI do Swagger funcionar', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/ping');

      expect(res.headers['content-security-policy']).toBeUndefined();
    });

    it('aplica o prefixo /api e a versão v1', () => {
      return request(app.getHttpServer())
        .get('/api/v1/ping')
        .expect(200, { ok: true });
    });
  });

  describe('em produção', () => {
    let app: INestApplication<App>;
    beforeAll(async () => (app = await createApp(true)));
    afterAll(() => app.close());

    it('não expõe o Swagger', () => {
      return request(app.getHttpServer()).get(`/${SWAGGER_PATH}`).expect(404);
    });

    it('mantém o CSP do helmet ativo', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/ping');

      expect(res.headers['content-security-policy']).toBeDefined();
    });
  });

  it('responde ao preflight de CORS da origem configurada', async () => {
    const app = await createApp(false);

    const res = await request(app.getHttpServer())
      .options('/api/v1/ping')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'PATCH');

    expect(res.headers['access-control-allow-origin']).toBe(
      'http://localhost:3000',
    );
    expect(res.headers['access-control-allow-methods']).toContain('PATCH');
    await app.close();
  });
});
