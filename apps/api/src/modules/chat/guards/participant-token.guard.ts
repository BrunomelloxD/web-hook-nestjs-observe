import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';
import type { Participant } from '@/generated/prisma/client.js';
import { ParticipantsService } from '../services/participants.service.js';

/** Header name as documented in Swagger; Node lowercases it in `headers`. */
export const PARTICIPANT_TOKEN_HEADER = 'X-Participant-Token';

export type ParticipantRequest = Request & { participant?: Participant };

@Injectable()
export class ParticipantTokenGuard implements CanActivate {
  constructor(private readonly participants: ParticipantsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ParticipantRequest>();
    const token = request.headers[PARTICIPANT_TOKEN_HEADER.toLowerCase()];
    if (typeof token !== 'string' || token === '') {
      throw new UnauthorizedException('Token do participante ausente');
    }
    const participant = await this.participants.authenticate(token);
    if (!participant) {
      throw new UnauthorizedException('Token do participante inválido');
    }
    request.participant = participant;
    return true;
  }
}
