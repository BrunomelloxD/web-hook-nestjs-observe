import { makeParticipant } from '../../test-fixtures.js';
import { ParticipantMapper } from '../participant.mapper.js';

const bia = makeParticipant({
  id: '7d9f1e2a-4b3c-4d5e-9f60-1a2b3c4d5e6f',
  name: 'Bia',
  nameKey: 'bia',
  tokenHash: 'f'.repeat(64),
  joinedAt: new Date('2026-10-14T12:00:00.000Z'),
});

describe('ParticipantMapper', () => {
  it('toJoined devolve id, name, o token puro e joinedAt ISO (sem o hash)', () => {
    expect(ParticipantMapper.toJoined(bia, 'raw-token_43chars')).toEqual({
      id: '7d9f1e2a-4b3c-4d5e-9f60-1a2b3c4d5e6f',
      name: 'Bia',
      token: 'raw-token_43chars',
      joinedAt: '2026-10-14T12:00:00.000Z',
    });
  });

  it('toOnline devolve só id e name', () => {
    expect(ParticipantMapper.toOnline(bia)).toEqual({
      id: '7d9f1e2a-4b3c-4d5e-9f60-1a2b3c4d5e6f',
      name: 'Bia',
    });
  });
});
