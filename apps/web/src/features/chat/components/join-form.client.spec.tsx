import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { chatDictionary as t } from '../chat.dictionary';
import {
  JoinForm,
  type JoinAction,
  type JoinFormState,
} from './join-form.client';

function actionReturning(state: JoinFormState) {
  return vi.fn<JoinAction>(async () => state);
}

async function typeAndSubmit(name: string) {
  await userEvent.type(screen.getByLabelText('Seu nome'), name);
  await userEvent.click(screen.getByRole('button', { name: 'Entrar no chat' }));
}

describe('JoinForm', () => {
  it('mostra o cartão com título, um campo "Seu nome" e o botão "Entrar no chat"', () => {
    render(<JoinForm action={actionReturning({ status: 'idle' })} />);

    expect(
      screen.getByRole('heading', { name: t.join.title }),
    ).toBeInTheDocument();
    expect(screen.getByText(t.join.subtitle)).toBeInTheDocument();
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    expect(screen.getByRole('textbox', { name: 'Seu nome' })).toHaveAttribute(
      'name',
      'name',
    );
    expect(
      screen.getByRole('button', { name: 'Entrar no chat' }),
    ).toHaveAttribute('type', 'submit');
    expect(screen.getByText(t.join.help)).toBeInTheDocument();
  });

  it('o cartão ocupa a largura toda e tem 420 px a partir de md', () => {
    const { container } = render(
      <JoinForm action={actionReturning({ status: 'idle' })} />,
    );

    expect(container.firstElementChild).toHaveClass('w-full', 'md:w-[420px]');
  });

  it('envia o nome digitado para a action', async () => {
    const action = actionReturning({ status: 'idle' });
    render(<JoinForm action={action} />);

    await typeAndSubmit('Bruno');

    expect(action).toHaveBeenCalledOnce();
    expect(action.mock.calls[0]![1].get('name')).toBe('Bruno');
  });

  it('sem erro, o campo é descrito só pela dica', () => {
    render(<JoinForm action={actionReturning({ status: 'idle' })} />);

    const name = screen.getByLabelText('Seu nome');
    expect(name).not.toHaveAttribute('aria-invalid');
    expect(name).toHaveAccessibleDescription(t.join.nameHint);
  });

  it('com erro, mostra a mensagem ligada ao campo por aria-describedby', async () => {
    render(
      <JoinForm
        action={actionReturning({
          status: 'error',
          message: t.errors.nameTaken,
          values: { name: 'Ana' },
        })}
      />,
    );

    await typeAndSubmit('Ana');

    const error = await screen.findByText(t.errors.nameTaken);
    const name = screen.getByLabelText('Seu nome');
    expect(error).toHaveClass('text-destructive');
    expect(name.getAttribute('aria-describedby')?.split(' ')).toContain(
      error.id,
    );
    expect(name).toHaveAccessibleDescription(
      expect.stringContaining(t.errors.nameTaken),
    );
    expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(name).toHaveValue('Ana');
  });

  it('desabilita o botão enquanto a action está em andamento', async () => {
    let finish!: (state: JoinFormState) => void;
    const action = vi.fn<JoinAction>(
      () => new Promise((resolve) => (finish = resolve)),
    );
    render(<JoinForm action={action} />);

    await typeAndSubmit('Bruno');

    expect(
      await screen.findByRole('button', { name: t.join.submitting }),
    ).toBeDisabled();
    finish({ status: 'idle' });
    expect(
      await screen.findByRole('button', { name: 'Entrar no chat' }),
    ).toBeEnabled();
  });
});
