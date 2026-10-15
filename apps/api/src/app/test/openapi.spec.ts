import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildOpenApiDocument, exportOpenApi } from '../openapi.js';

describe('OpenAPI export', () => {
  it('gera o documento com as rotas versionadas sem conectar no banco', async () => {
    const document = await buildOpenApiDocument();

    expect(Object.keys(document.paths)).toEqual(
      expect.arrayContaining(['/health']),
    );
  });

  describe('contrato do chat', () => {
    type Operation = {
      parameters?: { name: string; in: string; required?: boolean }[];
      responses: Record<
        string,
        { content?: { 'application/json': { schema: { $ref: string } } } }
      >;
    };
    let paths: Record<string, Record<string, Operation>>;
    let schemas: Record<string, Record<string, unknown>>;

    beforeAll(async () => {
      const document = await buildOpenApiDocument();
      paths = document.paths as unknown as typeof paths;
      schemas = document.components?.schemas as unknown as typeof schemas;
    });

    const tokenHeader = (operation: Operation) =>
      operation.parameters?.find(
        (p) => p.in === 'header' && p.name === 'X-Participant-Token',
      );
    const bodyRef = (operation: Operation, status: string) =>
      operation.responses[status]?.content?.['application/json'].schema.$ref;

    it('tem as rotas do chat com os métodos certos', () => {
      expect(Object.keys(paths['/api/v1/chat/participants'])).toEqual(['post']);
      expect(Object.keys(paths['/api/v1/chat/participants/online'])).toEqual([
        'get',
      ]);
      expect(
        Object.keys(paths['/api/v1/chat/participants/{id}/leave']),
      ).toEqual(['post']);
      expect(Object.keys(paths['/api/v1/chat/messages']).sort()).toEqual([
        'get',
        'post',
      ]);
    });

    it('exige o header X-Participant-Token só nas rotas protegidas', () => {
      const leave = paths['/api/v1/chat/participants/{id}/leave'].post;
      const send = paths['/api/v1/chat/messages'].post;

      expect(tokenHeader(leave)).toMatchObject({ required: true });
      expect(tokenHeader(send)).toMatchObject({ required: true });
      expect(tokenHeader(paths['/api/v1/chat/participants'].post)).toBe(
        undefined,
      );
      expect(tokenHeader(paths['/api/v1/chat/participants/online'].get)).toBe(
        undefined,
      );
      expect(tokenHeader(paths['/api/v1/chat/messages'].get)).toBe(undefined);
    });

    it('documenta os status e os corpos de cada rota', () => {
      const join = paths['/api/v1/chat/participants'].post;
      expect(Object.keys(join.responses).sort()).toEqual(['201', '400', '409']);
      expect(bodyRef(join, '201')).toBe(
        '#/components/schemas/ParticipantJoinedResponseDto',
      );

      const online = paths['/api/v1/chat/participants/online'].get;
      expect(bodyRef(online, '200')).toBe(
        '#/components/schemas/OnlineParticipantsResponseDto',
      );

      const leave = paths['/api/v1/chat/participants/{id}/leave'].post;
      expect(Object.keys(leave.responses).sort()).toEqual([
        '204',
        '400',
        '401',
        '404',
      ]);

      const list = paths['/api/v1/chat/messages'].get;
      expect(Object.keys(list.responses).sort()).toEqual(['200', '400']);
      expect(bodyRef(list, '200')).toBe(
        '#/components/schemas/MessagesResponseDto',
      );

      const send = paths['/api/v1/chat/messages'].post;
      expect(Object.keys(send.responses).sort()).toEqual(['201', '400', '401']);
      expect(bodyRef(send, '201')).toBe(
        '#/components/schemas/MessageResponseDto',
      );
    });

    it('MessageResponseDto tem seq numérico, type enum e clientId nullable', () => {
      const message = schemas['MessageResponseDto'] as {
        properties: Record<string, Record<string, unknown>>;
        required: string[];
      };

      expect(message.properties['seq'].type).toBe('number');
      expect(message.properties['clientId']).toMatchObject({
        type: 'string',
        nullable: true,
      });
      expect(message.properties['type']).toEqual({
        allOf: [{ $ref: '#/components/schemas/MessageType' }],
      });
      expect(schemas['MessageType']).toMatchObject({
        enum: ['USER', 'JOINED', 'LEFT'],
      });
      expect([...message.required].sort()).toEqual([
        'author',
        'clientId',
        'content',
        'createdAt',
        'id',
        'seq',
        'type',
      ]);
    });
  });

  describe('título do documento', () => {
    afterEach(() => vi.unstubAllEnvs());

    it('usa o APP_NAME quando definido', async () => {
      vi.stubEnv('APP_NAME', 'minha-api');

      expect((await buildOpenApiDocument()).info.title).toBe('minha-api');
    });

    it("usa 'api' quando o APP_NAME não está definido", async () => {
      vi.stubEnv('APP_NAME', undefined);

      expect((await buildOpenApiDocument()).info.title).toBe('api');
    });
  });

  it('grava o documento em JSON no caminho informado', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'openapi-'));
    const output = join(dir, 'openapi.json');

    await exportOpenApi(output);

    const written = JSON.parse(await readFile(output, 'utf8'));
    expect(written.openapi).toMatch(/^3\./);
    expect(written.paths).toHaveProperty('/health');
    await rm(dir, { recursive: true });
  });
});
