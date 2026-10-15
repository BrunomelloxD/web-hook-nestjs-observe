import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { trimString } from './trim-string.js';

export class SendMessageDto {
  @ApiProperty({
    description: 'Texto da mensagem; gravado depois do trim',
    example: 'olá',
    minLength: 1,
    maxLength: 1000,
  })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  content: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Id gerado pelo cliente para reconhecer o próprio envio',
  })
  @IsOptional()
  @IsUUID()
  clientId?: string;
}
