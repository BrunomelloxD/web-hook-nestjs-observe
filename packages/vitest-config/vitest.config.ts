import { defineConfig } from 'vitest/config';
import { coverageConfig } from './src/index.js';

export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/*.spec.ts'],
    coverage: coverageConfig({
      include: ['src/**/*.ts'],
      exclude: ['**/*.spec.ts'],
    }),
  },
});
