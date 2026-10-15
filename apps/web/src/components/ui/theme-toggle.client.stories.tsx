import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect } from 'storybook/test';
import { ThemeToggle } from './theme-toggle.client';

const meta = {
  title: 'UI/ThemeToggle',
  component: ThemeToggle,
  args: { labels: { toDark: 'Usar tema escuro', toLight: 'Usar tema claro' } },
} satisfies Meta<typeof ThemeToggle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  // Sentinel: in Vitest, expectedTheme is fixed by the project name (storybook =
  // light, storybook-dark = dark, .storybook/vitest.setup.ts); in the Storybook
  // UI it follows the toolbar.
  play: async ({ canvas, globals, parameters }) => {
    const expected = parameters['expectedTheme'] ?? globals['theme'];
    await expect(document.documentElement.dataset['theme']).toBe(expected);

    const label = expected === 'dark' ? 'Usar tema claro' : 'Usar tema escuro';
    await expect(canvas.getByRole('button', { name: label })).toBeVisible();
  },
};
