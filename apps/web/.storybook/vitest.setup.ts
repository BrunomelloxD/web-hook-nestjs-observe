// Mirrors @storybook/addon-vitest's own setup file, plus the project's theme.
// A setProjectAnnotations call here makes the plugin skip its automatic one.
import { setProjectAnnotations } from 'storybook/internal/preview-api';
import { getProjectAnnotations } from 'virtual:/@storybook/builder-vite/project-annotations.js';
import { inject } from 'vitest';
import { server } from 'vitest/browser';

declare module 'vitest' {
  interface ProvidedContext {
    storybookTheme: 'light' | 'dark';
  }
}

// Fixed per project name, not taken from `provide`: if a project provided the
// wrong theme, the ThemeToggle sentinel story would still fail (UI-04 AC15).
const EXPECTED_THEME_BY_PROJECT: Record<string, 'light' | 'dark'> = {
  storybook: 'light',
  'storybook-dark': 'dark',
};

// Browser instances get a suffix: "storybook-dark (chromium)".
const projectName = (server.config.name ?? '').replace(/ \(\w+\)$/, '');
const expectedTheme = EXPECTED_THEME_BY_PROJECT[projectName];
if (!expectedTheme) {
  throw new Error(`Unknown Storybook project "${projectName}".`);
}

setProjectAnnotations([
  getProjectAnnotations(),
  {
    initialGlobals: { theme: inject('storybookTheme') },
    parameters: { expectedTheme },
  },
]);
