import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatError from './error';

describe('ChatError', () => {
  it('mostra "Não foi possível carregar a sala" e chama retry() em "Tentar novamente"', async () => {
    const retry = vi.fn();
    render(<ChatError retry={retry} />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Não foi possível carregar a sala',
    );
    expect(retry).not.toHaveBeenCalled();

    await userEvent.click(
      screen.getByRole('button', { name: 'Tentar novamente' }),
    );

    expect(retry).toHaveBeenCalledOnce();
  });
});
