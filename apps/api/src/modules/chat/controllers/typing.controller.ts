import { Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import {
  ApiHeader,
  ApiNoContentResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Participant } from '@/generated/prisma/client.js';
import { CurrentParticipant } from '../decorators/current-participant.decorator.js';
import {
  PARTICIPANT_TOKEN_HEADER,
  ParticipantTokenGuard,
} from '../guards/participant-token.guard.js';
import { TypingService } from '../services/typing.service.js';

// All chat traffic comes from the web server's IP (AD-004).
@ApiTags('Chat')
@SkipThrottle()
@Controller('chat/typing')
export class TypingController {
  constructor(private readonly typing: TypingService) {}

  @Post()
  @HttpCode(204)
  @UseGuards(ParticipantTokenGuard)
  @ApiOperation({ summary: 'Avisar que o participante está digitando' })
  @ApiHeader({
    name: PARTICIPANT_TOKEN_HEADER,
    required: true,
    description: 'Token devolvido pelo POST /chat/participants',
  })
  @ApiNoContentResponse({
    description:
      'Aviso aceito. A menos de 2 s do último aceito do mesmo participante, não dispara webhook',
  })
  @ApiUnauthorizedResponse({
    description: 'Token ausente, desconhecido ou de quem saiu',
  })
  notify(@CurrentParticipant() actor: Participant): void {
    this.typing.notify(actor);
  }
}
