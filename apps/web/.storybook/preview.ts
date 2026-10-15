import type { Preview } from '@storybook/nextjs-vite';
import '../src/app/globals.css';

const preview: Preview = {
  tags: ['autodocs'],
  globalTypes: {
    theme: {
      description: 'Tema',
      toolbar: {
        title: 'Tema',
        icon: 'mirror',
        items: [
          { value: 'light', title: 'Claro', icon: 'sun' },
          { value: 'dark', title: 'Escuro', icon: 'moon' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    // The storybook-dark Vitest project overrides it (.storybook/vitest.setup.ts).
    theme: 'light',
  },
  decorators: [
    (Story, { globals }) => {
      // Same attribute the app's inline script sets, so the CSS tokens follow it.
      document.documentElement.dataset['theme'] = globals['theme'];
      document.body.style.backgroundColor = 'var(--bg-page)';
      return Story();
    },
  ],
  parameters: {
    layout: 'padded',
    // The App Router mock breaks on Next 16.4 (see ARCHITECTURE.md, Storybook).
    nextjs: { appDirectory: false },
    controls: {
      matchers: { color: /(background|color)$/i, date: /Date$/i },
    },
    // Same sizes as the design frames.
    viewport: {
      options: {
        mobile: {
          name: 'mobile',
          styles: { width: '390px', height: '844px' },
          type: 'mobile',
        },
        tablet: {
          name: 'tablet',
          styles: { width: '768px', height: '1024px' },
          type: 'tablet',
        },
        desktop: {
          name: 'desktop',
          styles: { width: '1440px', height: '900px' },
          type: 'desktop',
        },
      },
    },
    // a11y violations fail story tests.
    a11y: { test: 'error' },
  },
};

export default preview;
