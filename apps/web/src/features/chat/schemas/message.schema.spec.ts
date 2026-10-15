import { messageSchema } from './message.schema';

const CLIENT_ID = '3f0c9a4e-8b1d-4c2a-9e5f-7a6b5c4d3e2f';

function issuesOf(input: unknown) {
  const result = messageSchema.safeParse(input);
  expect(result.success).toBe(false);
  return result.error!.issues;
}

describe('messageSchema', () => {
  it('aceita e grava o conteúdo depois do trim', () => {
    expect(
      messageSchema.parse({ content: '  olá  ', clientId: CLIENT_ID }),
    ).toEqual({ content: 'olá', clientId: CLIENT_ID });
  });

  it.each([
    ['1 caractere', 'a'],
    ['exatamente 1000 caracteres', 'a'.repeat(1000)],
    ['1000 caracteres com espaços em volta', `  ${'a'.repeat(1000)}  `],
    ['1000 emojis (1 caractere cada)', '😀'.repeat(1000)],
    ['quebras de linha internas', 'linha 1\nlinha 2'],
  ])('aceita conteúdo com %s', (_case, content) => {
    expect(
      messageSchema.safeParse({ content, clientId: CLIENT_ID }).success,
    ).toBe(true);
  });

  it.each([
    ['vazio', ''],
    ['só espaços', '   '],
    ['só quebras de linha e tab', '\n\t\n'],
  ])('rejeita conteúdo %s depois do trim', (_case, content) => {
    const issues = issuesOf({ content, clientId: CLIENT_ID });

    expect(issues.map((i) => i.path)).toEqual([['content']]);
  });

  it.each([
    ['1001 caracteres', 'a'.repeat(1001)],
    ['1001 emojis', '😀'.repeat(1001)],
  ])('rejeita conteúdo com %s, com o erro do dicionário', (_case, content) => {
    const issues = issuesOf({ content, clientId: CLIENT_ID });

    expect(issues).toHaveLength(1);
    expect(issues[0]?.path).toEqual(['content']);
    expect(issues[0]?.message).toBe(
      'A mensagem pode ter no máximo 1000 caracteres.',
    );
  });

  it.each([
    ['texto qualquer', 'abc'],
    ['vazio', ''],
    ['uuid sem um caractere', CLIENT_ID.slice(1)],
    ['uuid com caractere fora do hex', CLIENT_ID.replace('3f', '3g')],
    ['ausente', undefined],
  ])('rejeita clientId %s', (_case, clientId) => {
    const issues = issuesOf({ content: 'olá', clientId });

    expect(issues.map((i) => i.path)).toEqual([['clientId']]);
  });

  it('aceita o uuid do crypto.randomUUID()', () => {
    const clientId = crypto.randomUUID();

    expect(messageSchema.parse({ content: 'olá', clientId })).toEqual({
      content: 'olá',
      clientId,
    });
  });
});
