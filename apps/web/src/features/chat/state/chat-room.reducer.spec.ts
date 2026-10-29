import {
  ana,
  carlos,
  makeMessage,
  makeParticipant,
  me,
} from '../test-fixtures';
import {
  chatRoomReducer,
  initChatRoom,
  selectItems,
  selectTypingNames,
  type ChatRoomAction,
  type ChatRoomState,
} from './chat-room.reducer';

function msg(seq: number) {
  return makeMessage({ id: `m-${seq}`, seq, content: `mensagem ${seq}` });
}

function seqs(state: ChatRoomState) {
  return state.messages.map((message) => message.seq);
}

describe('initChatRoom', () => {
  it('monta o estado com as mensagens e o online iniciais, sem pendentes e com a conexão aberta', () => {
    const messages = [msg(1), msg(2)];

    expect(initChatRoom({ messages, online: 3 })).toEqual({
      messages: [msg(1), msg(2)],
      online: 3,
      pending: [],
      connection: 'open',
      typing: {},
      history: { hasMore: false, status: 'idle' },
    });
  });
});

describe('chatRoomReducer', () => {
  describe('message/received', () => {
    it('seq maior que todos vai para o fim (SSE-02 AC9)', () => {
      const state = initChatRoom({ messages: [msg(1), msg(2)], online: 1 });

      const next = chatRoomReducer(state, {
        type: 'message/received',
        message: msg(5),
      });

      expect(seqs(next)).toEqual([1, 2, 5]);
      expect(next.messages[2]).toEqual(msg(5));
      expect(next.online).toBe(1);
    });

    it('seq no meio entra na posição de ordem crescente (SSE-02 AC9)', () => {
      const state = initChatRoom({
        messages: [msg(1), msg(3), msg(4), msg(8)],
        online: 1,
      });

      const next = chatRoomReducer(state, {
        type: 'message/received',
        message: msg(6),
      });

      expect(seqs(next)).toEqual([1, 3, 4, 6, 8]);
    });

    it('seq menor que todos vai para o começo (SSE-02 AC9)', () => {
      const state = initChatRoom({ messages: [msg(4), msg(7)], online: 1 });

      const next = chatRoomReducer(state, {
        type: 'message/received',
        message: msg(2),
      });

      expect(seqs(next)).toEqual([2, 4, 7]);
    });

    it('lista vazia recebe a primeira mensagem', () => {
      const state = initChatRoom({ messages: [], online: 0 });

      const next = chatRoomReducer(state, {
        type: 'message/received',
        message: msg(9),
      });

      expect(seqs(next)).toEqual([9]);
    });

    it('fora de ordem (7, 5, 6) termina em ordem crescente (premissa "Ordem de chegada")', () => {
      let state = initChatRoom({ messages: [msg(4)], online: 1 });

      for (const seq of [7, 5, 6]) {
        state = chatRoomReducer(state, {
          type: 'message/received',
          message: msg(seq),
        });
      }

      expect(seqs(state)).toEqual([4, 5, 6, 7]);
    });

    it.each([1, 3, 5])(
      'seq %i já presente → devolve a mesma referência de estado (SSE-02 AC10)',
      (seq) => {
        const state = initChatRoom({
          messages: [msg(1), msg(3), msg(5)],
          online: 2,
        });

        const next = chatRoomReducer(state, {
          type: 'message/received',
          message: makeMessage({ id: 'outro', seq, content: 'duplicada' }),
        });

        expect(next).toBe(state);
        expect(seqs(next)).toEqual([1, 3, 5]);
      },
    );

    it('não altera o array do estado anterior', () => {
      const messages = [msg(1), msg(3)];
      const state = initChatRoom({ messages, online: 1 });

      chatRoomReducer(state, { type: 'message/received', message: msg(2) });

      expect(seqs(state)).toEqual([1, 3]);
    });
  });

  describe('presence/changed', () => {
    it('troca o online e mantém as mensagens (SSE-02 AC11)', () => {
      const state = initChatRoom({ messages: [msg(1)], online: 2 });

      const next = chatRoomReducer(state, {
        type: 'presence/changed',
        online: 4,
      });

      expect(next.online).toBe(4);
      expect(next.messages).toBe(state.messages);
    });
  });
});

