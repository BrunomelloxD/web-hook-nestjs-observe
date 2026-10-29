import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Participant } from '@/generated/prisma/client.js';
import { CurrentParticipant } from '../decorators/current-participant.decorator.js';
import { RateLimitedExceptionFilter } from '../filters/rate-limited-exception.filter.js';
import { ListMessagesQuery } from '../dtos/request/list-messages.query.js';
import { SendMessageDto } from '../dtos/request/send-message.dto.js';
import { MessageResponseDto } from '../dtos/response/message-response.dto.js';
import { MessagesResponseDto } from '../dtos/response/messages-response.dto.js';
import {
  PARTICIPANT_TOKEN_HEADER,
  ParticipantTokenGuard,
} from '../guards/participant-token.guard.js';
import { MessagesService } from '../services/messages.service.js';

// All chat traffic comes from the web server's IP (AD-004).
@ApiTags('Chat')
@SkipThrottle()
@Controller('chat/messages')
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar mensagens por seq, com cursor' })
  @ApiOkResponse({ type: MessagesResponseDto })
  @ApiBadRequestResponse({
    description:
      'limit fora de 1 a 100, cursor inválido ou before e after juntos',
  })
  list(@Query() query: ListMessagesQuery): Promise<MessagesResponseDto> {
    return this.messages.list(query);
  }

  @Post()
  @UseGuards(ParticipantTokenGuard)
  @UseFilters(RateLimitedExceptionFilter)
  @ApiOperation({ summary: 'Enviar uma mensagem' })
  @ApiHeader({
    name: PARTICIPANT_TOKEN_HEADER,
    required: true,
    description: 'Token devolvido pelo POST /chat/participants',
  })
  @ApiCreatedResponse({ type: MessageResponseDto })
  @ApiBadRequestResponse({
    description:
      'Conteúdo vazio, acima de 1000 caracteres ou clientId inválido',
  })
  @ApiUnauthorizedResponse({
    description: 'Token ausente, desconhecido ou de quem saiu',
  })
  @ApiTooManyRequestsResponse({
    description:
      'O participante já enviou 5 mensagens nos últimos 10 s. Um reenvio com clientId já gravado não conta',
    headers: {
      'Retry-After': {
        description: 'Segundos inteiros até poder enviar de novo',
        schema: { type: 'integer' },
      },
    },
  })
  send(
    @CurrentParticipant() actor: Participant,
    @Body() dto: SendMessageDto,
  ): Promise<MessageResponseDto> {
    return this.messages.send(actor, dto);
  }
}
