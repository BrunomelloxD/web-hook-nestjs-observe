import { readFileSync } from 'node:fs';
import path from 'node:path';
import { render, screen } from '@testing-library/react';
import { join } from '@/features/chat';
import JoinPage from './page';

const formProps = vi.hoisted(() => vi.fn());

// Feature parts are tested on their own.
vi.mock('@/features/chat', async () => ({
  chatDictionary: (await import('@/features/chat/client')).chatDictionary,
  join: vi.fn(),
  JoinForm: (props: { action: unknown }) => {
    formProps(props);
    return <form aria-label="entrar" />;
  },
}));

describe('JoinPage', () => {
  it('renderiza o JoinForm com a action join', () => {
    render(<JoinPage />);

    expect(screen.getByRole('form', { name: 'entrar' })).toBeInTheDocument();
    expect(formProps).toHaveBeenCalledWith({ action: join });
  });

  it('tem o botão de tema com os rótulos do chat', () => {
    render(<JoinPage />);

    // Both labels are in the HTML; CSS shows one (THEME-03).
    const toggle = screen.getByRole('button', { name: /Usar tema escuro/ });
    expect(toggle).toHaveTextContent('Usar tema escuro');
    expect(toggle).toHaveTextContent('Usar tema claro');
  });

  it('não lê dados da requisição: o redirect é do proxy (AD-002)', () => {
    const source = readFileSync(path.join(__dirname, 'page.tsx'), 'utf8');

    expect(source).not.toContain('next/headers');
    expect(source).not.toContain('redirect');
  });
});
