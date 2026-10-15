import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { JoinParticipantDto } from '../join-participant.dto.js';

async function parse(body: Record<string, unknown>) {
  const dto = plainToInstance(JoinParticipantDto, body);
  return { dto, errors: await validate(dto) };
}

describe('JoinParticipantDto', () => {
  it.each([
    ['2 caracteres', 'Al'],
    ['20 caracteres', 'a'.repeat(20)],
    ['acento (NFC)', 'Érica'],
    ['acento como marca combinante (NFD)', 'Érica'],
    ['dígito e "_"', 'João_1'],
    ['"." e "-"', 'a.b-c'],
    ['espaço interno', 'Ana Maria'],
  ])('aceita nome com %s', async (_case, name) => {
    const { dto, errors } = await parse({ name });

    expect(errors).toEqual([]);
    expect(dto.name).toBe(name);
  });

  it('faz trim antes de validar: " Ana " vira "Ana"', async () => {
    const { dto, errors } = await parse({ name: ' Ana ' });

    expect(errors).toEqual([]);
    expect(dto.name).toBe('Ana');
  });

  it('conta o tamanho depois do trim: 20 caracteres com espaços em volta passam', async () => {
    const { dto, errors } = await parse({ name: `  ${'a'.repeat(20)}  ` });

    expect(errors).toEqual([]);
    expect(dto.name).toBe('a'.repeat(20));
  });

  it.each([
    ['1 caractere', 'A'],
    ['1 caractere depois do trim', ' A '],
    ['21 caracteres', 'a'.repeat(21)],
    ['"!"', 'Ana!'],
    ['"@"', 'ana@x'],
    ['emoji', 'Ana😀'],
    ['tab (só espaço é permitido)', 'Ana\tBia'],
    ['quebra de linha', 'Ana\nBia'],
    ['vazio', ''],
  ])(
    'rejeita nome com %s, com a mensagem em português',
    async (_case, name) => {
      const { errors } = await parse({ name });

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('name');
      expect(errors[0].constraints?.matches).toBe(
        'O nome deve ter de 2 a 20 caracteres: letras, números, espaço, ".", "_" ou "-".',
      );
    },
  );

  it.each([
    ['ausente', {}],
    ['não é string', { name: 123 }],
  ])('rejeita nome %s', async (_case, body) => {
    const { errors } = await parse(body);

    expect(errors.map((e) => e.property)).toEqual(['name']);
  });
});
