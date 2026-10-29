import { makeMessage } from '../test-fixtures';
import { webhookEnvelopeSchema } from './webhook-envelope.schema';

const OCCURRED_AT = '2026-10-15T12:00:00.000Z';
const message = makeMessage({ seq: 7 });

const messageCreated = {
  type: 'message.created',
  occurredAt: OCCURRED_AT,
  data: message,
};
const presenceChanged = {
  type: 'presence.changed',
  occurredAt: OCCURRED_AT,
  data: { online: 3 },
};
const ANA_ID = '550e8400-e29b-41d4-a716-446655440000';
const typingStarted = {
  type: 'typing.started',
  occurredAt: OCCURRED_AT,
  data: { participant: { id: ANA_ID, name: 'Ana' } },
};

function withData(data: Record<string, unknown>) {
  return { ...messageCreated, data: { ...message, ...data } };
}

function withoutDataField(field: keyof typeof message) {
  const data: Record<string, unknown> = { ...message };
  delete data[field];
  return { ...messageCreated, data };
}

describe('webhookEnvelopeSchema', () => {
  it('aceita message.created com o MessageResponseDto', () => {
    expect(webhookEnvelopeSchema.parse(messageCreated)).toEqual({
      type: 'message.created',
      occurredAt: OCCURRED_AT,
      data: message,
    });
  });

  it('aceita message.created com clientId preenchido', () => {
    const clientId = '0b3c1a52-6f0e-4d7e-9a49-1d0f8d6c2f11';

    expect(
      webhookEnvelopeSchema.parse(withData({ clientId })).data,
    ).toMatchObject({ clientId });
  });

  it('aceita presence.changed com online 0', () => {
    expect(
      webhookEnvelopeSchema.parse({ ...presenceChanged, data: { online: 0 } }),
    ).toEqual({
      type: 'presence.changed',
      occurredAt: OCCURRED_AT,
      data: { online: 0 },
    });
  });

  it('aceita presence.changed com online positivo', () => {
    expect(webhookEnvelopeSchema.parse(presenceChanged).data).toEqual({
      online: 3,
    });
  });

  it('aceita typing.started com { participant: { id, name } }', () => {
    expect(webhookEnvelopeSchema.parse(typingStarted)).toEqual({
      type: 'typing.started',
      occurredAt: OCCURRED_AT,
      data: { participant: { id: ANA_ID, name: 'Ana' } },
    });
  });

  describe('recusa', () => {
    it.each([
      // typing.started became a known type in F4; a stop event is not one.
      ['tipo desconhecido', { ...presenceChanged, type: 'typing.stopped' }],
      ['sem type', { occurredAt: OCCURRED_AT, data: { online: 3 } }],
      ['occurredAt ausente', { type: 'presence.changed', data: { online: 3 } }],
      [
        'occurredAt que não é data ISO',
        { ...presenceChanged, occurredAt: 'ontem' },
      ],
      ['data ausente', { type: 'presence.changed', occurredAt: OCCURRED_AT }],
      ['online negativo', { ...presenceChanged, data: { online: -1 } }],
      ['online fracionário', { ...presenceChanged, data: { online: 1.5 } }],
      ['online como texto', { ...presenceChanged, data: { online: '3' } }],
      [
        'data de presença em message.created',
        { ...messageCreated, data: { online: 3 } },
      ],
      ['data sem seq', withoutDataField('seq')],
      ['data sem id', withoutDataField('id')],
      ['data sem type', withoutDataField('type')],
      ['data sem content', withoutDataField('content')],
      ['data sem clientId', withoutDataField('clientId')],
      ['data sem author', withoutDataField('author')],
      ['data sem createdAt', withoutDataField('createdAt')],
      ['seq como texto', withData({ seq: '7' })],
      ['seq fracionário', withData({ seq: 7.5 })],
      ['type de mensagem desconhecido', withData({ type: 'TYPING' })],
      ['content que não é texto', withData({ content: 1 })],
      ['clientId numérico', withData({ clientId: 1 })],
      ['author sem name', withData({ author: { id: message.author.id } })],
      ['createdAt que não é data ISO', withData({ createdAt: 'agora' })],
      [
        'typing.started com participant.id que não é uuid',
        {
          ...typingStarted,
          data: { participant: { id: 'ana', name: 'Ana' } },
        },
      ],
      [
        'typing.started sem participant.name',
        { ...typingStarted, data: { participant: { id: ANA_ID } } },
      ],
      ['typing.started sem participant', { ...typingStarted, data: {} }],
      ['corpo que não é objeto', 'message.created'],
    ])('%s', (_, body) => {
      expect(webhookEnvelopeSchema.safeParse(body).success).toBe(false);
    });
  });
});
