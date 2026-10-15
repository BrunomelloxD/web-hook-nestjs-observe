import { ApiProperty } from '@nestjs/swagger';

export class ParticipantJoinedResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Ana' })
  name: string;

  @ApiProperty({
    description:
      'Token opaco do participante; só aparece nesta resposta. Envie no header X-Participant-Token.',
  })
  token: string;

  @ApiProperty({ format: 'date-time' })
  joinedAt: string;
}
