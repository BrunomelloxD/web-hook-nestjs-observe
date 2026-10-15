import { applyDecorators, Type } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';
import { PaginatedResponseDto } from '../dtos/response/paginated-response.dto.js';

/** Documents the real item type, which generics lose at runtime. */
export function ApiPaginatedResponse<T extends Type<unknown>>(
  model: T,
  description = 'Lista paginada',
) {
  return applyDecorators(
    ApiExtraModels(PaginatedResponseDto, model),
    ApiOkResponse({
      description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(PaginatedResponseDto) },
          {
            properties: {
              data: { type: 'array', items: { $ref: getSchemaPath(model) } },
            },
            required: ['data'],
          },
        ],
      },
    }),
  );
}
