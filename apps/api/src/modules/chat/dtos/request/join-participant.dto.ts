import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength } from 'class-validator';
import { trimString } from './trim-string.js';

// Letters (any script), combining marks, digits, space, ".", "_" and "-".
const NAME_PATTERN = /^[\p{L}\p{M}0-9 ._-]{2,20}$/u;

export class JoinParticipantDto {
  @ApiProperty({
    description:
      'Nome exibido na sala; o trim é feito antes da validação. Único entre os participantes online, sem diferenciar maiúsculas.',
    example: 'Ana',
    minLength: 2,
    maxLength: 20,
    pattern: '^[\\p{L}\\p{M}0-9 ._-]{2,20}$',
  })
  @Transform(trimString)
  @IsString()
  @MaxLength(20)
  @Matches(NAME_PATTERN, {
    message:
      'O nome deve ter de 2 a 20 caracteres: letras, números, espaço, ".", "_" ou "-".',
  })
  name: string;
}
