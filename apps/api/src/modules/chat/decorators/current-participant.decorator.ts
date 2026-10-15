import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Participant } from '@/generated/prisma/client.js';
import type { ParticipantRequest } from '../guards/participant-token.guard.js';

/** Exported so the logic is tested without Nest's decorator plumbing. */
export function getCurrentParticipant(
  _data: unknown,
  context: ExecutionContext,
): Participant | undefined {
  return context.switchToHttp().getRequest<ParticipantRequest>().participant;
}

/** The participant set by ParticipantTokenGuard; use only behind it. */
export const CurrentParticipant = createParamDecorator(getCurrentParticipant);
