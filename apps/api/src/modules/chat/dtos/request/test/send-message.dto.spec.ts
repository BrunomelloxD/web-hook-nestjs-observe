import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SendMessageDto } from '../send-message.dto.js';

const CLIENT_ID = '0b8f7c6d-5e4a-4b3c-9d2e-1f0a9b8c7d6e';

async function parse(body: Record<string, unknown>) {
  const dto = plainToInstance(SendMessageDto, body);
  return { dto, errors: await validate(dto) };
}

describe('SendMessageDto', () => {
  it('aceita conteúdo com 1000 caracteres', async () => {
    const { dto, errors } = await parse({ content: 'a'.repeat(1000) });

    expect(errors).toEqual([]);
    expect(dto.content).toBe('a'.repeat(1000));
  });

  it('faz trim antes de validar: 1000 caracteres com espaços em volta passam e são gravados sem eles', async () => {
    const { dto, errors } = await parse({
      content: `  ${'a'.repeat(1000)}\n `,
    });

    expect(errors).toEqual([]);
    expect(dto.content).toBe('a'.repeat(1000));
  });

  it('mantém quebras de linha internas', async () => {
    const { dto, errors } = await parse({ content: ' olá\ntudo bem? ' });

    expect(errors).toEqual([]);
    expect(dto.content).toBe('olá\ntudo bem?');
  });

  it.each([
    ['1001 caracteres', 'a'.repeat(1001), 'maxLength'],
    ['só espaço', ' ', 'isNotEmpty'],
    ['só espaços e quebras de linha', ' \n\t ', 'isNotEmpty'],
    ['vazio', '', 'isNotEmpty'],
  ])('rejeita conteúdo com %s', async (_case, content, constraint) => {
    const { errors } = await parse({ content });

    expect(errors.map((e) => e.property)).toEqual(['content']);
    expect(Object.keys(errors[0].constraints ?? {})).toContain(constraint);
  });

  it.each([
    ['ausente', {}],
    ['não é string', { content: 42 }],
  ])('rejeita conteúdo %s', async (_case, body) => {
    const { errors } = await parse(body);

    expect(errors.map((e) => e.property)).toEqual(['content']);
  });

  it('aceita clientId uuid', async () => {
    const { dto, errors } = await parse({
      content: 'olá',
      clientId: CLIENT_ID,
    });

    expect(errors).toEqual([]);
    expect(dto.clientId).toBe(CLIENT_ID);
  });

  it('aceita sem clientId', async () => {
    const { dto, errors } = await parse({ content: 'olá' });

    expect(errors).toEqual([]);
    expect(dto.clientId).toBeUndefined();
  });

  it.each([
    ['texto', 'abc'],
    ['uuid com caractere inválido', '0b8f7c6d-5e4a-4b3c-9d2e-1f0a9b8c7d6g'],
    ['uuid sem hífens', '0b8f7c6d5e4a4b3c9d2e1f0a9b8c7d6e'],
    ['uuid curto', '0b8f7c6d-5e4a-4b3c-9d2e-1f0a9b8c7d6'],
  ])('rejeita clientId %s', async (_case, clientId) => {
    const { errors } = await parse({ content: 'olá', clientId });

    expect(errors.map((e) => e.property)).toEqual(['clientId']);
  });
});
