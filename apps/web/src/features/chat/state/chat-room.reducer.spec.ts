import { makeMessage } from '../test-fixtures';
import {
  chatRoomReducer,
  initChatRoom,
  type ChatRoomState,
} from './chat-room.reducer';

function msg(seq: number) {
  return makeMessage({ id: `m-${seq}`, seq, content: `mensagem ${seq}` });
}

function seqs(state: ChatRoomState) {
  return state.messages.map((message) => message.seq);
}

describe('initChatRoom', () => {
  it('monta o estado com as mensagens e o online iniciais', () => {
    const messages = [msg(1), msg(2)];

    expect(initChatRoom({ messages, online: 3 })).toEqual({
      messages: [msg(1), msg(2)],
      online: 3,
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