describe('envio otimista (OPT-01)', () => {
  const CLIENT_ID = 'c0000000-0000-4000-8000-000000000001';
  const CREATED_AT = '2026-10-14T17:40:00.000Z';

  function optimistic(clientId = CLIENT_ID, content = 'minha'): ChatRoomAction {
    return {
      type: 'message/optimistic',
      clientId,
      content,
      createdAt: CREATED_AT,
    };
  }

  /** The server's copy of the optimistic message. */
  function own(seq: number, clientId = CLIENT_ID) {
    return makeMessage({ id: `m-${seq}`, seq, clientId, content: 'minha' });
  }

  function reduce(state: ChatRoomState, ...actions: ChatRoomAction[]) {
    return actions.reduce(chatRoomReducer, state);
  }

  const start = () => initChatRoom({ messages: [msg(1), msg(2)], online: 1 });

  it('message/optimistic entra no fim como "sending" com o clientId gerado (AC1)', () => {
    const next = reduce(start(), optimistic());

    expect(selectItems(next)).toEqual([
      { kind: 'confirmed', message: msg(1) },
      { kind: 'confirmed', message: msg(2) },
      {
        kind: 'pending',
        clientId: CLIENT_ID,
        content: 'minha',
        createdAt: CREATED_AT,
        status: 'sending',
      },
    ]);
    expect(next.messages).toEqual([msg(1), msg(2)]);
  });

  it('evento SSE com o mesmo clientId substitui a pendente, sem duplicar (AC2)', () => {
    const next = reduce(start(), optimistic(), {
      type: 'message/received',
      message: own(3),
    });

    expect(next.pending).toEqual([]);
    expect(seqs(next)).toEqual([1, 2, 3]);
    expect(selectItems(next)).toHaveLength(3);
    expect(selectItems(next)[2]).toEqual({
      kind: 'confirmed',
      message: own(3),
    });
  });

  it('resposta da action antes do SSE substitui a pendente (AC3)', () => {
    const next = reduce(start(), optimistic(), {
      type: 'message/confirmed',
      message: own(3),
    });

    expect(next.pending).toEqual([]);
    expect(seqs(next)).toEqual([1, 2, 3]);
  });

  it('a confirmada vai para a posição do seq, não fica no fim', () => {
    const state = initChatRoom({ messages: [msg(1), msg(5)], online: 1 });

    const next = reduce(state, optimistic(), {
      type: 'message/confirmed',
      message: own(3),
    });

    expect(seqs(next)).toEqual([1, 3, 5]);
  });

  it('SSE depois da action não duplica (mesmo seq)', () => {
    const next = reduce(
      start(),
      optimistic(),
      { type: 'message/confirmed', message: own(3) },
      { type: 'message/received', message: own(3) },
    );

    expect(seqs(next)).toEqual([1, 2, 3]);
    expect(next.pending).toEqual([]);
  });

  it('SSE antes da action mantém uma só (edge case)', () => {
    const afterSse = reduce(start(), optimistic(), {
      type: 'message/received',
      message: own(3),
    });

    const next = reduce(afterSse, {
      type: 'message/confirmed',
      message: own(3),
    });

    expect(next).toBe(afterSse);
    expect(selectItems(next)).toHaveLength(3);
  });

  it('a confirmação remove só a pendente com o mesmo clientId', () => {
    const other = 'c0000000-0000-4000-8000-000000000002';

    const next = reduce(start(), optimistic(), optimistic(other, 'outra'), {
      type: 'message/received',
      message: own(3),
    });

    expect(next.pending.map((item) => item.clientId)).toEqual([other]);
  });

  it('seq repetido com pendente do mesmo clientId remove a pendente', () => {
    const state = reduce(
      initChatRoom({ messages: [own(3)], online: 1 }),
      optimistic(),
    );

    const next = reduce(state, { type: 'message/received', message: own(3) });

    expect(next.pending).toEqual([]);
    expect(seqs(next)).toEqual([3]);
  });

  it('message/failed marca "failed" e message/retry volta para "sending" (AC4-5)', () => {
    const other = 'c0000000-0000-4000-8000-000000000002';
    const state = reduce(start(), optimistic(), optimistic(other, 'outra'));

    const failed = reduce(state, {
      type: 'message/failed',
      clientId: CLIENT_ID,
    });
    expect(failed.pending.map((item) => item.status)).toEqual([
      'failed',
      'sending',
    ]);

    const retried = reduce(failed, {
      type: 'message/retry',
      clientId: CLIENT_ID,
    });
    expect(retried.pending.map((item) => item.status)).toEqual([
      'sending',
      'sending',
    ]);
    expect(retried.pending[0]).toEqual({
      clientId: CLIENT_ID,
      content: 'minha',
      createdAt: CREATED_AT,
      status: 'sending',
    });
  });

  it('selectItems põe as pendentes depois das confirmadas', () => {
    const next = reduce(start(), optimistic(), {
      type: 'message/received',
      message: msg(9),
    });

    expect(
      selectItems(next).map((item) =>
        item.kind === 'confirmed' ? item.message.seq : item.clientId,
      ),
    ).toEqual([1, 2, 9, CLIENT_ID]);
  });
});

