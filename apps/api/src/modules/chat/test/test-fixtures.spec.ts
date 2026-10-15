// SPEC_DEVIATION: the plan (T4) says the fixtures are exercised by the phase 2/3 specs.
// Reason: the phase 1 build gate needs 100% coverage before those specs exist.
import { makeMessage, makeParticipant } from '../test-fixtures.js';

describe('test-fixtures', () => {
  it('makeParticipant devolve um participante online com os campos do model', () => {
    expect(makeParticipant()).toEqual({
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Ana',
      nameKey: 'ana',
      tokenHash: 'a'.repeat(64),
      joinedAt: new Date('2026-01-01T00:00:00.000Z'),
      leftAt: null,
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
  });

  it('makeParticipant aplica os overrides', () => {
    const leftAt = new Date('2026-01-02T00:00:00.000Z');

    expect(makeParticipant({ name: 'Bia', leftAt })).toMatchObject({
      name: 'Bia',
      leftAt,
    });
  });

  it('makeMessage devolve uma mensagem USER com o autor (MessageWithAuthor)', () => {
    expect(makeMessage()).toEqual({
      id: '6f1c2b9e-3d4a-4c5b-8e7f-0a1b2c3d4e5f',
      seq: 1n,
      type: 'USER',
      content: 'olá',
      clientId: null,
      participantId: '550e8400-e29b-41d4-a716-446655440000',
      participant: { id: '550e8400-e29b-41d4-a716-446655440000', name: 'Ana' },
      createdAt: new Date('2026-01-01T00:00:01.000Z'),
    });
  });

  it('makeMessage aplica os overrides', () => {
    expect(
      makeMessage({ seq: 1040n, type: 'JOINED', content: '' }),
    ).toMatchObject({ seq: 1040n, type: 'JOINED', content: '' });
  });
});
