import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { Mocked } from 'vitest';
import { makeParticipant } from '../../test-fixtures.js';
import { ParticipantsService } from '../../services/participants.service.js';
import { ParticipantTokenGuard } from '../participant-token.guard.js';

const ANA = makeParticipant();

function contextFor(headers: Record<string, string | undefined>) {
  const request: { headers: typeof headers; participant?: unknown } = {
    headers,
  };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}

describe('ParticipantTokenGuard', () => {
  let guard: ParticipantTokenGuard;
  let participants: Mocked<Pick<ParticipantsService, 'authenticate'>>;

  beforeEach(() => {
    participants = { authenticate: vi.fn() };
    guard = new ParticipantTokenGuard(
      participants as unknown as ParticipantsService,
    );
  });

  it('header ausente → 401 sem consultar o service', async () => {
    const { context, request } = contextFor({});

    const result = guard.canActivate(context);

    await expect(result).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(result).rejects.toMatchObject({ status: 401 });
    expect(participants.authenticate).not.toHaveBeenCalled();
    expect(request.participant).toBeUndefined();
  });

  it('header vazio → 401 sem consultar o service', async () => {
    const { context, request } = contextFor({ 'x-participant-token': '' });

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      status: 401,
    });
    expect(participants.authenticate).not.toHaveBeenCalled();
    expect(request.participant).toBeUndefined();
  });

  it('token desconhecido ou de quem saiu (authenticate → null) → 401', async () => {
    participants.authenticate.mockResolvedValue(null);
    const { context, request } = contextFor({
      'x-participant-token': 'token-de-quem-saiu',
    });

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      status: 401,
    });
    expect(participants.authenticate).toHaveBeenCalledWith(
      'token-de-quem-saiu',
    );
    expect(request.participant).toBeUndefined();
  });

  it('repassa o valor do header sem interpretar esquema ("Bearer …" não vira token)', async () => {
    participants.authenticate.mockResolvedValue(null);
    const { context } = contextFor({
      'x-participant-token': 'Bearer token-da-ana',
    });

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      status: 401,
    });
    expect(participants.authenticate).toHaveBeenCalledWith(
      'Bearer token-da-ana',
    );
  });

  it('ignora o header Authorization: só o X-Participant-Token autentica', async () => {
    const { context } = contextFor({ authorization: 'token-da-ana' });

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      status: 401,
    });
    expect(participants.authenticate).not.toHaveBeenCalled();
  });

  it('token válido → libera e grava o participante em request.participant', async () => {
    participants.authenticate.mockResolvedValue(ANA);
    const { context, request } = contextFor({
      'x-participant-token': 'token-da-ana',
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(participants.authenticate).toHaveBeenCalledWith('token-da-ana');
    expect(request.participant).toBe(ANA);
  });
});
