# Arquitetura do Projeto

Estrutura base padrão para o app `api` (NestJS) do monorepo. Visão geral do monorepo: [../../ARCHITECTURE.md](../../ARCHITECTURE.md).
Este app fica em `apps/api`. Os comandos abaixo podem ser rodados **dentro de `apps/api`** ou **da raiz**, com `--workspace=apps/api` (ex.: `npm run test:cov --workspace=apps/api`).
Este documento descreve **como o código é organizado** e **as convenções que todo módulo novo deve seguir**.

O módulo `chat` (participantes e mensagens) é o domínio do projeto e a referência do padrão. A exceção dele à convenção de repositórios está na [seção 14](#14-decisões).

---

## 1. Stack

| Camada            | Tecnologia                                                              |
| ----------------- | ----------------------------------------------------------------------- |
| Framework         | NestJS (Express), projeto **ESM** (`"type": "module"`)                  |
| Linguagem         | TypeScript em modo `strict`                                             |
| ORM / Banco       | Prisma (driver adapter `pg`) + PostgreSQL                               |
| Configuração      | `@nestjs/config` + validação com zod                                    |
| Validação         | class-validator + class-transformer                                     |
| Documentação      | Swagger (`@nestjs/swagger`)                                             |
| Logs              | pino (`nestjs-pino`), JSON em produção, legível em dev                  |
| Segurança         | helmet, CORS, rate limit global (`@nestjs/throttler`)                   |
| Health check      | `@nestjs/terminus`                                                      |
| Testes            | Vitest (unitários e e2e) + Supertest, **100% de cobertura obrigatória** |
| Lint / Formatação | oxlint + Prettier                                                       |
| Infra local       | Docker + Docker Compose                                                 |

---

## 2. Visão geral das pastas

```
.
├── prisma/
│   ├── schema.prisma              # models do banco
│   ├── migrations/                # migrations versionadas (nunca editar à mão)
│   └── seeds/                     # seeders idempotentes (make seeder)
├── prisma.config.ts               # config da CLI do Prisma (schema, migrations, seed, DATABASE_URL)
├── src/
│   ├── app/
│   │   ├── main.ts                # bootstrap (logger + setupApp + listen)
│   │   ├── app.setup.ts           # config global: helmet, CORS, prefixo, versão, pipes, Swagger
│   │   ├── openapi.ts             # gera o documento OpenAPI sem subir a app nem o banco
│   │   └── openapi.cli.ts         # npm run openapi:export → openapi.json
│   │   └── app.module.ts          # módulo raiz + guard e filtro globais
│   ├── common/                    # código compartilhado, sem regra de negócio
│   │   ├── config/                # schema zod das variáveis + AppConfigService tipado
│   │   ├── decorators/            # ex.: @ApiPaginatedResponse
│   │   ├── dtos/
│   │   │   ├── request/           # PaginationDto
│   │   │   └── response/          # PaginatedResponseDto<T>
│   │   ├── filters/               # PrismaExceptionFilter
│   │   ├── interfaces/            # IBaseRepository
│   │   ├── logger/                # LoggerModule + createLoggerOptions (pino)
│   │   └── prisma/                # PrismaModule (@Global) + PrismaService
│   ├── generated/prisma/          # client gerado pelo Prisma (não versionado)
│   └── modules/                   # um diretório por domínio
│       ├── health/
│       │   ├── controllers/
│       │   └── indicators/
│       └── <dominio>/             # ex.: chat/
│           ├── controllers/
│           │   └── test/
│           ├── services/
│           │   └── test/
│           ├── repositories/
│           │   └── test/
│           ├── dtos/
│           │   ├── request/
│           │   └── response/
│           ├── mappers/
│           ├── test-fixtures.ts       # dados de teste compartilhados (make<Entidade>)
│           └── <dominio>.module.ts
├── test/                          # testes e2e
├── tools/vitest/                  # plugin de cobertura (branches gerados por decorators)
├── Dockerfile
├── docker-compose.yml
└── .env.example
```

### Regra de ouro

- **`common/`** guarda o que é genérico e reutilizável. **Não pode importar nada de `modules/`.**
- **`modules/`** guarda o domínio. Cada módulo é autocontido e só expõe o que declara em `exports`.

---

## 3. Camadas e fluxo de uma requisição

```
HTTP ──► Controller ──► Service ──► Repository ──► PrismaService ──► PostgreSQL
           │              │  ▲          │
        DTO request    regra de  │   acesso a dados,
        + Swagger      negócio   │   retorna o model
        + pipes                  │   do Prisma
                              Mapper
                        (model → DTO response)
```

| Camada         | Responsabilidade                                                                  | Não deve                                         |
| -------------- | --------------------------------------------------------------------------------- | ------------------------------------------------ |
| **Controller** | Rotas, status HTTP, pipes (`ParseUUIDPipe`), Swagger                              | Ter regra de negócio ou acessar o Prisma         |
| **Service**    | Regras de negócio, orquestração, exceções HTTP, chamar o mapper                   | Montar queries do Prisma                         |
| **Repository** | Toda interação com o banco via `PrismaService`. Recebe e retorna tipos do Prisma. | Conhecer DTOs HTTP ou lançar exceções de negócio |
| **Mapper**     | Converter o model do Prisma no DTO de resposta                                    | Ter lógica de negócio ou acessar o banco         |
| **DTOs**       | Contrato de entrada (validado) e de saída (documentado)                           | Conter lógica                                    |

O repositório **não conhece o formato da API**. Se o contrato HTTP mudar (renomear um campo, esconder outro), só o mapper e o DTO mudam.

---

## 4. Configuração global (`src/app/app.setup.ts`)

Toda a configuração global fica em `setupApp(app)`, chamado pelo `main.ts` **e pelos testes e2e**, para que os testes rodem a aplicação exatamente como em produção.

| Item               | Comportamento                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------------ |
| **Prefixo**        | Todas as rotas ficam em `/api`, exceto `/health`                                                       |
| **Versionamento**  | Por URI, versão padrão `1`, então as rotas ficam em `/api/v1/<recurso>`                                |
| **ValidationPipe** | `whitelist`, `forbidNonWhitelisted` (campo desconhecido gera 400) e `transform`                        |
| **helmet**         | Headers de segurança. O CSP só é desligado quando o Swagger está ativo, porque a UI usa scripts inline |
| **CORS**           | Origens de `CORS_ORIGIN`, métodos `GET`, `POST`, `PUT`, `PATCH` e `DELETE`                             |
| **Swagger**        | Em `/swagger-api`, **somente fora de produção**                                                        |
| **Shutdown hooks** | Ativos, para o Prisma desconectar de forma limpa                                                       |

O `app.module.ts` registra os itens globais via DI:

- `APP_GUARD` com `ThrottlerGuard`: rate limit aplicado a todas as rotas (o health usa `@SkipThrottle`).
- `APP_FILTER` com `PrismaExceptionFilter` (ver [5.7](#57-exceções)).

Para criar uma versão nova de um endpoint, use `@Controller({ path: 'x', version: '2' })` ou `@Version('2')` no método.

---

## 5. Convenções

> **Comentários:** sempre em inglês, curtos e só para explicar o porquê. Regras e exemplos em [ARCHITECTURE.md da raiz](../../ARCHITECTURE.md#5-comentários-no-código).

> **Reaproveitamento:** onde fica o código compartilhado e quando extrair, em [ARCHITECTURE.md da raiz](../../ARCHITECTURE.md#6-reaproveitamento-de-código).

### 5.1 Nomenclatura

| Item               | Padrão                                     | Exemplo                                   |
| ------------------ | ------------------------------------------ | ----------------------------------------- |
| Pasta do módulo    | plural, kebab-case                         | `modules/chat/`                           |
| Arquivos           | `<entidade>.<tipo>.ts` (singular)          | `message.repository.ts`                   |
| Contrato de repo   | `<entidade>.repository.interface.ts`       | `message.repository.interface.ts`         |
| Classe de contrato | prefixo `I`                                | `IMessageRepository`                      |
| Mapper             | `mappers/<entidade>.mapper.ts`             | `MessageMapper.toResponse()`              |
| DTO de entrada     | `<acao>-<entidade>.dto.ts`                 | `send-message.dto.ts`                     |
| DTO de saída       | `<entidade>-response.dto.ts`               | `message-response.dto.ts`                 |
| Testes             | `test/<arquivo>.spec.ts` ao lado da camada | `mappers/test/message.mapper.spec.ts`     |
| Rotas              | recurso no plural, **sem** `api/`          | `@Controller('chat/messages')`            |
| Model Prisma       | singular PascalCase + `@@map` no plural    | `model Message { ... @@map("messages") }` |

### 5.2 Imports (ESM)

O projeto é ESM. Por isso:

- **Todo import relativo ou de alias termina em `.js`**, mesmo apontando para um arquivo `.ts`.
- Para sair do próprio módulo, use o alias `@/` (aponta para `src/`):

```ts
import { PaginationDto } from '@/common/dtos/request/pagination.dto.js';
import { SendMessageDto } from '../dtos/request/send-message.dto.js';
```

Os imports relativos ficam restritos ao próprio módulo. O `nest build` reescreve o `@/` para caminhos relativos no `dist`, e o Vitest resolve pelo `tsconfig`.

### 5.3 DTOs

- **Request**: sempre com `class-validator` (incluindo `@MaxLength` em strings) e `@ApiProperty`/`@ApiPropertyOptional`.
- **Update**: estende o Create com `PartialType` de `@nestjs/swagger`.
- **Response**: classe com `@ApiProperty`. É o retorno do service e do controller, **nunca do repositório**.
- **Listagens**: recebem `PaginationDto` (ou uma classe que o estende, para adicionar filtros) e retornam `PaginatedResponseDto<T>`:

```json
{
  "data": [ ... ],
  "meta": { "total": 21, "page": 3, "limit": 10, "last_page": 3 }
}
```

`PaginationDto` valida `page ≥ 1`, `1 ≤ limit ≤ 100` e `search` (string, até 100 caracteres), e expõe `skip` já calculado.
Monte a resposta com `PaginatedResponseDto.create(items, total, pagination)`. O `last_page` é sempre ≥ 1.

**Filtros extras** (ex.: status) entram em um DTO que estende `PaginationDto`, sempre com validação (`@IsEnum`, `@IsUUID`...). Sem isso, um valor inválido chega ao Prisma e vira 500.

### 5.4 Repositórios

Todo repositório tem um contrato que estende `IBaseRepository`, tipado com os **tipos do Prisma** (exceção: os repositórios do `chat`, ver abaixo e a [seção 14](#14-decisões)):

```ts
// src/common/interfaces/base-repository.interface.ts
export abstract class IBaseRepository<T, CreateData, UpdateData> {
  abstract findAll(params: FindAllParams): Promise<FindAllResult<T>>; // { items, total }
  abstract findById(id: string): Promise<T | null>;
  abstract create(data: CreateData): Promise<T>;
  abstract update(id: string, data: UpdateData): Promise<T>;
  abstract delete(id: string): Promise<void>;
}
```

```ts
// order.repository.interface.ts
export abstract class IOrderRepository extends IBaseRepository<
  Order, // model do Prisma
  Prisma.OrderCreateInput,
  Prisma.OrderUpdateInput
> {
  // métodos específicos do domínio entram aqui
}
```

Os repositórios do `chat` não estendem `IBaseRepository`: o domínio só insere e marca a saída, sem listagem paginada, update ou delete genéricos. O contrato declara só os métodos de domínio:

```ts
// message.repository.interface.ts
export abstract class IMessageRepository {
  abstract findPage(
    params: FindMessagePageParams,
  ): Promise<MessageWithAuthor[]>;
  abstract create(data: CreateMessageData): Promise<MessageWithAuthor>;
}
```

O contrato é uma **classe abstrata**, não uma `interface`, para servir como **token de injeção**.

Boas práticas:

- Faça a listagem paginada com `$transaction([findMany, count])`, para que dados e total sejam consistentes.
- `findById` retorna `null`. Quem decide se isso vira 404 é o service.
- Quando precisar de relações, use `select`/`include` e tipe o retorno com `Prisma.<Model>GetPayload<...>`. Nunca use `any`.

### 5.5 Injeção de dependência

Os services dependem **do contrato**, e o módulo faz a ligação com a implementação:

```ts
// chat.module.ts
@Module({
  controllers: [ParticipantsController, MessagesController],
  providers: [
    ParticipantsService,
    MessagesService,
    ParticipantTokenGuard,
    { provide: IParticipantRepository, useClass: ParticipantRepository },
    { provide: IMessageRepository, useClass: MessageRepository },
  ],
  exports: [ParticipantsService],
})
export class ChatModule {}
```

```ts
// messages.service.ts
constructor(private readonly messages: IMessageRepository) {}
```

Nos testes, o mock é registrado no lugar do contrato: `{ provide: IMessageRepository, useValue: mock }`.

### 5.6 Comunicação entre módulos

Um módulo **não** registra providers de outro módulo. Ele **importa** o módulo dono, que precisa ter exportado o que é usado:

```ts
// ✅ correto
@Module({
  imports: [ChatModule], // ChatModule exporta ParticipantsService
  providers: [
    OrderService,
    { provide: IOrderRepository, useClass: OrderRepository },
  ],
})
export class OrderModule {}
```

```ts
// ❌ evitar: cria uma segunda instância e esconde o acoplamento
providers: [OrderService, OrderRepository, ParticipantRepository];
```

Prefira exportar o **service** em vez do repositório, para que as regras do outro domínio continuem sendo aplicadas.
Se dois módulos dependerem um do outro, extraia a lógica comum para um terceiro módulo. Use `forwardRef` só em último caso.

### 5.7 Exceções

**As constraints do banco são a fonte da verdade.** Unicidade vira `@unique` no schema, e relacionamentos viram FKs.
O service **não** faz "checa e depois grava", porque isso abre espaço para condição de corrida.

O `PrismaExceptionFilter` (global) converte os erros do Prisma:

| Código Prisma | Situação                                | HTTP |
| ------------- | --------------------------------------- | ---- |
| `P2002`       | violação de `@unique`                   | 409  |
| `P2003`       | violação de FK                          | 409  |
| `P2025`       | registro não encontrado (update/delete) | 404  |
| outros        | erro inesperado (é logado)              | 500  |

O service lança exceções do Nest (`NotFoundException`, `ConflictException`...) só para **regras de negócio** ou quando quer uma mensagem específica, como no `findById`.
As mensagens são voltadas ao usuário final.

### 5.8 Controllers e Swagger

Todo endpoint documenta:

- `@ApiTags` na classe.
- `@ApiOperation` com `summary`.
- `@ApiParam`, `@ApiQuery` e `@ApiBody` quando houver.
- Uma resposta `@Api*Response` para cada status possível.
- Listagens usam `@ApiPaginatedResponse(XResponseDto)`, para que o Swagger mostre o tipo real dos itens.

> **O Swagger é o contrato com o `web`.** O `openapi.json` exportado daqui gera os tipos do `@repo/api-client`, que o `web` usa. Um DTO sem `@ApiProperty` (ou com tipo errado) vira um tipo errado no front, e renomear um campo quebra o build do `web` no CI. Por isso:
>
> - todo campo de DTO de resposta tem `@ApiProperty` (com `nullable: true` quando aceita `null`);
> - todo campo obrigatório é declarado como obrigatório (é o padrão do `@ApiProperty`);
> - após mudar um DTO, rode `npm run generate` na raiz para atualizar os tipos do front.

Status HTTP padrão:

| Operação          | Método   | Status | Corpo                                    |
| ----------------- | -------- | ------ | ---------------------------------------- |
| Listar            | `GET`    | 200    | paginado                                 |
| Buscar por ID     | `GET`    | 200    | recurso                                  |
| Criar             | `POST`   | 201    | recurso criado                           |
| Atualizar parcial | `PATCH`  | 200    | recurso atualizado                       |
| Substituir        | `PUT`    | 200    | recurso (só quando a troca for completa) |
| Remover           | `DELETE` | 204    | vazio                                    |

IDs são UUID e validados com `ParseUUIDPipe`.

---

## 6. Banco de dados (Prisma)

- O schema fica em `prisma/schema.prisma`. A config da CLI fica em `prisma.config.ts`, que lê a `DATABASE_URL`.
- O client é gerado em `src/generated/prisma` (ESM, não versionado). Importe de `@/generated/prisma/client.js`.
- A conexão usa o driver adapter `@prisma/adapter-pg`, configurado no `PrismaService`.
- Convenções de model:
  - IDs: `String @id @default(uuid())`.
  - Model no singular e tabela no plural com `@@map`. Colunas em snake_case com `@map`.
  - `createdAt` e `updatedAt` em todos os models.
  - `@unique` para unicidade de negócio, e `@@index` para campos de busca e FKs.
- O `PrismaModule` é `@Global()`, então o `PrismaService` pode ser injetado em qualquer repositório.

Comandos:

```bash
make migrate                                   # na raiz: sobe o banco e aplica as migrations
make migration name=<descricao>                # na raiz: cria e aplica uma migration nova
make seeder                                    # na raiz: migrations + seeders
make reset                                     # na raiz: apaga o banco local, migrations + seeders
npm run prisma:migrate -- --name <descricao>   # o mesmo que make migration, dentro de apps/api
npm run prisma:deploy                          # aplica migrations (CI/produção)
npm run prisma:seed                            # roda os seeders
npm run prisma:generate                        # regenera o client (o build pelo Turborepo já roda isso)
npm run prisma:studio                          # UI do banco
```

> A CLI do Prisma é devDependency e **não vai para a imagem de produção**.
> Em produção, rode as migrations no pipeline de CI/CD ou com o estágio `dev` da imagem antes de subir a nova versão.

---

### 6.1 Seeders

Dados de exemplo para desenvolvimento, rodados com `make seeder` na raiz (ou `npm run prisma:seed` aqui).

```
prisma/seeds/
├── index.ts               # runner: abre o PrismaClient e roda os seeders em ordem
└── <entidade>.seed.ts     # um arquivo por entidade: seed<Entidade>(prisma)
```

- **Idempotentes:** use `upsert` por um campo `@unique`, nunca `create` puro. Rodar o seeder duas vezes não pode duplicar dados nem falhar.
- **Um arquivo por entidade**, registrado na lista `seeders` do `index.ts`. A ordem da lista respeita as FKs: quem é referenciado vem antes.
- **Só dados de desenvolvimento.** Dados obrigatórios para o sistema funcionar (ex.: papéis de usuário) vão numa migration, não num seeder.
- Rodam com `tsx` (configurado em `migrations.seed` no `prisma.config.ts`) e leem a `DATABASE_URL` do `apps/api/.env`.
- Ficam fora da medição de cobertura (estão fora de `src/`, como o `tools/`), mas passam por lint e typecheck.

### 6.2 Exportando o OpenAPI

```bash
npm run build && npm run openapi:export   # gera apps/api/openapi.json (não versionado)
npm run generate                           # na raiz: build da api + export + tipos do api-client
```

O export usa o modo **preview** do Nest: monta o grafo de módulos e lê os controllers **sem instanciar providers**. Por isso não precisa de banco nem de `.env` (a `DATABASE_URL` recebe um valor fictício só para passar na validação).
Rotas e versionamento vêm do mesmo `configureRouting()` usado pela aplicação, então o documento tem exatamente as rotas reais.

---

## 7. Configuração e ambiente

As variáveis são declaradas e validadas com zod em `src/common/config/env.schema.ts`.
Se alguma estiver faltando ou for inválida, **a aplicação não sobe** e mostra no log qual variável falhou.

Para ler as variáveis, injete o `AppConfigService`, que é tipado:

```ts
constructor(private readonly config: AppConfigService) {}
// ...
this.config.get('PORT');        // number
this.config.isProduction;       // boolean
```

**Não use `process.env` no código.** Para adicionar uma variável nova, declare no `env.schema.ts` e no `.env.example`.

| Variável         | Uso                                                          | Padrão                  |
| ---------------- | ------------------------------------------------------------ | ----------------------- |
| `DATABASE_URL`   | conexão do Prisma                                            | **obrigatória**         |
| `NODE_ENV`       | `development`, `test` ou `production`                        | `development`           |
| `PORT`           | porta HTTP                                                   | `3333`                  |
| `APP_NAME`       | título do Swagger                                            | `api`                   |
| `LOG_LEVEL`      | nível do pino (`info`, `debug`, `silent`...)                 | `info`                  |
| `CORS_ORIGIN`    | origens permitidas, separadas por `,` (o `web` roda na 3000) | `http://localhost:3000` |
| `THROTTLE_TTL`   | janela do rate limit (ms)                                    | `60000`                 |
| `THROTTLE_LIMIT` | requisições por IP na janela                                 | `60`                    |

**Onde fica cada variável:**

| Arquivo         | Conteúdo                                                                |
| --------------- | ----------------------------------------------------------------------- |
| `apps/api/.env` | variáveis da aplicação (tabela acima), lidas pelo Nest e pelo Prisma    |
| `.env` (raiz)   | só infraestrutura do Compose: `POSTGRES_*`, `POSTGRES_PORT`, `API_PORT` |

Copie os dois `.env.example` para `.env` e troque `<nome-do-projeto>` pelo nome real.
Os arquivos `.env` não são versionados nem copiados para a imagem.

**A `DATABASE_URL` do `apps/api/.env` sempre aponta para `localhost`** (na `POSTGRES_PORT` da raiz). Ela é usada ao rodar a API, os testes e as migrations fora do Docker.
Dentro do Compose, os serviços `api` e `migrate` recebem uma `DATABASE_URL` montada a partir das credenciais do `.env` da raiz, com o host `database`. Por isso não é preciso trocar nada ao alternar entre Docker e local.

As credenciais do banco aparecem nos dois arquivos (`POSTGRES_*` na raiz e dentro da `DATABASE_URL` da api) e precisam ser iguais.

---

## 8. Logs

- O pino substitui o logger do Nest. O `Logger` padrão do Nest (`new Logger(Contexto.name)`) continua funcionando e sai pelo pino.
- **Em produção** a saída é JSON, uma linha por evento, pronta para agregadores de log. **Em desenvolvimento** é formatada pelo `pino-pretty`.
- Cada requisição recebe um **request id**: usa o header `x-request-id` quando o cliente envia um, ou gera um UUID. O id é devolvido no header da resposta.
- Cada requisição gera uma linha com método, URL, status e tempo de resposta, sem headers nem corpo. As chamadas a `/health` não são logadas.

---

## 9. Health check

Fica fora do prefixo `/api`, fora do versionamento e fora do rate limit.

| Rota                 | Verifica                  |
| -------------------- | ------------------------- |
| `GET /health`        | conectividade com o banco |
| `GET /health/memory` | heap abaixo de 150 MB     |

---

## 10. Testes

### 10.1 Cobertura obrigatória: 100%

**O projeto exige 100% de cobertura em statements, branches, functions e lines.** Os limites vêm do `coverageConfig()` do `@repo/vitest-config`, compartilhado com o web e os pacotes; o `vitest.config.ts` só define o que medir. Abaixo de 100%, o `npm run test:cov` termina com erro, e no CI isso bloqueia o merge.

A cobertura é **a soma dos unitários com os e2e**, que rodam como dois `projects` do Vitest num único `test:cov`. Os arquivos declarativos (`*.module.ts`, `app.module.ts`) ficam cobertos quando o e2e sobe a aplicação real, sem precisar de testes artificiais.

**O que fica fora da medição** é uma lista fechada no `vitest.config.ts`. Adicionar um item novo exige justificativa no PR.

| Excluído           | Motivo                                                                            |
| ------------------ | --------------------------------------------------------------------------------- |
| `src/generated/**` | client do Prisma, gerado                                                          |
| `src/app/main.ts`  | só chama `bootstrap()`; toda a configuração está no `app.setup.ts`, que é testado |
| `**/*.spec.ts`     | os próprios testes                                                                |

**Comentários de ignore** (`/* v8 ignore */` e similares) **são proibidos no código.** Se algo parecer impossível de cobrir, a saída é mudar a estrutura (ex.: extrair a lógica para uma função pura, como o `createLoggerOptions`), não ignorar.

**Branches gerados pelos decorators.** Com `emitDecoratorMetadata`, o compilador gera `typeof X === "undefined" ? Object : X` para cada tipo usado em decorators. O ramo `Object` nunca executa, mas seria contado como branch não coberto. O plugin [tools/vitest/decorator-metadata-coverage.plugin.ts](tools/vitest/decorator-metadata-coverage.plugin.ts) marca **só esse padrão gerado** no código transformado, durante os testes. O código escrito à mão continua sendo medido normalmente.

### 10.2 Onde fica cada teste

| Tipo        | Onde                          | Mocka                                                         |
| ----------- | ----------------------------- | ------------------------------------------------------------- |
| Service     | `services/test/*.spec.ts`     | o contrato do repositório                                     |
| Controller  | `controllers/test/*.spec.ts`  | o service                                                     |
| Repository  | `repositories/test/*.spec.ts` | o `PrismaService`                                             |
| `common/`   | `common/**/test/*.spec.ts`    | o que for preciso                                             |
| `app.setup` | `app/test/app.setup.spec.ts`  | o `AppConfigService` (testa os caminhos de produção e de dev) |
| E2E         | `test/*.e2e-spec.ts`          | nada: usa banco real e `setupApp()`                           |

### 10.3 Comandos

```bash
npm test               # unitários (não precisa de banco)
npm run test:e2e       # e2e (precisa do banco)
npm run test:cov       # unitários + e2e com cobertura (precisa do banco); falha abaixo de 100%
```

Os comandos que precisam do banco exigem o Postgres rodando (`docker compose up -d database`, na raiz). A `DATABASE_URL` do `apps/api/.env` já aponta para `localhost`.
O relatório HTML fica em `coverage/index.html`.

### 10.4 Convenções

- O Vitest roda com `globals: true` (`describe`, `it`, `expect`, `vi`). Os mocks usam `vi.fn()` e são tipados com `Mocked<T>`.
- Cubra **cada branch** do código: caminho feliz, erro, valores padrão e limites (ex.: `limit=101`).
- Lógica dentro de `useFactory` ou de decorators deve ser extraída para uma função exportada e testada direto (ex.: `createLoggerOptions`).
- Dados de teste ficam no `test-fixtures.ts` do módulo (`makeParticipant(overrides)`, `makeMessage(overrides)`), compartilhado pelos specs do módulo.
- Os testes e2e limpam os próprios dados: use um prefixo nos registros que eles criam (ex.: `e2e-`).

---

## 11. Rodando o projeto

Na **raiz do monorepo**:

```bash
make install   # cria os .env que faltam, instala as dependências e gera o contrato
make dev       # docker compose up --build
```

O Compose sobe três serviços, nesta ordem:

| Serviço    | Função                                                                                                                     |
| ---------- | -------------------------------------------------------------------------------------------------------------------------- |
| `database` | Postgres com healthcheck                                                                                                   |
| `migrate`  | espera o banco ficar saudável, roda `prisma migrate deploy` e encerra                                                      |
| `api`      | sobe só depois do migrate. Gera o client e roda em modo watch, com `apps/api/src` e `apps/api/prisma` montados como volume |

Os serviços não têm `container_name` fixo, porque o Compose usa o nome da pasta como prefixo. As portas do host vêm de `API_PORT` e `POSTGRES_PORT` (`.env` da raiz).

```bash
docker compose logs -f api                                     # logs da API
docker compose exec api npm run prisma:migrate -- --name x     # cria migration dentro do container
docker compose down                                            # para tudo (mantém os dados)
docker compose down -v                                         # para tudo e apaga o volume do banco
```

**Sem Docker para a API:** suba só o banco (`docker compose up -d database`) e rode `npm run prisma:deploy` e `npm run start:dev` (em `apps/api`, ou da raiz com `--workspace=apps/api`). A `DATABASE_URL` do `apps/api/.env` já aponta para `localhost`.

### Dockerfile

O build parte da **raiz do monorepo**, porque o `package-lock.json` é único e fica lá:

```bash
docker build -f apps/api/Dockerfile --target production -t <nome>:<tag> .
```

Multi-stage. Todos os estágios rodam como o usuário `node` (não root).

| Estágio      | O que faz                                                                                                              |
| ------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `pruner`     | `turbo prune api --docker`: recorta do monorepo só a `api` e as dependências dela, com um `package-lock.json` reduzido |
| `deps`       | `npm ci` com todas as dependências                                                                                     |
| `dev`        | usado pelo Compose: código + client gerado + CLI do Prisma, roda `start:dev`                                           |
| `builder`    | `turbo run build --filter=api` (gera o client do Prisma antes de compilar)                                             |
| `prod-deps`  | `npm ci --omit=dev --omit=optional --omit=peer`, só o que roda em produção                                             |
| `production` | `node_modules` de produção + `apps/api/dist`. Entrypoint: `node dist/app/main.js`                                      |

O `--omit=optional --omit=peer` existe porque a CLI do Prisma é peer opcional do `@prisma/client`. Só com `--omit=dev`, ela (e o TypeScript junto) iria para a imagem, quase dobrando o tamanho.

---

## 12. Iniciando um projeto novo a partir da base

1. Copie o repositório e troque o `name` no `package.json` da raiz.
2. Copie os dois `.env.example` (raiz e `apps/api`) para `.env` e troque `<nome-do-projeto>`.
3. Remova o domínio do chat:
   - a pasta `src/modules/chat/`;
   - o `ChatModule` no `app.module.ts`;
   - os models `Participant` e `Message` e o enum `MessageType` no `schema.prisma`;
   - a pasta `prisma/migrations/` (a primeira migration do projeto será gerada a partir dos seus models);
   - o `test/chat.e2e-spec.ts`.
4. Crie os módulos do domínio seguindo a [seção 13](#13-checklist-criando-um-módulo-novo).

---

## 13. Checklist: criando um módulo novo

1. **Prisma**: adicionar o model (com `@unique` e `@@index` onde fizer sentido) e rodar `make migration name=add_<entidade>` na raiz.
2. **Pasta**: criar `src/modules/<dominio>/` com `controllers/`, `services/`, `repositories/`, `dtos/request/`, `dtos/response/` e `mappers/`.
3. **DTOs**: criar Create, Update (`PartialType`) e Response. Se a listagem tiver filtros, criar um DTO que estende `PaginationDto`.
4. **Contrato**: criar `<entidade>.repository.interface.ts` estendendo `IBaseRepository<Model, Prisma.XCreateInput, Prisma.XUpdateInput>`.
5. **Repository**: criar a implementação `@Injectable()` com `PrismaService`, retornando tipos do Prisma.
6. **Mapper**: criar `<Entidade>Mapper.toResponse()`.
7. **Service**: injetar o **contrato** e implementar as regras de negócio. Unicidade e existência ficam com a constraint e o filtro.
8. **Controller**: usar `@Controller('<recurso>')` (o `/api/v1` é automático), `PATCH` para atualização e documentar tudo no Swagger.
9. **Module**: ligar o contrato à implementação (`provide`/`useClass`) e exportar o que outros módulos usarão.
10. **AppModule**: registrar o módulo em `imports`.
11. **Testes**: specs de service, controller, repository e mapper, mais os cenários e2e. A cobertura precisa continuar em 100%.
12. **Validação final**: `make gate` na raiz, com 100% de cobertura.

---

## 14. Decisões

Por que a api é como é. Ao mudar uma destas decisões, atualize esta tabela.

| Decisão                                                                               | Alternativas consideradas                                 | Motivo                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **O Swagger (OpenAPI) é o contrato com o web**; o `@repo/api-client` é gerado dele    | schemas zod compartilhados (`nestjs-zod`); tRPC / ts-rest | Mantém class-validator e o padrão REST + Swagger do Nest. O contrato é a própria documentação. Zod compartilhado trocaria a validação da base inteira, e tRPC criaria um contrato paralelo aos controllers                                                                                                                 |
| Export do OpenAPI no **modo `preview`** do Nest                                       | subir a app com banco; mockar o `PrismaService`           | Não instancia providers, então não precisa de banco nem de `.env`. Roda no CI e dentro do build do Docker                                                                                                                                                                                                                  |
| Branches de decorators tratados por **plugin do Vitest**                              | provider `istanbul`; comentários de ignore                | O istanbul deu o mesmo resultado do v8. O plugin marca só o código gerado pelo compilador, e ignores no código continuam proibidos                                                                                                                                                                                         |
| **Vitest 4**                                                                          | Vitest 5                                                  | É a versão do scaffold oficial do NestJS. O web usa a mesma, para ter uma versão só no monorepo                                                                                                                                                                                                                            |
| **Prisma 7**                                                                          | Prisma 8                                                  | A tag `latest` do npm apontava para uma versão RC da 8; a 7 é a estável                                                                                                                                                                                                                                                    |
| Porta **3333**                                                                        | 3000                                                      | A 3000 é do web                                                                                                                                                                                                                                                                                                            |
| Cobertura = **unitários + e2e**                                                       | só unitários                                              | Os arquivos declarativos (`*.module.ts`) ficam cobertos pelo e2e, sem testes artificiais                                                                                                                                                                                                                                   |
| Autenticação                                                                          | JWT na api + cookie `httpOnly` no web                     | **Em aberto.** Ainda não implementada                                                                                                                                                                                                                                                                                      |
| Repositórios do `chat` **sem `IBaseRepository`** (exceção ao [5.4](#54-repositórios)) | estender `IBaseRepository` e implementar o CRUD genérico  | O domínio só insere participantes e mensagens e marca a saída; não tem listagem paginada, update nem delete genéricos. Métodos CRUD sem uso exigiriam testes artificiais para manter os 100%. Os contratos continuam classes abstratas (token de injeção), com métodos de domínio (`createWithJoinMessage`, `findPage`...) |
