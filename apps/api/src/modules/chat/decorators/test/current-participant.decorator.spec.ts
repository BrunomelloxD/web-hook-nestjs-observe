import type { ExecutionContext } from '@nestjs/common';
import { makeParticipant } from '../../test-fixtures.js';
import { getCurrentParticipant } from '../current-participant.decorator.js';

function contextWith(request: object) {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('@CurrentParticipant()', () => {
  it('devolve o participante que o guard gravou no request', () => {
    const bia = makeParticipant({
      id: '7d9f1e2a-4b3c-4d5e-9f60-1a2b3c4d5e6f',
      name: 'Bia',
      nameKey: 'bia',
    });

    expect(
      getCurrentParticipant(undefined, contextWith({ participant: bia })),
    ).toBe(bia);
  });
});
