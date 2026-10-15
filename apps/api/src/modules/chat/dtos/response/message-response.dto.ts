import { ApiProperty } from '@nestjs/swagger';
import { MessageType } from '@/generated/prisma/client.js';

export class MessageAuthorDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Ana' })
  name: string;
}

export class MessageResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  // BigInt in the database; serialized as a JSON number (ROOM-02 AC12).
  @ApiProperty({
    type: Number,
    example: 1040,
    description: 'Ordem da mensagem e cursor',
  })
  seq: number;

  @ApiProperty({ enum: MessageType, enumName: 'MessageType' })
  type: MessageType;

  @ApiProperty({ description: 'Vazio em JOINED e LEFT' })
  content: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  clientId: string | null;

  @ApiProperty({ type: MessageAuthorDto })
  author: MessageAuthorDto;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;
}
