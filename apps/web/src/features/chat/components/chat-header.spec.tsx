import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { chatDictionary as t } from '../chat.dictionary';
import { me } from '../test-fixtures';
import { ChatHeader } from './chat-header';

function renderHeader(leaveAction = vi.fn(async () => {})) {
  render(<ChatHeader me={me} online={8} leaveAction={leaveAction} />);
  return leaveAction;
}

describe('ChatHeader', () => {
  it('mostra o título "Sala geral" e a contagem de online', () => {
    renderHeader();

    expect(
      screen.getByRole('heading', { name: 'Sala geral' }),
    ).toBeInTheDocument();
    expect(screen.getByText('8 pessoas online')).toBeInTheDocument();
  });

  it('mostra o avatar brand do participante e o nome só a partir de md', () => {
    renderHeader();

    const avatar = screen.getByRole('img', { name: 'Bruno' });
    expect(avatar).toHaveTextContent('B');
    expect(avatar).toHaveClass('bg-brand', 'text-on-brand');
    expect(screen.getByText('Bruno')).toHaveClass('hidden', 'md:inline');
  });

  it('tem o ThemeToggle com os rótulos do dicionário', () => {
    renderHeader();

    // jsdom applies no CSS, so both labels are part of the button's name.
    const toggle = screen.getByRole('button', {
      name: new RegExp(t.theme.toDark),
    });
    expect(toggle).toHaveTextContent(t.theme.toDark);
    expect(toggle).toHaveTextContent(t.theme.toLight);
  });

  it('no claro mostra a lua com "Usar tema escuro"; no escuro, o sol com "Usar tema claro" (THEME-03 AC5/AC6)', () => {
    renderHeader();

    // Literal strings: the expected value must not come from the dictionary under test.
    const toDark = screen.getByText('Usar tema escuro').parentElement;
    expect(toDark).toHaveClass('dark:hidden');
    expect(toDark?.querySelector('svg.lucide-moon')).not.toBeNull();
    expect(toDark?.querySelector('svg.lucide-sun')).toBeNull();

    const toLight = screen.getByText('Usar tema claro').parentElement;
    expect(toLight).toHaveClass('hidden', 'dark:inline-flex');
    expect(toLight?.querySelector('svg.lucide-sun')).not.toBeNull();
    expect(toLight?.querySelector('svg.lucide-moon')).toBeNull();
  });

  it('o botão "Sair" fica num form ligado a leaveAction', async () => {
    const leaveAction = renderHeader();

    const leave = screen.getByRole('button', { name: 'Sair' });
    expect(leave.closest('form')).not.toBeNull();
    expect(leave).toHaveAttribute('type', 'submit');

    await userEvent.click(leave);

    await waitFor(() => expect(leaveAction).toHaveBeenCalledOnce());
  });
});
