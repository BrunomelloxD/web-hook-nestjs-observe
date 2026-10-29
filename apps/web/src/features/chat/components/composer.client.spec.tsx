import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { chatDictionary as t } from '../chat.dictionary';
import type { MessageInput } from '../schemas/message.schema';
import { Composer } from './composer.client';

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const TOO_LONG = 'A mensagem pode ter no máximo 1000 caracteres.';
const RATE_LIMITED =
  'Você está enviando mensagens rápido demais. Aguarde alguns segundos.';

function onSend() {
  return vi.fn<(input: MessageInput) => void>();
}

function field() {
  return screen.getByRole('textbox', { name: t.composer.label });
}

function sendButton() {
  return screen.getByRole('button', { name: 'Enviar' });
}

describe('Composer', () => {
  it('tem o campo rotulado com o placeholder e o botão "Enviar"', () => {
    render(<Composer onSend={onSend()} />);

    expect(field().tagName).toBe('TEXTAREA');
    expect(field()).toHaveAttribute('placeholder', 'Escreva uma mensagem…');
    expect(sendButton()).toHaveAttribute('type', 'submit');
  });

  it('Enter chama a action com { content, clientId } (uuid)', async () => {
    const send = onSend();
    render(<Composer onSend={send} />);

    await userEvent.type(field(), 'Oi, pessoal!{Enter}');

    expect(send).toHaveBeenCalledOnce();
    const [input] = send.mock.calls[0]!;
    expect(input).toEqual({
      content: 'Oi, pessoal!',
      clientId: expect.stringMatching(UUID_V4),
    });
  });

  it('o clique em "Enviar" chama a action com o texto digitado', async () => {
    const send = onSend();
    render(<Composer onSend={send} />);

    await userEvent.type(field(), 'Oi!');
    await userEvent.click(sendButton());

    expect(send).toHaveBeenCalledExactlyOnceWith({
      content: 'Oi!',
      clientId: expect.stringMatching(UUID_V4),
    });
  });

  it('cada envio gera um clientId novo', async () => {
    const send = onSend();
    render(<Composer onSend={send} />);

    await userEvent.type(field(), 'um{Enter}');
    await userEvent.type(field(), 'dois{Enter}');

    expect(send).toHaveBeenCalledTimes(2);
    const [first, second] = send.mock.calls.map(([input]) => input.clientId);
    expect(first).not.toBe(second);
  });

  it('Shift+Enter quebra a linha sem chamar a action', async () => {
    const send = onSend();
    render(<Composer onSend={send} />);

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
      const send = onSend();
      render(<Composer onSend={send} />);

      if (keys) await userEvent.type(field(), keys);
      expect(sendButton()).toBeDisabled();
      await userEvent.type(field(), '{Enter}');

      expect(send).not.toHaveBeenCalled();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    },
  );

  it('1001 caracteres mostra o erro do dicionário, desabilita "Enviar" e Enter não envia', async () => {
    const send = onSend();
    render(<Composer onSend={send} />);

    await userEvent.click(field());
    await userEvent.paste('a'.repeat(1001));
    await userEvent.type(field(), '{Enter}');

    expect(screen.getByRole('alert')).toHaveTextContent(TOO_LONG);
    expect(field()).toHaveAttribute('aria-invalid', 'true');
    expect(sendButton()).toBeDisabled();
    expect(send).not.toHaveBeenCalled();
  });

  it('exatamente 1000 caracteres envia sem erro', async () => {
    const send = onSend();
    render(<Composer onSend={send} />);

    await userEvent.click(field());
    await userEvent.paste('a'.repeat(1000));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(field()).not.toHaveAttribute('aria-invalid');
    await userEvent.type(field(), '{Enter}');
    expect(send).toHaveBeenCalledOnce();
  });

  it('enviar limpa o campo na hora, sem esperar o servidor (OPT-01 AC1)', async () => {
    const send = onSend();
    render(<Composer onSend={send} />);

    await userEvent.type(field(), 'olá{Enter}');

    expect(send).toHaveBeenCalledOnce();
    expect(field()).toHaveValue('');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('dá para enviar a próxima logo em seguida', async () => {
    const send = onSend();
    render(<Composer onSend={send} />);

    await userEvent.type(field(), 'um{Enter}dois{Enter}');

    expect(send.mock.calls.map(([input]) => input.content)).toEqual([
      'um',
      'dois',
    ]);
  });

  it('error aparece acima do campo, como alerta (RATE-02 AC4)', () => {
    render(<Composer onSend={onSend()} error={RATE_LIMITED} />);

    const error = screen.getByRole('alert');
    expect(error).toHaveTextContent(RATE_LIMITED);
    expect(error).toHaveClass('text-destructive');
    expect(error.compareDocumentPosition(field())).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('com o texto longo demais, o erro de tamanho aparece no lugar de error', async () => {
    render(<Composer onSend={onSend()} error={RATE_LIMITED} />);

    await userEvent.click(field());
    await userEvent.paste('a'.repeat(1001));

    expect(screen.getByRole('alert')).toHaveTextContent(TOO_LONG);
  });

  it('notice aparece acima do campo', () => {
    render(<Composer onSend={onSend()} notice={t.errors.reconnecting} />);

    const notice = screen.getByText(t.errors.reconnecting);
    expect(notice.compareDocumentPosition(field())).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('sem erro e sem notice, nada aparece acima do campo', () => {
    render(<Composer onSend={onSend()} />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText(t.errors.reconnecting)).not.toBeInTheDocument();
  });

  describe('aviso de digitando (TYPE-01 AC1)', () => {
    const T0 = new Date('2026-10-29T17:00:00.000Z').getTime();

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(T0);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    /** A keystroke at `ms` after T0 that leaves `value` in the field. */
    function keyAt(ms: number, value: string) {
      vi.setSystemTime(T0 + ms);
      fireEvent.change(field(), { target: { value } });
    }

    it('várias teclas em 2,9 s → uma chamada; tecla em 3 s → segunda chamada', () => {
      const onTyping = vi.fn();
      render(<Composer onSend={onSend()} onTyping={onTyping} />);

      keyAt(0, 'O');
      keyAt(1_000, 'Oi');
      keyAt(2_000, 'Oi,');
      keyAt(2_900, 'Oi, p');
      expect(onTyping).toHaveBeenCalledTimes(1);

      keyAt(3_000, 'Oi, pe');
      expect(onTyping).toHaveBeenCalledTimes(2);
    });

    it('o envio recomeça a janela: tecla em 0, Enter em 1 s, tecla em 1,5 s → duas chamadas (TYPE-01 AC12)', () => {
      const onTyping = vi.fn();
      render(<Composer onSend={onSend()} onTyping={onTyping} />);

      keyAt(0, 'oi');
      vi.setSystemTime(T0 + 1_000);
      fireEvent.keyDown(field(), { key: 'Enter' });
      expect(field()).toHaveValue('');
      keyAt(1_500, 't');

      expect(onTyping).toHaveBeenCalledTimes(2);
    });

    it('apagar tudo não chama', () => {
      const onTyping = vi.fn();
      render(<Composer onSend={onSend()} onTyping={onTyping} />);
      keyAt(0, 'O');

      keyAt(5_000, '');
      keyAt(10_000, '   ');

      expect(onTyping).toHaveBeenCalledTimes(1);
    });

    it('não cria setTimeout nem setInterval', () => {
      const onTyping = vi.fn();
      render(<Composer onSend={onSend()} onTyping={onTyping} />);

      keyAt(0, 'O');
      keyAt(1_000, 'Oi');
      keyAt(4_000, 'Oi!');

      expect(onTyping).toHaveBeenCalledTimes(2);
      expect(vi.getTimerCount()).toBe(0);
    });
  });
});
