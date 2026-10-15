// SPEC_DEVIATION: T7 plans no unit test (covered later by the e2e and openapi.spec of T15/T16).
// Reason: until the phase 3 controllers exist nothing loads these classes, and the phase 2 build gate needs 100%.
import { Controller, Get } from '@nestjs/common';
import {
  ApiOkResponse,
  DocumentBuilder,
  SwaggerModule,
  type OpenAPIObject,
} from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import { MessagesResponseDto } from '../messages-response.dto.js';
import { OnlineParticipantsResponseDto } from '../online-participants-response.dto.js';
import { ParticipantJoinedResponseDto } from '../participant-joined-response.dto.js';

@Controller('dtos')
class DtosController {
  @Get('joined')
  @ApiOkResponse({ type: ParticipantJoinedResponseDto })
  joined() {
    return null;
  }

  @Get('online')
  @ApiOkResponse({ type: OnlineParticipantsResponseDto })
  online() {
    return null;
  }

  @Get('messages')
  @ApiOkResponse({ type: MessagesResponseDto })
  messages() {
    return null;
  }
}

describe('DTOs de response do chat (schemas do OpenAPI)', () => {
  let schemas: NonNullable<OpenAPIObject['components']>['schemas'];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [DtosController],
    }).compile();
    const app = moduleRef.createNestApplication({ logger: false });
    await app.init();
    schemas = SwaggerModule.createDocument(app, new DocumentBuilder().build())
      .components?.schemas;
    await app.close();
  });

  it('ParticipantJoinedResponseDto tem id, name, token e joinedAt obrigatórios', () => {
    expect(schemas?.ParticipantJoinedResponseDto).toMatchObject({
      required: ['id', 'name', 'token', 'joinedAt'],
      properties: {
        id: { type: 'string', format: 'uuid' },
        name: { type: 'string' },
        token: { type: 'string' },
        joinedAt: { type: 'string', format: 'date-time' },
      },
    });
  });

  it('OnlineParticipantsResponseDto tem items de { id, name } e total', () => {
    expect(schemas?.OnlineParticipantsResponseDto).toMatchObject({
      required: ['items', 'total'],
      properties: {
        items: {
          type: 'array',
          items: { $ref: '#/components/schemas/OnlineParticipantDto' },
        },
        total: { type: 'number' },
      },
    });
    expect(schemas?.OnlineParticipantDto).toMatchObject({
      required: ['id', 'name'],
      properties: {
        id: { type: 'string', format: 'uuid' },
        name: { type: 'string' },
      },
    });
  });

  it('MessageResponseDto documenta seq como number, type como enum e clientId nullable', () => {
    expect(schemas?.MessageResponseDto).toMatchObject({
      required: [
        'id',
        'seq',
        'type',
        'content',
        'clientId',
        'author',
        'createdAt',
      ],
      properties: {
        id: { type: 'string', format: 'uuid' },
        seq: { type: 'number' },
        type: { allOf: [{ $ref: '#/components/schemas/MessageType' }] },
        content: { type: 'string' },
        clientId: { type: 'string', format: 'uuid', nullable: true },
        author: { $ref: '#/components/schemas/MessageAuthorDto' },
        createdAt: { type: 'string', format: 'date-time' },
      },
    });
    expect(schemas?.MessageType).toEqual({
      type: 'string',
      enum: ['USER', 'JOINED', 'LEFT'],
    });
    expect(schemas?.MessageAuthorDto).toMatchObject({
      required: ['id', 'name'],
      properties: {
        id: { type: 'string', format: 'uuid' },
        name: { type: 'string' },
      },
    });
  });

  it('MessagesResponseDto tem items de MessageResponseDto', () => {
    expect(schemas?.MessagesResponseDto).toMatchObject({
      required: ['items'],
      properties: {
        items: {
          type: 'array',
          items: { $ref: '#/components/schemas/MessageResponseDto' },
        },
      },
    });
  });
});
