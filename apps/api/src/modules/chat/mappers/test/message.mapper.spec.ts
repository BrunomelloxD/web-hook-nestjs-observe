import { makeMessage } from '../../test-fixtures.js';
import { MessageMapper } from '../message.mapper.js';

describe('MessageMapper.toResponse', () => {
  it('converte o model no MessageResponseDto, com seq number, createdAt ISO e o autor', () => {
    const message = makeMessage({
      id: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
      seq: BigInt(1040),
      type: 'JOINED',
      content: '',
      clientId: null,
      participantId: '7d9f1e2a-4b3c-4d5e-9f60-1a2b3c4d5e6f',
      participant: { id: '7d9f1e2a-4b3c-4d5e-9f60-1a2b3c4d5e6f', name: 'Bia' },
      createdAt: new Date('2026-10-14T12:00:00.000Z'),
    });

    const dto = MessageMapper.toResponse(message);

    expect(dto).toEqual({
      id: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
      seq: 1040,
      type: 'JOINED',
      content: '',
      clientId: null,
      author: { id: '7d9f1e2a-4b3c-4d5e-9f60-1a2b3c4d5e6f', name: 'Bia' },
      createdAt: '2026-10-14T12:00:00.000Z',
    });
    expect(typeof dto.seq).toBe('number');
  });

  it('mantém clientId e seq acima de 2^31', () => {
    const dto = MessageMapper.toResponse(
      makeMessage({
        seq: 3_000_000_000n,
        clientId: '0b8f7c6d-5e4a-4b3c-9d2e-1f0a9b8c7d6e',
      }),
    );

    expect(dto.seq).toBe(3_000_000_000);
    expect(dto.clientId).toBe('0b8f7c6d-5e4a-4b3c-9d2e-1f0a9b8c7d6e');
  });
});
