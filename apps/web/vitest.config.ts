import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { coverageConfig } from '@repo/vitest-config';

const dirname = path.dirname(fileURLToPath(import.meta.url));

// Stories as tests in real Chromium (render, play functions, a11y).
function storybookProject(name: string, theme: 'light' | 'dark') {
  return {
    extends: true as const,
    plugins: [storybookTest({ configDir: path.join(dirname, '.storybook') })],
    test: {
      name,
      provide: { storybookTheme: theme },
      setupFiles: ['./.storybook/vitest.setup.ts'],
      browser: {
        enabled: true,
        headless: true,
        provider: playwright({}),
        instances: [{ browser: 'chromium' as const }],
      },
    },
  };
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
    alias: {
      // Tests lack the "react-server" condition, so server-only would throw.
      'server-only': path.join(dirname, 'test/stubs/server-only.ts'),
    },
  },
  test: {
    globals: true,
    projects: [
      {
        // Only unit tests count toward the 100% coverage.
        extends: true,
        test: {
          name: 'unit',
          environment: 'jsdom',
          include: ['src/**/*.spec.{ts,tsx}'],
          setupFiles: ['./test/setup.ts'],
        },
      },
      storybookProject('storybook', 'light'),
      // SPEC_DEVIATION: design used `define` for VITE_STORYBOOK_THEME.
      // Reason: define leaked across the two browser projects; `provide` + setup file doesn't.
      storybookProject('storybook-dark', 'dark'),
    ],
    // Closed list: new entries need justification in the PR.
    coverage: coverageConfig({
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        '**/*.spec.{ts,tsx}',
        '**/*.stories.tsx', // tested in the storybook project
        'src/**/*.types.ts', // types only
      ],
    }),
  },
});
