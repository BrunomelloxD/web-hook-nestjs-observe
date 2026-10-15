import { ApiProperty } from '@nestjs/swagger';

export class OnlineParticipantDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Ana' })
  name: string;
}

export class OnlineParticipantsResponseDto {
  @ApiProperty({
    type: [OnlineParticipantDto],
    description: 'Ordenados por entrada',
  })
  items: OnlineParticipantDto[];

  @ApiProperty({ example: 2 })
  total: number;
}
