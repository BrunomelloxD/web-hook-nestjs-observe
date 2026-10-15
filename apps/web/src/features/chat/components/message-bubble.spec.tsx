import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { chatDictionary as t } from '../chat.dictionary';
import { pickAvatarTone } from '@/components/ui/avatar';
import { ana, carlos, makeMessage, me } from '../test-fixtures';
import { MessageBubble } from './message-bubble';

const createdAt = '2026-10-14T17:05:00.000Z'; // 14:05 in São Paulo

describe('MessageBubble', () => {
  it('mensagem dos outros: à esquerda, com avatar, nome, hora e balão bg-surface', () => {
    render(
      <MessageBubble
        message={makeMessage({ author: carlos, content: 'Opa!', createdAt })}
        own={false}
      />,
    );

    const bubble = screen.getByTestId('message-bubble');
    expect(bubble).toHaveClass('justify-start');
    expect(within(bubble).getByRole('img', { name: 'Carlos' })).toBeVisible();
    expect(within(bubble).getByText('Carlos')).toBeInTheDocument();
    expect(within(bubble).getByText('14:05')).toHaveAttribute(
      'datetime',
      createdAt,
    );
    expect(screen.getByText('Opa!')).toHaveClass('bg-surface', 'text-fg');
    expect(screen.queryByText(t.room.you)).not.toBeInTheDocument();
  });

  it('a cor do avatar vem do id do autor, não do nome (UI-01 AC4)', () => {
    const idTone = pickAvatarTone(ana.id);
    // Precondition: id and name give different tones, so a name seed would show.
    expect(pickAvatarTone(ana.name)).not.toBe(idTone);
    render(
      <MessageBubble message={makeMessage({ author: ana })} own={false} />,
    );

    expect(screen.getByRole('img', { name: ana.name })).toHaveClass(
      `bg-avatar-${idTone}-bg`,
      `text-avatar-${idTone}-fg`,
    );
  });

  it('mensagem própria: à direita, "Você", hora e balão da marca, sem avatar', () => {
    render(
      <MessageBubble
        message={makeMessage({ author: me, content: 'E aí!', createdAt })}
        own
      />,
    );

    const bubble = screen.getByTestId('message-bubble');
    expect(bubble).toHaveClass('justify-end');
    expect(within(bubble).getByText('Você')).toBeInTheDocument();
    expect(within(bubble).queryByText('Bruno')).not.toBeInTheDocument();
    expect(within(bubble).queryByRole('img')).not.toBeInTheDocument();
    expect(within(bubble).getByText('14:05')).toBeInTheDocument();
    expect(screen.getByText('E aí!')).toHaveClass('bg-brand', 'text-on-brand');
  });

  it('mostra <script> como texto literal, sem criar elemento', () => {
    const content = '<script>alert(1)</script>';
    const { container } = render(
      <MessageBubble message={makeMessage({ content })} own={false} />,
    );

    expect(screen.getByTestId('message-content')).toHaveTextContent(content);
    expect(container.querySelector('script')).toBeNull();
  });

  it('quebra uma palavra de 1000 caracteres dentro do balão', () => {
    const content = 'a'.repeat(1000);
    render(<MessageBubble message={makeMessage({ content })} own={false} />);

    expect(screen.getByText(content)).toHaveClass(
      'break-words',
      '[overflow-wrap:anywhere]',
    );
  });

  it('status "sending" mostra "Enviando…"', () => {
    render(<MessageBubble message={makeMessage()} own status="sending" />);

    expect(screen.getByText(t.message.sending)).toBeInTheDocument();
    expect(screen.queryByText(t.message.failed)).not.toBeInTheDocument();
  });

  it('status "failed" mostra "Não enviada" e "Tentar de novo" chama onRetry', async () => {
    const onRetry = vi.fn();
    render(
      <MessageBubble
        message={makeMessage()}
        own
        status="failed"
        onRetry={onRetry}
      />,
    );

    expect(screen.getByText(t.message.failed)).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: t.message.retry }),
    );
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('sem status é "sent": nenhum aviso de envio', () => {
    render(<MessageBubble message={makeMessage()} own />);

    expect(screen.queryByText(t.message.sending)).not.toBeInTheDocument();
    expect(screen.queryByText(t.message.failed)).not.toBeInTheDocument();
  });
});
