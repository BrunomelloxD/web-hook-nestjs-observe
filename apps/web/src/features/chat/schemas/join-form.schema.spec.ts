import { joinFormSchema, readJoinForm } from './join-form.schema';

const NAME_ERROR =
  'O nome deve ter de 2 a 20 caracteres: letras, números, espaço, ".", "_" ou "-".';

describe('joinFormSchema', () => {
  it.each([
    ['2 caracteres', 'Al'],
    ['20 caracteres', 'a'.repeat(20)],
    ['acento (NFC)', 'Érica'],
    ['acento como marca combinante (NFD)', 'Érica'],
    ['dígito e "_"', 'João_1'],
    ['"." e "-"', 'a.b-c'],
    ['espaço interno', 'Ana Maria'],
  ])('aceita nome com %s', (_case, name) => {
    expect(joinFormSchema.safeParse({ name })).toEqual({
      success: true,
      data: { name },
    });
  });

  it('faz trim antes de validar: " Ana " vira "Ana"', () => {
    expect(joinFormSchema.parse({ name: ' Ana ' })).toEqual({ name: 'Ana' });
  });

  it('conta o tamanho depois do trim: 20 caracteres com espaços em volta passam', () => {
    expect(joinFormSchema.parse({ name: `  ${'a'.repeat(20)}  ` })).toEqual({
      name: 'a'.repeat(20),
    });
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
    ['só espaços', '    '],
  ])('rejeita nome com %s, com a mensagem em português', (_case, name) => {
    const result = joinFormSchema.safeParse({ name });

    expect(result.success).toBe(false);
    expect(result.error?.issues).toHaveLength(1);
    expect(result.error?.issues[0]?.path).toEqual(['name']);
    expect(result.error?.issues[0]?.message).toBe(NAME_ERROR);
  });
});

describe('readJoinForm', () => {
  it('lê o campo name como texto', () => {
    const formData = new FormData();
    formData.set('name', ' Ana ');

    expect(readJoinForm(formData)).toEqual({ name: ' Ana ' });
  });

  it.each([
    ['ausente', () => new FormData()],
    [
      'não é texto',
      () => {
        const formData = new FormData();
        formData.set('name', new Blob(['Ana']));
        return formData;
      },
    ],
  ])('campo %s vira string vazia', (_case, build) => {
    expect(readJoinForm(build())).toEqual({ name: '' });
  });
});
