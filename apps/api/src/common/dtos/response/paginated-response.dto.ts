import { ApiProperty } from '@nestjs/swagger';
import type { PaginationDto } from '../request/pagination.dto.js';

export class PaginationMetaDto {
  @ApiProperty({ example: 100 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;

  @ApiProperty({
    example: 10,
    description: 'Sempre >= 1, mesmo sem resultados',
  })
  last_page: number;
}

export class PaginatedResponseDto<T> {
  data: T[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;

  static create<T>(
    data: T[],
    total: number,
    { page, limit }: Pick<PaginationDto, 'page' | 'limit'>,
  ): PaginatedResponseDto<T> {
    return {
      data,
      meta: {
        total,
        page,
        limit,
        last_page: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }
}
