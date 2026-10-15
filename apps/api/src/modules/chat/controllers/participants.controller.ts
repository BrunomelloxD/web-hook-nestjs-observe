import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiHeader,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Participant } from '@/generated/prisma/client.js';
import { CurrentParticipant } from '../decorators/current-participant.decorator.js';
import { JoinParticipantDto } from '../dtos/request/join-participant.dto.js';
import { OnlineParticipantsResponseDto } from '../dtos/response/online-participants-response.dto.js';
import { ParticipantJoinedResponseDto } from '../dtos/response/participant-joined-response.dto.js';
import {
  PARTICIPANT_TOKEN_HEADER,
  ParticipantTokenGuard,
} from '../guards/participant-token.guard.js';
import { ParticipantsService } from '../services/participants.service.js';

// All chat traffic comes from the web server's IP (AD-004).
@ApiTags('Chat')
@SkipThrottle()
@Controller('chat/participants')
export class ParticipantsController {
  constructor(private readonly participants: ParticipantsService) {}

  @Post()
  @ApiOperation({ summary: 'Entrar na sala com um nome' })
  @ApiCreatedResponse({ type: ParticipantJoinedResponseDto })
  @ApiBadRequestResponse({ description: 'Nome inválido' })
  @ApiConflictResponse({
    description: 'Nome em uso por um participante online',
  })
  join(@Body() dto: JoinParticipantDto): Promise<ParticipantJoinedResponseDto> {
    return this.participants.join(dto);
  }

  @Get('online')
  @ApiOperation({ summary: 'Listar os participantes online' })
  @ApiOkResponse({ type: OnlineParticipantsResponseDto })
  listOnline(): Promise<OnlineParticipantsResponseDto> {
    return this.participants.listOnline();
  }

  @Post(':id/leave')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(ParticipantTokenGuard)
  @ApiOperation({ summary: 'Sair da sala' })
  @ApiHeader({
    name: PARTICIPANT_TOKEN_HEADER,
    required: true,
    description: 'Token devolvido pelo POST /chat/participants',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse({ description: 'Saída registrada' })
  @ApiBadRequestResponse({ description: 'Id inválido' })
  @ApiUnauthorizedResponse({
    description:
      'Token ausente, desconhecido, de quem saiu ou de outro participante',
  })
  @ApiNotFoundResponse({ description: 'Participante não encontrado' })
  leave(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentParticipant() actor: Participant,
  ): Promise<void> {
    return this.participants.leave(id, actor);
  }
}
