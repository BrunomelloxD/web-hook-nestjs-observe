import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn } from 'storybook/test';
import { ThemeToggle } from '@/components/ui/theme-toggle.client';
import { chatDictionary as t } from '../chat.dictionary';
import { JoinForm, type JoinAction } from './join-form.client';

// Server Actions don't run in Storybook: pass a fake via props.
const meta = {
  title: 'Chat/Telas/Entrar',
  component: JoinForm,
  args: { action: fn<JoinAction>(async () => ({ status: 'idle' })) },
  parameters: { layout: 'fullscreen' },
  decorators: [
    // The Entrar page around the card, as in the design frames.
    (Story) => (
      <div className="relative flex min-h-dvh items-center justify-center bg-page p-4 md:p-6">
        <div className="absolute top-4 right-4 md:top-6 md:right-6">
          <ThemeToggle labels={t.theme} />
        </div>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof JoinForm>;

export default meta;
type Story = StoryObj<typeof meta>;

function screenGlobals(viewport: string, theme: 'light' | 'dark') {
  return { theme, viewport: { value: viewport, isRotated: false } };
}

export const NomeEmUso: Story = {
  name: 'Nome em uso',
  args: {
    action: fn<JoinAction>(async () => ({
      status: 'error',
      message: t.errors.nameTaken,
      values: { name: 'Ana' },
    })),
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText(t.join.name), 'Ana');
    await userEvent.click(canvas.getByRole('button', { name: t.join.submit }));
    await expect(await canvas.findByText(t.errors.nameTaken)).toBeVisible();
    await expect(
      canvas.getByLabelText(t.join.name),
    ).toHaveAccessibleDescription(expect.stringContaining(t.errors.nameTaken));
  },
};
export const MobileLight: Story = {
  name: 'Entrar · Mobile · Light',
  globals: screenGlobals('mobile', 'light'),
};
export const MobileDark: Story = {
  name: 'Entrar · Mobile · Dark',
  globals: screenGlobals('mobile', 'dark'),
};
export const TabletLight: Story = {
  name: 'Entrar · Tablet · Light',
  globals: screenGlobals('tablet', 'light'),
};
export const TabletDark: Story = {
  name: 'Entrar · Tablet · Dark',
  globals: screenGlobals('tablet', 'dark'),
};
export const DesktopLight: Story = {
  name: 'Entrar · Desktop · Light',
  globals: screenGlobals('desktop', 'light'),
};
export const DesktopDark: Story = {
  name: 'Entrar · Desktop · Dark',
  globals: screenGlobals('desktop', 'dark'),
};
