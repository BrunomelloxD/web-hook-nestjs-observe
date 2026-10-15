import { Controller, Get } from '@nestjs/common';
import { ApiProperty, DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import { ApiPaginatedResponse } from '../api-paginated-response.decorator.js';

class ItemDto {
  @ApiProperty()
  id: string;
}

@Controller('items')
class ItemsController {
  @Get()
  @ApiPaginatedResponse(ItemDto)
  list() {
    return [];
  }

  @Get('custom')
  @ApiPaginatedResponse(ItemDto, 'Itens filtrados')
  custom() {
    return [];
  }
}

async function documentFor() {
  const moduleRef = await Test.createTestingModule({
    controllers: [ItemsController],
  }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  await app.init();
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder().build(),
  );
  await app.close();
  return document;
}

describe('ApiPaginatedResponse', () => {
  it('documenta o envelope paginado com o tipo real dos itens', async () => {
    const document = await documentFor();
    const ok = document.paths['/items']?.get?.responses['200'];

    expect(ok).toMatchObject({
      description: 'Lista paginada',
      content: {
        'application/json': {
          schema: {
            allOf: [
              { $ref: '#/components/schemas/PaginatedResponseDto' },
              {
                properties: {
                  data: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/ItemDto' },
                  },
                },
                required: ['data'],
              },
            ],
          },
        },
      },
    });
    expect(document.components?.schemas).toHaveProperty('PaginatedResponseDto');
    expect(document.components?.schemas).toHaveProperty('ItemDto');
  });

  it('usa a descrição informada', async () => {
    const document = await documentFor();

    expect(
      document.paths['/items/custom']?.get?.responses['200'],
    ).toMatchObject({ description: 'Itens filtrados' });
  });
});
