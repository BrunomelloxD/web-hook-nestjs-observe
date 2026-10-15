import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { chatDictionary as t } from '../chat.dictionary';
import type {
  SendMessageAction,
  SendMessageResult,
} from '../schemas/message.schema';
import { makeMessage } from '../test-fixtures';
import { Composer } from './composer.client';

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const TOO_LONG = 'A mensagem pode ter no máximo 1000 caracteres.';
const SEND_FAILED = 'Não foi possível enviar a mensagem. Tente de novo.';

function sendReturning(result: SendMessageResult) {
  return vi.fn<SendMessageAction>(async () => result);
}

const ok: SendMessageResult = { ok: true, message: makeMessage() };

function field() {
  return screen.getByRole('textbox', { name: t.composer.label });
}

function sendButton() {
  return screen.getByRole('button', { name: 'Enviar' });
}

describe('Composer', () => {
  it('tem o campo rotulado com o placeholder e o botão "Enviar"', () => {
    render(<Composer send={sendReturning(ok)} />);

    expect(field().tagName).toBe('TEXTAREA');
    expect(field()).toHaveAttribute('placeholder', 'Escreva uma mensagem…');
    expect(sendButton()).toHaveAttribute('type', 'submit');
  });

  it('Enter chama a action com { content, clientId } (uuid)', async () => {
    const send = sendReturning(ok);
    render(<Composer send={send} />);

    await userEvent.type(field(), 'Oi, pessoal!{Enter}');

    expect(send).toHaveBeenCalledOnce();
    const [input] = send.mock.calls[0]!;
    expect(input).toEqual({
      content: 'Oi, pessoal!',
      clientId: expect.stringMatching(UUID_V4),
    });
  });

  it('o clique em "Enviar" chama a action com o texto digitado', async () => {
    const send = sendReturning(ok);
    render(<Composer send={send} />);

    await userEvent.type(field(), 'Oi!');
    await userEvent.click(sendButton());

    expect(send).toHaveBeenCalledExactlyOnceWith({
      content: 'Oi!',
      clientId: expect.stringMatching(UUID_V4),
    });
  });

  it('cada envio gera um clientId novo', async () => {
    const send = sendReturning(ok);
    render(<Composer send={send} />);

    await userEvent.type(field(), 'um{Enter}');
    await userEvent.type(field(), 'dois{Enter}');

    expect(send).toHaveBeenCalledTimes(2);
    const [first, second] = send.mock.calls.map(([input]) => input.clientId);
    expect(first).not.toBe(second);
  });

  it('Shift+Enter quebra a linha sem chamar a action', async () => {
    const send = sendReturning(ok);
    render(<Composer send={send} />);

    await userEvent.type(field(), 'linha 1{Shift>}{Enter}{/Shift}linha 2');

    expect(send).not.toHaveBeenCalled();
    expect(field()).toHaveValue('linha 1\nlinha 2');
  });

  it.each([
    ['vazio', ''],
    ['só espaços', '   '],
    ['só quebras de linha', '{Shift>}{Enter}{Enter}{/Shift}'],
  ])(
    'conteúdo %s deixa "Enviar" desabilitado e Enter não envia',
    async (_case, keys) => {
      const send = sendReturning(ok);
      render(<Composer send={send} />);

      if (keys) await userEvent.type(field(), keys);
      expect(sendButton()).toBeDisabled();
      await userEvent.type(field(), '{Enter}');

      expect(send).not.toHaveBeenCalled();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    },
  );

  it('1001 caracteres mostra o erro do dicionário, desabilita "Enviar" e Enter não envia', async () => {
    const send = sendReturning(ok);
    render(<Composer send={send} />);

    await userEvent.click(field());
    await userEvent.paste('a'.repeat(1001));
    await userEvent.type(field(), '{Enter}');

    expect(screen.getByRole('alert')).toHaveTextContent(TOO_LONG);
    expect(field()).toHaveAttribute('aria-invalid', 'true');
    expect(sendButton()).toBeDisabled();
    expect(send).not.toHaveBeenCalled();
  });

  it('exatamente 1000 caracteres envia sem erro', async () => {
    const send = sendReturning(ok);
    render(<Composer send={send} />);

    await userEvent.click(field());
    await userEvent.paste('a'.repeat(1000));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(field()).not.toHaveAttribute('aria-invalid');
    await userEvent.type(field(), '{Enter}');
    expect(send).toHaveBeenCalledOnce();
  });

  it('ok: true limpa o campo', async () => {
    render(<Composer send={sendReturning(ok)} />);

    await userEvent.type(field(), 'olá{Enter}');

    expect(field()).toHaveValue('');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it.each(['invalid', 'unexpected'] as const)(
    'ok: false (%s) mantém o texto e mostra o erro de envio',
    async (reason) => {
      render(<Composer send={sendReturning({ ok: false, reason })} />);

      await userEvent.type(field(), 'olá{Enter}');

      expect(await screen.findByRole('alert')).toHaveTextContent(SEND_FAILED);
      expect(field()).toHaveValue('olá');
    },
  );

  it('o erro de envio sai quando o próximo envio dá certo', async () => {
    const send = vi
      .fn<SendMessageAction>()
      .mockResolvedValueOnce({ ok: false, reason: 'unexpected' })
      .mockResolvedValueOnce(ok);
    render(<Composer send={send} />);

    await userEvent.type(field(), 'olá{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent(SEND_FAILED);
    await userEvent.type(field(), '{Enter}');

    expect(field()).toHaveValue('');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('enquanto envia, "Enviar" fica desabilitado e Enter não envia de novo', async () => {
    let finish!: (result: SendMessageResult) => void;
    const send = vi.fn<SendMessageAction>(
      () => new Promise((resolve) => (finish = resolve)),
    );
    render(<Composer send={send} />);

    await userEvent.type(field(), 'olá{Enter}');
    expect(sendButton()).toBeDisabled();
    await userEvent.type(field(), '{Enter}');
    expect(send).toHaveBeenCalledOnce();

    finish(ok);
    expect(
      await screen.findByRole('button', { name: 'Enviar' }),
    ).toBeDisabled();
    expect(field()).toHaveValue('');
  });

  it('o erro aparece acima do campo', async () => {
    render(
      <Composer send={sendReturning({ ok: false, reason: 'unexpected' })} />,
    );

    await userEvent.type(field(), 'olá{Enter}');

    const error = await screen.findByRole('alert');
    expect(error).toHaveClass('text-destructive');
    expect(error.compareDocumentPosition(field())).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('notice aparece acima do campo', () => {
    render(
      <Composer send={sendReturning(ok)} notice={t.errors.reconnecting} />,
    );

    const notice = screen.getByText(t.errors.reconnecting);
    expect(notice.compareDocumentPosition(field())).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('sem erro e sem notice, nada aparece acima do campo', () => {
    render(<Composer send={sendReturning(ok)} />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText(t.errors.reconnecting)).not.toBeInTheDocument();
  });
});
