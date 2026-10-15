# Arquitetura do `web`

App Next (App Router) do monorepo. Visão geral do monorepo: [../../ARCHITECTURE.md](../../ARCHITECTURE.md).

A feature `examples` é **só uma referência** do padrão: copie a estrutura dela para o seu domínio e depois remova-a (ver [seção 12](#12-iniciando-um-projeto-novo-a-partir-da-base)).

---

## 1. Requisitos que guiam este app

| Requisito                                   | Onde é garantido                                                                   |
| ------------------------------------------- | ---------------------------------------------------------------------------------- |
| **SSR-first**: tudo renderizado no servidor | Server Components por padrão; Client Components com `.client.tsx` (seção 3)        |
| **100% de cobertura** de testes             | `coverageConfig()` do `@repo/vitest-config`; `npm run test:cov` falha abaixo disso |
| **Documentação no Storybook**               | story obrigatória por componente, checada por `check:conventions`                  |
| **npm** como único gerenciador              | `preinstall` da raiz bloqueia yarn/pnpm/bun                                        |

---

## 2. Stack

| Camada           | Tecnologia                                                                     |
| ---------------- | ------------------------------------------------------------------------------ |
| Framework        | Next (App Router) com **Cache Components** e **Partial Prefetching**           |
| UI               | React, Tailwind CSS, shadcn/ui (componentes no código, em `components/ui`)     |
| Dados            | `@repo/api-client` (client tipado gerado do OpenAPI da `api`)                  |
| Formulários      | Server Actions + `useActionState` + zod                                        |
| Testes unitários | Vitest (jsdom) + Testing Library + MSW                                         |
| Documentação     | Storybook (`@storybook/nextjs-vite`) com autodocs e checagem de acessibilidade |
| E2E              | Playwright + Page Objects                                                      |
| Lint             | oxlint (com regras de fronteira entre pastas) + `check:conventions`            |

---

## 3. SSR-first

**Todo componente é Server Component até que se prove o contrário.**

| Regra                       | Detalhe                                                                                                                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Padrão é servidor           | Páginas, layouts e componentes são Server Components: buscar dados e montar o HTML acontece no servidor.                                                                                   |
| Cliente é exceção explícita | Só vira Client Component o que **precisa** de estado, efeitos, eventos ou APIs do navegador.                                                                                               |
| Declaração visível          | Client Component tem `'use client'` na primeira linha **e** o sufixo `.client.tsx`. Exceção: arquivos especiais do Next que precisam ser de cliente (`error.tsx`, `global-error.tsx`).     |
| Cliente fica na folha       | O `'use client'` fica no menor componente possível. Ex.: a página é de servidor, só o formulário é de cliente.                                                                             |
| Cliente não busca dados     | Recebe dados por props e escreve por Server Actions (também recebidas por props).                                                                                                          |
| Server-only garantido       | `lib/api.ts`, `lib/env.ts` e `queries/` importam `server-only`: se forem parar num Client Component, o build quebra.                                                                       |
| Componentes do shadcn       | O `shadcn add` às vezes coloca `'use client'` em componentes sem estado (ex.: `label`, `table`). Revise: sem necessidade, remova a diretiva; com necessidade, renomeie para `.client.tsx`. |

### Como o Next renderiza (Cache Components)

- O que não depende da requisição (cabeçalho, formulário) é **pré-renderizado** no build, formando o "static shell".
- O que depende da requisição (`searchParams`, `cookies`, dados da api sem cache) fica dentro de **`<Suspense>`** e é **renderizado no servidor a cada requisição**, chegando por streaming.
- O build mostra isso por rota: `/examples` aparece como `◐ Partial Prerender`.

Regra prática: **todo container que lê `searchParams` ou chama a api fica dentro de um `<Suspense>`** na página. Sem isso, o Next acusa erro ("blocking route").

---

## 4. Estrutura

```
apps/web/
├── src/
│   ├── app/                                 # só roteamento
│   │   ├── layout.tsx
│   │   ├── page.tsx                         # redireciona para /examples
│   │   └── examples/
│   │       ├── page.tsx                     # compõe a feature (importa de @/features/examples)
│   │       └── error.tsx                    # 'use client' (exigência do Next)
│   ├── features/                            # um diretório por domínio (≈ modules/ da api)
│   │   └── examples/
│   │       ├── containers/                  # Server Components async: buscam dados → components
│   │       ├── components/                  # componentes visuais síncronos (só props) + stories
│   │       ├── queries/                     # leitura na api (server-only)
│   │       ├── actions/                     # Server Actions (escrita)
│   │       ├── schemas/                     # zod do formulário + tipos de estado
│   │       ├── example.dictionary.ts        # textos da feature
│   │       ├── example.types.ts             # aliases dos tipos do api-client
│   │       ├── test-fixtures.ts             # dados de exemplo para testes e stories
│   │       ├── index.ts                     # API pública (servidor): o que app/ pode importar
│   │       └── client.ts                    # API pública para Client Components
│   ├── components/ui/                       # componentes genéricos (shadcn + próprios), cada um com spec + story
│   └── lib/
│       ├── api.ts                           # getApi(): único ponto que fala com a api (server-only)
│       ├── env.ts                           # variáveis do servidor validadas com zod (server-only)
│       ├── search-params.ts                 # parse de parâmetros da URL
│       └── utils.ts                         # cn()
├── test/                                    # setup do Vitest, servidor MSW, stubs
├── e2e/                                     # Playwright: specs + pages/ (Page Objects)
├── .storybook/                              # configuração do Storybook
├── scripts/check-conventions.mjs            # story obrigatória + regra do .client.tsx
├── Dockerfile
└── .env.example
```

### Responsabilidade de cada pasta

| Pasta                   | Roda em                             | Faz                                                            | Testado com                                                      | Story   |
| ----------------------- | ----------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------- | ------- |
| `app/`                  | servidor                            | Rotas, layouts, `metadata`, `<Suspense>`                       | Vitest (renderiza a página com a feature mockada)                | não     |
| `features/*/containers` | servidor                            | Lê a URL, chama `queries/` e passa os dados para `components/` | Vitest: `render(await Container(props))`, com `queries/` mockado | não     |
| `features/*/components` | servidor ou cliente (`.client.tsx`) | UI do domínio, **só props**                                    | Testing Library                                                  | **sim** |
| `features/*/queries`    | servidor                            | Leitura via `getApi()`                                         | Vitest + MSW                                                     | não     |
| `features/*/actions`    | servidor                            | Valida com zod, chama a api, trata erros, `refresh()`          | Vitest + MSW (`next/cache` mockado)                              | não     |
| `features/*/schemas`    | ambos                               | Schema zod do formulário e tipos do estado                     | Vitest                                                           | não     |
| `components/ui`         | ambos                               | Componentes visuais genéricos                                  | Testing Library                                                  | **sim** |
| `lib/`                  | servidor                            | api, env, utilitários                                          | Vitest                                                           | não     |

**Por que separar `containers/` de `components/`:**

- O Vitest não renderiza Server Components `async`. Containers pequenos e async são testados chamando a função; os componentes visuais, síncronos, são testados com Testing Library.
- Componentes que só recebem props podem ser documentados no Storybook sem mock de rede.
- Toda a busca de dados fica em um lugar só.

---

## 5. Fluxo de dados

```
Navegador ──► Next (Server Component / Server Action) ──► api NestJS ──► Postgres
                │
                └── a URL da api e qualquer token ficam no servidor
```

**Leitura:**

```
page.tsx → <Suspense> → ExamplesTableContainer (async) → getExamples() → getApi().GET(...)
                                     └──────────────→ <ExamplesTable items meta />  (síncrono)
```

**Escrita:**

```
page.tsx → <ExampleForm action={createExample} />      (a action chega por props)
ExampleForm (.client.tsx) → useActionState(action) → createExample (Server Action)
  → zod → getApi().POST(...) → 409 vira erro no campo / outros erros viram mensagem → refresh()
```

- **O navegador nunca chama a api diretamente.** Por isso não é preciso configurar CORS em produção, e a URL da api não é exposta.
- **Toda Server Action é um endpoint público (POST).** Por isso ela valida a entrada com zod, mesmo que o formulário já valide. Quando houver autenticação, a sessão também é checada dentro da action.
- **Depois de uma escrita**, a action chama `refresh()` (de `next/cache`) para o navegador buscar a página de novo. Os dados da lista não usam cache, então não é preciso revalidar tags.
- **Erros de leitura** (api fora do ar) caem no `error.tsx` da rota, que oferece "Tentar novamente" (`retry()`).

---

## 6. Fronteiras entre pastas (lint)

Garantidas pelo oxlint (`no-restricted-imports` em `.oxlintrc.json`). Um import proibido quebra o `npm run lint`.

| De                      | Não pode importar                                               | Motivo                                                                                 |
| ----------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `app/`                  | arquivos internos de uma feature                                | só `@/features/<x>` (index) ou `@/features/<x>/client`                                 |
| `features/a/`           | `@/features/**` (outra feature, ou a própria pelo alias)        | dentro da feature, imports relativos; compartilhado vai para `components/ui` ou `lib/` |
| `features/*/components` | `queries/`, `containers/`, `actions/`, `@/lib/api`, `@/lib/env` | componentes só recebem props (inclusive a action)                                      |
| `components/ui`         | `@/features/**`, `@/lib/api`, `@/lib/env`                       | genérico, sem domínio                                                                  |

> No oxlint, um `override` mais específico **substitui** a regra de um override mais geral (não soma). Ao criar uma regra para uma subpasta, repita nela as restrições da pasta pai.

Além do lint, o `check:conventions` (roda junto com o `npm run lint`) verifica:

- todo componente em `components/ui` e `features/*/components` tem `*.stories.tsx` ao lado;
- todo arquivo com `'use client'` termina em `.client.tsx` (exceto `error.tsx`/`global-error.tsx` em `app/`), e todo `.client.tsx` começa com `'use client'`.

---

## 7. Convenções

> **Comentários:** sempre em inglês, curtos e só para explicar o porquê. Regras e exemplos em [ARCHITECTURE.md da raiz](../../ARCHITECTURE.md#5-comentários-no-código).

> **Reaproveitamento:** onde fica o código compartilhado e quando extrair, em [ARCHITECTURE.md da raiz](../../ARCHITECTURE.md#6-reaproveitamento-de-código).

### 7.1 Nomenclatura

| Item                   | Padrão                                        | Exemplo                        |
| ---------------------- | --------------------------------------------- | ------------------------------ |
| Feature                | plural, kebab-case                            | `features/examples/`           |
| Componente de servidor | `<nome>.tsx`                                  | `examples-table.tsx`           |
| Componente de cliente  | `<nome>.client.tsx`                           | `example-form.client.tsx`      |
| Container              | `<nome>.container.tsx`                        | `examples-table.container.tsx` |
| Teste                  | `<arquivo>.spec.ts(x)` **ao lado** do arquivo | `examples-table.spec.tsx`      |
| Story                  | `<arquivo>.stories.tsx` ao lado do componente | `examples-table.stories.tsx`   |
| Textos                 | `<feature-singular>.dictionary.ts`            | `example.dictionary.ts`        |

### 7.2 Imports

- Fora da própria pasta, use o alias `@/` (aponta para `src/`). Dentro da feature, use imports relativos.
- Diferente da `api` (ESM com Node), aqui **não** se usa extensão `.js` nos imports: quem resolve é o bundler do Next.

### 7.3 Tipos da api

- Use os tipos gerados, nunca redeclare um DTO à mão: `type Example = Schemas['ExampleResponseDto']` (em `<feature>.types.ts`).
- Mappers só existem quando a tela precisa de um formato diferente do da api (dados derivados ou combinação de respostas).

### 7.4 Textos

Toda string visível fica no `dictionary` da feature. Testes, stories e Page Objects importam os textos de lá, então mudar um texto não quebra teste.

### 7.5 Variáveis de ambiente

- São validadas com zod em `lib/env.ts` e lidas **sob demanda** (`getEnv()`), não no import. Assim o build não exige a `API_URL`.
- Variáveis sem `NEXT_PUBLIC_` ficam só no servidor. **Não use `NEXT_PUBLIC_`** para a URL da api: o navegador não fala com ela.

| Variável  | Uso                   | Exemplo                 |
| --------- | --------------------- | ----------------------- |
| `API_URL` | URL da api (servidor) | `http://localhost:3333` |

No Docker Compose, a `API_URL` é substituída automaticamente por `http://api:<API_PORT>`.

---

## 8. Testes e cobertura (100%)

```bash
npm test                 # unitários (jsdom)
npm run test:cov         # unitários com cobertura; falha abaixo de 100%
npm run test:storybook   # stories como teste, num Chromium real (render, play functions, a11y)
npm run test:e2e         # Playwright contra a stack rodando (ou make e2e na raiz, que sobe a stack)
```

### 8.1 Como cada tipo de código é testado

| Código                         | Como                                                                                              |
| ------------------------------ | ------------------------------------------------------------------------------------------------- |
| Componentes (servidor/cliente) | `render(<Componente {...props} />)` cobrindo cada estado (vazio, lista, erro, pending)            |
| Containers                     | `vi.mock('../queries/...')` + `render(await Container({ searchParams: Promise.resolve({...}) }))` |
| `page.tsx`                     | `vi.mock('@/features/<x>')`: a página só compõe; a feature tem testes próprios                    |
| `layout.tsx`                   | chama a função e valida a árvore (não dá para renderizar `<html>` dentro do container)            |
| Queries e actions              | **MSW** simulando a api (sucesso, 409, 500); `vi.mock('next/cache')` para o `refresh()`           |
| Schemas e `lib/`               | unitário puro                                                                                     |

- O MSW roda com `onUnhandledFrame: 'error'`: uma chamada à api sem handler **falha o teste**.
- Nos testes, a `API_URL` é `http://api.test` (ver `test/setup.ts`), e o `server-only` é substituído por um stub (ver `vitest.config.ts`).
- `test-fixtures.ts` da feature (`makeExample`, `makeMeta`) é compartilhado por testes e stories.

### 8.2 O que fica fora da medição

Lista fechada no `vitest.config.ts`: specs, stories e arquivos só de tipos (`*.types.ts`). Comentários de ignore são proibidos.

As stories rodam como teste no project `storybook`, mas **não entram na conta dos 100%**: a cobertura vem dos testes unitários.

### 8.3 E2E

- Specs em `e2e/*.spec.ts`, Page Objects em `e2e/pages/`. Os testes usam os textos do `dictionary`.
- Rodam contra a stack completa: `make e2e` na raiz sobe a stack e roda os testes.
- Registros criados pelos testes usam o prefixo `e2e-web-` e são apagados via api no `afterAll`.
- Variáveis: `E2E_BASE_URL` (padrão `http://localhost:3000`) e `E2E_API_URL` (padrão `http://localhost:3333`).

---

## 9. Storybook

```bash
npm run storybook          # http://localhost:6006
npm run build-storybook    # site estático em storybook-static/
```

| Regra                | Detalhe                                                                                               |
| -------------------- | ----------------------------------------------------------------------------------------------------- |
| Story obrigatória    | Todo componente de `components/ui` e `features/*/components` (checado no lint)                        |
| Autodocs             | Ativo para todas as stories (`tags: ['autodocs']` no `preview.ts`); as props vêm dos tipos e do JSDoc |
| Uma story por estado | Padrão, vazio, erro, pending, variações de props                                                      |
| Interações           | Client Components têm `play` functions (ex.: preencher e enviar o formulário)                         |
| Server Actions       | Chegam por props: na story, passe um `fn()` que devolve o estado desejado                             |
| Acessibilidade       | `a11y: { test: 'error' }`: violação de acessibilidade **falha** o teste da story                      |
| Títulos              | `UI/<Componente>` para `components/ui`, `<Feature>/<Componente>` para features                        |

> **Limitação conhecida:** o mock de App Router do `@storybook/nextjs-vite` quebra com esta versão do Next (erro em `RedirectBoundary`/`useRouter`). Por isso o `preview.ts` usa `nextjs: { appDirectory: false }`. Os componentes atuais só usam `next/link`, que funciona assim. Um componente que use hooks de `next/navigation` (`useRouter`, `usePathname`) vai precisar de mock próprio na story até o Storybook corrigir.

---

## 10. Desenvolvendo sem a api

O Compose tem uma api fake gerada do OpenAPI (Prism), que responde com os exemplos do Swagger e valida as requisições:

```bash
npm run generate                              # na raiz: gera o apps/api/openapi.json
docker compose --profile mock up mock-api     # http://localhost:4010
API_URL=http://localhost:4010 npm run dev     # em apps/web
```

---

## 11. Docker

O build parte da **raiz** do monorepo:

```bash
docker build -f apps/web/Dockerfile --target production -t web .
```

| Estágio      | O que faz                                                                                                     |
| ------------ | ------------------------------------------------------------------------------------------------------------- |
| `pruner`     | `turbo prune web api --docker`. A `api` entra porque o build do web depende dos tipos gerados do OpenAPI dela |
| `deps`       | `npm ci`                                                                                                      |
| `dev`        | usado pelo Compose: `next dev`                                                                                |
| `builder`    | `turbo run build --filter=web` (build da api → export do OpenAPI → tipos → `next build`)                      |
| `production` | só o `.next/standalone` + estáticos; `node apps/web/server.js`, usuário `node`                                |

---

## 12. Iniciando um projeto novo a partir da base

1. Remova a feature de exemplo:
   - `src/features/examples/`;
   - `src/app/examples/`;
   - o redirect em `src/app/page.tsx` (troque pela sua página inicial);
   - `e2e/examples.spec.ts` e `e2e/pages/examples.page.ts`.
2. Troque o título no `metadata` de `src/app/layout.tsx`.
3. Crie as features seguindo a [seção 13](#13-checklist-criando-uma-feature-nova).

---

## 13. Checklist: criando uma feature nova

1. **Contrato**: confirme que os endpoints existem na `api` e rode `npm run generate` na raiz.
2. **Pasta**: `src/features/<feature>/` com `containers/`, `components/`, `queries/`, `actions/` e `schemas/`, conforme o que a feature precisa.
3. **Tipos e textos**: crie `<feature>.types.ts` (aliases de `Schemas[...]`) e `<feature>.dictionary.ts`.
4. **Leitura**: crie a função em `queries/` (com `import 'server-only'`) usando `getApi()`.
5. **Componentes**: crie componentes síncronos, só com props. O que precisar de interatividade vira `.client.tsx`, com `'use client'`.
6. **Container**: crie um componente async que lê a URL, chama a query e renderiza os componentes.
7. **Escrita**: crie uma Server Action em `actions/` com validação zod e tratamento dos erros da api. Ela chega ao formulário por props.
8. **API pública**: exporte em `index.ts` o que `app/` usa, e em `client.ts` o que for seguro no navegador.
9. **Rota**: crie `app/<rota>/page.tsx` compondo a feature, com o container dentro de `<Suspense>`, mais o `error.tsx`.
10. **Testes**: um `.spec` ao lado de cada arquivo, mantendo a cobertura em 100%.
11. **Stories**: uma story por componente, cobrindo cada estado.
12. **E2E**: pelo menos o fluxo principal, com Page Object.
13. **Validação final**: `make gate` na raiz (e `make e2e` para os fluxos no navegador).

---

## 14. Decisões

Por que o web é como é. Ao mudar uma destas decisões, atualize esta tabela.

| Decisão                                                          | Alternativas consideradas                                  | Motivo                                                                                                                                                                            |
| ---------------------------------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Cache Components + Partial Prefetching**                       | modelo de cache anterior do Next                           | É o padrão atual do `create-next-app`. O que não depende da requisição vira shell estático, e o resto é renderizado no servidor por streaming. Continua SSR-first                 |
| O navegador **não chama a api**                                  | `NEXT_PUBLIC_API_URL` + fetch no cliente; TanStack Query   | Dispensa CORS em produção, mantém tokens e a URL da api no servidor e fica alinhado ao SSR-first. TanStack Query só entra se uma tela precisar de muita interatividade no cliente |
| **`refresh()`** após escrita                                     | `revalidatePath` / `revalidateTag`                         | A lista não usa cache: basta o navegador buscar a página de novo                                                                                                                  |
| Duas entradas públicas por feature: **`index.ts` e `client.ts`** | só `index.ts`                                              | Client Components (ex.: `error.tsx`) não podem importar o `index.ts`, que puxa código server-only                                                                                 |
| **Server Actions por props** nos componentes                     | importar a action no componente                            | Testes e Storybook passam uma função fake. O lint proíbe componentes de importar `actions/`                                                                                       |
| Separar **`containers/`** de **`components/`**                   | um componente async que busca e renderiza                  | O Vitest não renderiza Server Components async, e componentes só com props são documentáveis no Storybook sem mock de rede                                                        |
| Mappers **só quando necessário**                                 | camadas domain/presentation/use cases (Clean Architecture) | A regra de negócio fica na api. No front, essas camadas só repassariam chamadas, e os tipos gerados do OpenAPI já são o model da tela                                             |
| **Tailwind + shadcn/ui**                                         | lib de componentes como dependência; CSS Modules           | Os componentes ficam no código, então dá para testar a 100% e documentar no Storybook                                                                                             |
| shadcn em **`devDependencies`**                                  | `dependencies` (o padrão do `shadcn init`)                 | A CLI só é usada no build (CSS). Assim ela e as dependências dela não contam como produção                                                                                        |
| **Fontes do sistema**                                            | `next/font/google`                                         | O build (Docker/CI) não depende de download externo                                                                                                                               |
| Prism via **imagem Docker** (perfil `mock`)                      | pacote npm `@stoplight/prism-cli`                          | O pacote exige Node ≥ 24.18. A imagem não depende do Node local. Roda com `--multiprocess=false`, porque o modo multiprocesso da imagem quebra                                    |
| Storybook com **`appDirectory: false`**                          | mock de App Router do `@storybook/nextjs-vite`             | O mock quebra com esta versão do Next (ver [seção 9](#9-storybook))                                                                                                               |
| Stories **fora** da conta dos 100%                               | somar a cobertura do browser mode                          | As stories rodam como teste (render, `play` e a11y), mas os 100% vêm dos testes unitários, que são mais rápidos e determinísticos                                                 |
| **oxlint** para as fronteiras de import                          | ESLint + `eslint-plugin-boundaries`                        | O oxlint cobriu todas as regras com `no-restricted-imports` + `overrides`                                                                                                         |
| **Vitest 4**                                                     | Vitest 5                                                   | Mesma versão da api (uma só no monorepo)                                                                                                                                          |
| Autenticação                                                     | sessão em cookie `httpOnly` lida nas Server Actions        | **Em aberto.** As actions já têm o ponto marcado para checar a sessão                                                                                                             |