describe('connection/changed (RECON-02)', () => {
  it('alterna entre "reconnecting" e "open" sem mexer nas mensagens', () => {
    const state = initChatRoom({ messages: [msg(1)], online: 2 });

    const reconnecting = chatRoomReducer(state, {
      type: 'connection/changed',
      status: 'reconnecting',
    });
    expect(reconnecting.connection).toBe('reconnecting');
    expect(reconnecting.messages).toBe(state.messages);

    const open = chatRoomReducer(reconnecting, {
      type: 'connection/changed',
      status: 'open',
    });
    expect(open.connection).toBe('open');
  });
});

describe('digitando (TYPE-02)', () => {
  const T = 1_000_000;
  const bia = makeParticipant({
    id: 'a1b2c3d4-0000-4000-8000-000000000004',
    name: 'Bia',
  });

  const start = () =>
    initChatRoom({ messages: [msg(1)], online: 3, meId: me.id });

  function typing(participant = ana, now = T): ChatRoomAction {
    return { type: 'typing/started', participant, now };
  }

  function reduce(state: ChatRoomState, ...actions: ChatRoomAction[]) {
    return actions.reduce(chatRoomReducer, state);
  }

  it('typing/started do próprio participante é ignorado (AC7)', () => {
    const state = start();

    const next = chatRoomReducer(state, typing(me));

    expect(next).toBe(state);
    expect(selectTypingNames(next)).toEqual([]);
  });

  it('typing/started de outro grava o nome com expiresAt = now + 5_000 (AC8)', () => {
    const next = reduce(start(), typing(ana, T));

    expect(next.typing).toEqual({
      [ana.id]: { name: 'Ana', expiresAt: T + 5_000 },
    });
  });

  it('novo evento da mesma pessoa reinicia a contagem (AC8)', () => {
    const next = reduce(start(), typing(ana, T), typing(ana, T + 4_000));

    expect(next.typing).toEqual({
      [ana.id]: { name: 'Ana', expiresAt: T + 9_000 },
    });
  });

  it('typing/expired remove só os vencidos (expiresAt ≤ now)', () => {
    const state = reduce(start(), typing(ana, T), typing(carlos, T + 1_000));

    const next = chatRoomReducer(state, {
      type: 'typing/expired',
      now: T + 5_000,
    });

    expect(next.typing).toEqual({
      [carlos.id]: { name: 'Carlos', expiresAt: T + 6_000 },
    });
  });

  it('typing/expired sem vencidos devolve o mesmo estado', () => {
    const state = reduce(start(), typing(ana, T));

    const next = chatRoomReducer(state, {
      type: 'typing/expired',
      now: T + 4_999,
    });

    expect(next).toBe(state);
  });

  it('mensagem USER do autor o remove na hora (AC9)', () => {
    const state = reduce(start(), typing(ana), typing(carlos));

    const next = chatRoomReducer(state, {
      type: 'message/received',
      message: makeMessage({ id: 'm-2', seq: 2, author: ana }),
    });

    expect(selectTypingNames(next)).toEqual(['Carlos']);
    expect(seqs(next)).toEqual([1, 2]);
  });

  it.each(['JOINED', 'LEFT'] as const)(
    'mensagem %s do autor não o remove',
    (type) => {
      const state = reduce(start(), typing(ana));

      const next = chatRoomReducer(state, {
        type: 'message/received',
        message: makeMessage({
          id: 'm-2',
          seq: 2,
          type,
          content: '',
          author: ana,
        }),
      });

      expect(selectTypingNames(next)).toEqual(['Ana']);
    },
  );

  it('selectTypingNames devolve os nomes na ordem de chegada', () => {
    const next = reduce(
      start(),
      typing(carlos, T),
      typing(ana, T + 100),
      typing(bia, T + 200),
      typing(carlos, T + 300),
    );

    expect(selectTypingNames(next)).toEqual(['Carlos', 'Ana', 'Bia']);
  });
});

