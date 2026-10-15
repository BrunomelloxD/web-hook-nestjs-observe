import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { redirect } from 'next/navigation';
import { FakeEventSource } from '../../../../test/fake-event-source';
import { getMessages } from '../queries/get-messages';
import type { SendMessageAction } from '../schemas/message.schema';
import {
  getValidSession,
  type ValidSession,
} from '../session/get-valid-session';
import {
  ana,
  carlos,
  makeConversation,
  makeMessage,
  me,
} from '../test-fixtures';
import { ChatRoomContainer } from './chat-room.container';

vi.mock('../session/get-valid-session', () => ({ getValidSession: vi.fn() }));
vi.mock('../queries/get-messages', () => ({ getMessages: vi.fn() }));
// Like Next, redirect() throws: anything after it never runs.
vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
}));

const TOKEN = 'q1W2e3R4t5Y6u7I8o9P0a_S-d1F2g3H4j5K6l7Z8x9C';

function validSession(
  who = me,
  online: ValidSession['online'] = { items: [ana, who], total: 7 },
): ValidSession {
  return { session: { participantId: who.id, token: TOKEN }, me: who, online };
}

function actions() {
  return {
    send: vi.fn<SendMessageAction>(async () => ({
      ok: true,
      message: makeMessage(),
    })),
    leave: vi.fn(async () => {}),
  };
}

/** Vitest can't render async components: call it and render the result. */
async function renderRoom(props = actions()) {
  render(await ChatRoomContainer({ actions: props }));
  return props;
}

/** jsdom has no EventSource: the ChatStream inside the container opens this one. */
const opened: FakeEventSource[] = [];
class RecordedEventSource extends FakeEventSource {
  constructor(url: string) {
    super(url);
    opened.push(this);
  }
}

function bubbleOf(text: string) {
  return screen.getByText(text).closest('[data-testid="message-bubble"]')!;
}

