import {
  INestApplication,
  RequestMethod,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppConfigService } from '@/common/config/app-config.service.js';

export const SWAGGER_PATH = 'swagger-api';

/** Shared with the OpenAPI export so both produce the same routes. */
export function configureRouting(app: INestApplication): void {
  app.setGlobalPrefix('api', {
    exclude: [
      { path: 'health', method: RequestMethod.ALL },
      { path: 'health/*path', method: RequestMethod.ALL },
    ],
  });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
}

export function createOpenApiDocument(
  app: INestApplication,
  appName: string,
): OpenAPIObject {
  return SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle(appName)
      .setDescription(`Documentação da API ${appName}`)
      .setVersion('1.0')
      .addBearerAuth()
      .build(),
  );
}

/** Shared by main.ts and the e2e tests. */
export function setupApp(app: INestApplication): void {
  const config = app.get(AppConfigService);
  const swaggerEnabled = !config.isProduction;

  // Swagger UI needs inline scripts.
  app.use(
    helmet({ contentSecurityPolicy: swaggerEnabled ? false : undefined }),
  );

  app.enableCors({
    origin: config.get('CORS_ORIGIN'),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
  });

  configureRouting(app);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableShutdownHooks();

  if (swaggerEnabled) {
    SwaggerModule.setup(
      SWAGGER_PATH,
      app,
      createOpenApiDocument(app, config.get('APP_NAME')),
    );
  }
}