describe('mensagens anteriores (HIST-01)', () => {
  /** Messages with seq from `first` to `last`, ascending. */
  function range(first: number, last: number) {
    return Array.from({ length: last - first + 1 }, (_, i) => msg(first + i));
  }

  function reduce(state: ChatRoomState, ...actions: ChatRoomAction[]) {
    return actions.reduce(chatRoomReducer, state);
  }

  it('50 mensagens iniciais → hasMore = true (AC1)', () => {
    expect(
      initChatRoom({ messages: range(51, 100), online: 1 }).history,
    ).toEqual({
      hasMore: true,
      status: 'idle',
    });
  });

  it('49 mensagens iniciais → hasMore = false', () => {
    expect(
      initChatRoom({ messages: range(52, 100), online: 1 }).history.hasMore,
    ).toBe(false);
  });

  it('history/requested → status "loading"; history/failed → "error" e mantém hasMore (AC4, AC6)', () => {
    const state = initChatRoom({ messages: range(51, 100), online: 1 });

    const loading = chatRoomReducer(state, { type: 'history/requested' });
    expect(loading.history).toEqual({ hasMore: true, status: 'loading' });

    const failed = chatRoomReducer(loading, { type: 'history/failed' });
    expect(failed.history).toEqual({ hasMore: true, status: 'error' });
    expect(failed.messages).toBe(state.messages);
  });

  it('history/loaded com 50 insere no topo em ordem de seq e mantém o botão', () => {
    const state = initChatRoom({ messages: range(51, 100), online: 1 });

    const next = reduce(
      state,
      { type: 'history/requested' },
      { type: 'history/loaded', items: range(1, 50) },
    );

    expect(seqs(next)).toEqual(range(1, 100).map((message) => message.seq));
    expect(next.history).toEqual({ hasMore: true, status: 'idle' });
  });

  it.each([0, 20])(
    'history/loaded com %i itens esconde o botão (AC5)',
    (count) => {
      const state = initChatRoom({ messages: range(51, 100), online: 1 });

      const next = reduce(
        state,
        { type: 'history/requested' },
        { type: 'history/loaded', items: range(51 - count, 50) },
      );

      expect(seqs(next)).toEqual(
        range(51 - count, 100).map((message) => message.seq),
      );
      expect(next.history).toEqual({ hasMore: false, status: 'idle' });
    },
  );

  it('sala com exatamente 50 mensagens: botão aparece e o clique traz 0 e esconde (edge case)', () => {
    const state = initChatRoom({ messages: range(1, 50), online: 1 });
    expect(state.history.hasMore).toBe(true);

    const next = reduce(
      state,
      { type: 'history/requested' },
      { type: 'history/loaded', items: [] },
    );

    expect(seqs(next)).toEqual(range(1, 50).map((message) => message.seq));
    expect(next.history.hasMore).toBe(false);
  });

  it('itens já presentes não duplicam (AC7)', () => {
    const state = initChatRoom({ messages: range(51, 100), online: 1 });

    const next = reduce(state, {
      type: 'history/loaded',
      items: range(48, 52),
    });

    expect(seqs(next)).toEqual(range(48, 100).map((message) => message.seq));
  });

  it('mensagens ao vivo durante o loading ficam em ordem de seq, sem duplicar (edge case)', () => {
    const state = initChatRoom({ messages: range(51, 100), online: 1 });

    const next = reduce(
      state,
      { type: 'history/requested' },
      { type: 'message/received', message: msg(101) },
      { type: 'message/received', message: msg(102) },
      { type: 'history/loaded', items: range(1, 50) },
      { type: 'message/received', message: msg(101) },
    );

    expect(seqs(next)).toEqual(range(1, 102).map((message) => message.seq));
  });
});
