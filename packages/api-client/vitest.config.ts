import { defineConfig } from 'vitest/config';
import { coverageConfig } from '@repo/vitest-config';

export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/*.spec.ts'],
    // Closed list: new entries need justification in the PR.
    coverage: coverageConfig({
      include: ['src/**/*.ts'],
      exclude: ['src/schema.d.ts', '**/*.spec.ts'],
    }),
  },
});
