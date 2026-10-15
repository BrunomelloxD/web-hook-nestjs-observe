import { ApiProperty } from '@nestjs/swagger';
import { MessageResponseDto } from './message-response.dto.js';

export class MessagesResponseDto {
  @ApiProperty({
    type: [MessageResponseDto],
    description: 'Sempre em ordem crescente de seq',
  })
  items: MessageResponseDto[];
}
