import { defineConfig } from 'vitest/config';
import { decoratorMetadataCoveragePlugin } from './tools/vitest/decorator-metadata-coverage.plugin.js';
import { coverageConfig } from '@repo/vitest-config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [decoratorMetadataCoveragePlugin()],
  test: {
    globals: true,
    root: './',
    // test:cov runs both projects into a single coverage report.
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/*.spec.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'e2e',
          include: ['test/**/*.e2e-spec.ts'],
          // One file at a time: they share the database and port 4599.
          fileParallelism: false,
          // Webhooks go to the test server in test/webhooks.e2e-spec.ts.
          env: {
            LOG_LEVEL: 'silent',
            WEBHOOK_TARGET_URL: 'http://localhost:4599',
          },
        },
      },
    ],
    // Closed list: new entries need justification in the PR.
    coverage: coverageConfig({
      include: ['src/**/*.ts'],
      exclude: [
        'src/generated/**',
        'src/app/main.ts', // logic lives in app.setup.ts
        'src/app/openapi.cli.ts', // logic lives in openapi.ts
        '**/*.spec.ts',
      ],
    }),
  },
});
