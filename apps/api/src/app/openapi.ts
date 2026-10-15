import { writeFile } from 'node:fs/promises';
import { NestFactory } from '@nestjs/core';
import type { OpenAPIObject } from '@nestjs/swagger';
import { configureRouting, createOpenApiDocument } from './app.setup.js';

// ConfigModule requires these, but the export never connects or signs.
const PLACEHOLDER_DATABASE_URL =
  'postgresql://openapi:openapi@localhost/openapi';
const PLACEHOLDER_WEBHOOK_TARGET_URL = 'http://localhost/openapi';
const PLACEHOLDER_WEBHOOK_SECRET = 'whsec_b3BlbmFwaQ==';

/** Preview mode skips provider instantiation, so no database is needed. */
export async function buildOpenApiDocument(): Promise<OpenAPIObject> {
  process.env['DATABASE_URL'] ??= PLACEHOLDER_DATABASE_URL;
  process.env['WEBHOOK_TARGET_URL'] ??= PLACEHOLDER_WEBHOOK_TARGET_URL;
  process.env['WEBHOOK_SECRET'] ??= PLACEHOLDER_WEBHOOK_SECRET;

  // ConfigModule validates env when AppModule is imported.
  const { AppModule } = await import('./app.module.js');
  const app = await NestFactory.create(AppModule, {
    preview: true,
    logger: false,
  });

  configureRouting(app);
  const document = createOpenApiDocument(app, process.env['APP_NAME'] ?? 'api');
  await app.close();

  return document;
}

export async function exportOpenApi(outputPath: string): Promise<void> {
  const document = await buildOpenApiDocument();
  await writeFile(outputPath, `${JSON.stringify(document, null, 2)}\n`);
}