describe('ChatRoomContainer', () => {
  beforeEach(() => {
    opened.length = 0;
    vi.stubGlobal('EventSource', RecordedEventSource);
    vi.mocked(redirect).mockClear();
    vi.mocked(getMessages).mockReset();
    vi.mocked(getMessages).mockResolvedValue(makeConversation());
  });
  afterEach(() => vi.unstubAllGlobals());

  it('sessão inválida → redirect("/session/end") sem buscar mensagens', async () => {
    vi.mocked(getValidSession).mockResolvedValue(null);

    await expect(ChatRoomContainer({ actions: actions() })).rejects.toThrow(
      'NEXT_REDIRECT',
    );

    expect(redirect).toHaveBeenCalledExactlyOnceWith('/session/end');
    expect(getMessages).not.toHaveBeenCalled();
    expect(opened).toEqual([]);
  });

  it('renderiza o ChatStream com os dados iniciais: abre /chat/stream e aplica os eventos ao vivo (SSE-02 AC8)', async () => {
    vi.mocked(getValidSession).mockResolvedValue(validSession());

    await renderRoom();

    expect(opened.map((source) => source.url)).toEqual(['/chat/stream']);
    act(() => {
      opened[0]!.emit(
        'message',
        makeMessage({ id: 'm-7', seq: 7, author: ana, content: 'ao vivo' }),
      );
      opened[0]!.emit('presence', { online: 9 });
    });
    const items = within(
      screen.getByRole('list', { name: 'Mensagens' }),
    ).getAllByRole('listitem');
    expect(items).toHaveLength(7);
    expect(items[6]).toHaveTextContent('ao vivo');
    expect(
      within(screen.getByRole('banner')).getByText('9 pessoas online'),
    ).toBeInTheDocument();
  });

  it('sessão válida → busca as últimas 50 mensagens e mostra na ordem recebida', async () => {
    vi.mocked(getValidSession).mockResolvedValue(validSession());

    await renderRoom();

    expect(getMessages).toHaveBeenCalledExactlyOnceWith({ limit: 50 });
    const items = within(
      screen.getByRole('list', { name: 'Mensagens' }),
    ).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining('Ana entrou no chat'),
      expect.stringContaining('Oi, pessoal! Alguém por aqui?'),
      expect.stringContaining('Opa, Ana! Cheguei agora. Como tá o dia?'),
      expect.stringContaining('Bruno entrou no chat'),
      expect.stringContaining('E aí, galera! Primeira vez aqui no chat.'),
      expect.stringContaining('Seja bem-vindo, Bruno! Fica à vontade. 😊'),
    ]);
  });

  it('o cabeçalho mostra "Sala geral", o total de GET /participants/online e o nome do participante', async () => {
    vi.mocked(getValidSession).mockResolvedValue(validSession());

    await renderRoom();

    const header = screen.getByRole('banner');
    expect(within(header).getByRole('heading')).toHaveTextContent('Sala geral');
    // total (7), not items.length (2).
    expect(within(header).getByText('7 pessoas online')).toBeInTheDocument();
    expect(within(header).getByText('Bruno')).toBeInTheDocument();
    expect(
      within(header).getByRole('button', { name: 'Sair' }),
    ).toBeInTheDocument();
  });

  it('total 1 → "1 pessoa online"', async () => {
    vi.mocked(getValidSession).mockResolvedValue(
      validSession(me, { items: [me], total: 1 }),
    );

    await renderRoom();

    expect(
      within(screen.getByRole('banner')).getByText('1 pessoa online'),
    ).toBeInTheDocument();
  });

  it('mensagens USER do participante da sessão são próprias; as outras, dos outros', async () => {
    vi.mocked(getValidSession).mockResolvedValue(validSession(me));

    await renderRoom();

    expect(bubbleOf('E aí, galera! Primeira vez aqui no chat.')).toHaveClass(
      'justify-end',
    );
    expect(bubbleOf('Oi, pessoal! Alguém por aqui?')).toHaveClass(
      'justify-start',
    );
    expect(bubbleOf('Opa, Ana! Cheguei agora. Como tá o dia?')).toHaveClass(
      'justify-start',
    );
  });

  it('com outra sessão, as mensagens próprias mudam pelo me.id', async () => {
    vi.mocked(getValidSession).mockResolvedValue(
      validSession(carlos, { items: [carlos], total: 1 }),
    );

    await renderRoom();

    expect(bubbleOf('Opa, Ana! Cheguei agora. Como tá o dia?')).toHaveClass(
      'justify-end',
    );
    expect(bubbleOf('E aí, galera! Primeira vez aqui no chat.')).toHaveClass(
      'justify-start',
    );
  });

  it('sala sem mensagens mostra o estado vazio', async () => {
    vi.mocked(getValidSession).mockResolvedValue(validSession());
    vi.mocked(getMessages).mockResolvedValue([]);

    await renderRoom();

    expect(
      screen.getByText('Nenhuma mensagem ainda. Diga oi!'),
    ).toBeInTheDocument();
  });

  it('nunca renderiza o content como HTML', async () => {
    vi.mocked(getValidSession).mockResolvedValue(validSession());
    vi.mocked(getMessages).mockResolvedValue([
      makeMessage({
        id: 'x',
        author: ana,
        content: '<img src=x onerror=alert(1)><b>negrito</b>',
      }),
    ]);

    await renderRoom();

    const list = screen.getByRole('list', { name: 'Mensagens' });
    expect(
      within(list).getByText('<img src=x onerror=alert(1)><b>negrito</b>'),
    ).toBeInTheDocument();
    expect(list.querySelector('img, b')).toBeNull();
  });

  it('o Composer recebe a action send da página', async () => {
    vi.mocked(getValidSession).mockResolvedValue(validSession());
    const props = await renderRoom();

    await userEvent.type(
      screen.getByRole('textbox', { name: 'Mensagem' }),
      'olá{Enter}',
    );

    expect(props.send).toHaveBeenCalledExactlyOnceWith({
      content: 'olá',
      clientId: expect.any(String),
    });
  });

  it('o botão "Sair" chama a action leave da página', async () => {
    vi.mocked(getValidSession).mockResolvedValue(validSession());
    const props = await renderRoom();

    await userEvent.click(screen.getByRole('button', { name: 'Sair' }));

    expect(props.leave).toHaveBeenCalledOnce();
    expect(props.send).not.toHaveBeenCalled();
  });
});
