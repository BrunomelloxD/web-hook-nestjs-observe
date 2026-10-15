import { defineConfig } from 'prisma/config';

// Outside Docker; Compose injects the variables.
try {
  process.loadEnvFile();
} catch {
  // No .env file: use the environment.
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seeds/index.ts',
  },
  datasource: {
    url: process.env['DATABASE_URL'],
  },
});
