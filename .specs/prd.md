# PRD: Chat em tempo real com webhooks

| Campo         | Valor                                                                                                |
| ------------- | ---------------------------------------------------------------------------------------------------- |
| Projeto       | `web-hook`                                                                                           |
| Status        | Rascunho                                                                                             |
| Atualizado em | 2026-10-14                                                                                           |
| Design        | [.specs/figcraft/index.figcraft](figcraft/index.figcraft)                                            |
| Documentos    | [ARCHITECTURE.md](ARCHITECTURE.md), [api](apps/api/ARCHITECTURE.md), [web](apps/web/ARCHITECTURE.md) |

---

## 1. Contexto e objetivo

Este projeto é um estudo de **comunicação orientada a eventos**. O produto é um chat simples: a pessoa entra só digitando um nome (sem cadastro nem senha) e conversa numa sala única com quem estiver online.

O objetivo do estudo é entregar as mensagens **por push, sem polling**: ninguém pergunta de tempos em tempos "tem mensagem nova?". Quando algo acontece na api, ela avisa quem precisa saber por **webhook**.

### 1.1 Metas

| #   | Meta                                                                                                |
| --- | --------------------------------------------------------------------------------------------------- |
| M1  | Uma mensagem enviada aparece para todos os participantes em **menos de 1 segundo** (ambiente local) |
| M2  | **Nenhum polling** no navegador nem no web: toda atualização chega por evento                       |
| M3  | Webhooks **assinados, idempotentes e com retentativa**, como num sistema de produção                |
| M4  | Manter as regras da base: npm, 100% de cobertura (api e web), Storybook, SSR-first                  |

### 1.2 Fora de escopo

- Cadastro, login, senha ou qualquer autenticação real.
- Mais de uma sala, mensagens privadas, grupos.
- Editar ou apagar mensagens, anexos, reações, confirmação de leitura.
- Notificações push do sistema operacional.
- Moderação (filtro de palavrões, banimento).
- Rodar o `web` com mais de uma instância (ver [seção 12](#12-riscos-e-limitações)).

---

## 2. Como os webhooks entram no chat

### 2.1 O problema

Um **navegador não recebe webhooks**: webhook é uma requisição HTTP de um servidor para outro servidor, e o navegador não tem uma URL pública para ser chamado. Além disso, a base tem a regra **"o navegador nunca chama a api"** ([web/ARCHITECTURE.md §5](apps/web/ARCHITECTURE.md#5-fluxo-de-dados)).

### 2.2 A solução

O webhook acontece **entre a api e o servidor do Next**. O servidor do Next repassa o evento para os navegadores conectados por **Server-Sent Events (SSE)**, uma conexão HTTP que fica aberta e por onde o servidor empurra eventos.

```
                 (1) Server Action            (2) POST /messages
 Navegador A ─────────────────────► Next ──────────────────────────► api ──► Postgres
                                                                      │
                                      (3) webhook POST /webhooks/chat │  assinado (HMAC)
                                Next ◄────────────────────────────────┘
                                  │
                                  │ (4) hub em memória → evento SSE
            ┌─────────────────────┼─────────────────────┐
            ▼                     ▼                     ▼
       Navegador A           Navegador B           Navegador C
       (EventSource)         (EventSource)         (EventSource)
```

1. A pessoa envia a mensagem. O formulário chama uma **Server Action** do web.
2. A action chama a api (`POST /api/v1/chat/messages`). A api valida e grava no Postgres.
3. Depois de gravar, a api dispara um **webhook** (`message.created`) para o endpoint do web.
4. O web confere a assinatura, responde `204` e publica o evento num **hub em memória**. Cada navegador conectado ao stream SSE recebe o evento e mostra a mensagem.

**Por que não é polling:** o navegador abre **uma** conexão SSE e espera. O servidor só escreve nela quando chega um webhook. O "heartbeat" do SSE (um comentário a cada 25 s) só mantém a conexão viva através de proxies; ele não busca dados.

### 2.3 Alternativas consideradas

| Alternativa                                | Por que não                                                                                                               |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Polling (`setInterval` + `GET /messages`)  | É exatamente o que o estudo quer evitar                                                                                   |
| WebSocket direto entre o navegador e a api | Quebra a regra "o navegador não chama a api" (expõe a URL, exige CORS) e não exercita webhooks                            |
| WebSocket entre o navegador e o Next       | O chat só precisa de servidor → navegador em tempo real; a escrita já é feita por Server Actions. SSE basta e é HTTP puro |
| Redis pub/sub entre a api e o web          | Resolve a escala horizontal, mas troca o webhook por um broker. Fica como evolução ([seção 12](#12-riscos-e-limitações))  |

---

## 3. Usuários e histórias

Há um único tipo de usuário: o **participante**, identificado só pelo nome que digitou.

| #   | Como participante, quero...                                         | Para...                              |
| --- | ------------------------------------------------------------------- | ------------------------------------ |
| H1  | entrar digitando só o meu nome                                      | conversar sem criar conta            |
| H2  | ver as últimas mensagens da sala ao entrar                          | entender a conversa em andamento     |
| H3  | enviar uma mensagem e vê-la na hora                                 | conversar com fluidez                |
| H4  | receber as mensagens dos outros sem recarregar a página             | acompanhar a conversa em tempo real  |
| H5  | ver quando alguém entra ou sai e quantas pessoas estão online       | saber com quem estou falando         |
| H6  | ver quando alguém está digitando                                    | saber que uma resposta vem aí        |
| H7  | sair da sala                                                        | liberar meu nome e encerrar a sessão |
| H8  | alternar entre tema claro e escuro                                  | usar o chat com conforto             |
| H9  | usar o chat no celular, no tablet e no computador                   | conversar de qualquer lugar          |
| H10 | continuar recebendo mensagens depois de uma queda rápida de conexão | não perder nada da conversa          |

---

## 4. Requisitos funcionais

Prioridade: **Must** (sem isso não há MVP), **Should** (importante, entra logo depois), **Could** (se der tempo).

### 4.1 Entrar

| #     | Requisito                                                                                                                                     | Prioridade |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| RF-01 | A tela **Entrar** (`/`) tem um único campo, "Seu nome", e o botão "Entrar no chat"                                                            | Must       |
| RF-02 | O nome tem de **2 a 20 caracteres** depois do `trim`; aceita letras (com acento), números, espaço, `-`, `_` e `.`                             | Must       |
| RF-03 | O nome é **único entre os participantes online**, sem diferenciar maiúsculas e minúsculas. Em conflito: "Esse nome já está em uso na sala."   | Must       |
| RF-04 | Ao entrar, a api cria o participante e devolve `id` e um `token` opaco. O web guarda os dois num cookie `httpOnly` e redireciona para `/chat` | Must       |
| RF-05 | Quem já tem sessão válida e abre `/` é redirecionado para `/chat`. Quem abre `/chat` sem sessão volta para `/`                                | Must       |
| RF-06 | A entrada gera uma mensagem de sistema "**{nome} entrou no chat**" para todos                                                                 | Must       |

### 4.2 Sala

| #     | Requisito                                                                                                                                          | Prioridade |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| RF-07 | O cabeçalho mostra "Sala geral", o número de pessoas online, o avatar (inicial do nome) e o nome do participante, o botão de tema e o botão "Sair" | Must       |
| RF-08 | Ao abrir `/chat`, as **últimas 50 mensagens** são renderizadas **no servidor** (SSR), em ordem cronológica, com a lista rolada até o fim           | Must       |
| RF-09 | Mensagens dos outros ficam à esquerda (avatar, nome, hora, balão neutro). As próprias ficam à direita ("Você", hora, balão na cor da marca)        | Must       |
| RF-10 | Mensagens de sistema (entrou/saiu) aparecem centralizadas, em texto discreto                                                                       | Must       |
| RF-11 | "Carregar mensagens anteriores" busca as 50 anteriores (paginação por cursor)                                                                      | Could      |

### 4.3 Enviar e receber

| #     | Requisito                                                                                                                       | Prioridade |
| ----- | ------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| RF-12 | O campo "Escreva uma mensagem…" envia com **Enter** ou com o botão "Enviar". Mensagem vazia (depois do `trim`) não é enviada    | Must       |
| RF-13 | A mensagem tem no máximo **1000 caracteres** e é texto puro (nunca interpretada como HTML)                                      | Must       |
| RF-14 | Mensagens novas chegam por **SSE**, sem recarregar a página e **sem polling**                                                   | Must       |
| RF-15 | A lista rola sozinha para a mensagem nova **se** a pessoa já estava no fim. Se ela rolou para cima, aparece "Novas mensagens ↓" | Should     |
| RF-16 | A própria mensagem aparece na hora (**otimista**), com estado "enviando"; se falhar, mostra "Não enviada · Tentar de novo"      | Should     |
| RF-17 | A mensagem otimista e a que chega pelo SSE não duplicam (casadas pelo `clientId` gerado no envio)                               | Should     |

### 4.4 Presença

| #     | Requisito                                                                                                                                                                 | Prioridade |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| RF-18 | O contador "N pessoas online" atualiza em tempo real a cada entrada e saída                                                                                               | Must       |
| RF-19 | "Sair" encerra a sessão: a api marca o participante como saído, o web apaga o cookie, redireciona para `/` e todos veem "**{nome}** saiu do chat"                         | Must       |
| RF-20 | Fechar a aba também conta como saída: quando a última conexão SSE do participante cai, o web espera **30 s** (tempo de um F5 ou de uma troca de rede) e então avisa a api | Should     |
| RF-21 | "**{nome}** está digitando…" aparece para os outros enquanto alguém digita e some 5 s depois da última tecla ou ao enviar                                                 | Could      |

### 4.5 Reconexão

| #     | Requisito                                                                                                                             | Prioridade |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| RF-22 | Se a conexão SSE cair, o navegador reconecta sozinho (comportamento nativo do `EventSource`)                                          | Must       |
| RF-23 | Na reconexão, o web usa o `Last-Event-ID` para buscar na api as mensagens perdidas (`after=<seq>`) e as envia antes dos eventos novos | Should     |
| RF-24 | Enquanto estiver desconectado, um aviso discreto "Reconectando…" aparece acima do campo de mensagem                                   | Should     |

### 4.6 Tema e responsividade

| #     | Requisito                                                                                                                                                                                                    | Prioridade |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| RF-25 | Temas **claro** e **escuro**. Sem escolha salva, segue o sistema (`prefers-color-scheme`)                                                                                                                    | Must       |
| RF-26 | O botão de tema (lua no claro, sol no escuro) alterna e salva a escolha num cookie `theme`. Um script inline no `<head>` aplica o cookie antes da primeira pintura, então a página **não pisca** ao carregar | Must       |
| RF-27 | Layout responsivo em três faixas: **mobile** (< 768 px), **tablet** (768–1279 px) e **desktop** (≥ 1280 px), como no design ([seção 8](#8-design))                                                           | Must       |

---

## 5. Requisitos não funcionais

| #      | Requisito                                                                                                                                                        |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RNF-01 | **Regras da base** ([ARCHITECTURE.md §1](ARCHITECTURE.md#1-requisitos)): npm, 100% de cobertura na api e no web, Storybook, SSR-first                            |
| RNF-02 | **O navegador não chama a api.** Ele fala só com o Next (páginas, Server Actions e o stream SSE)                                                                 |
| RNF-03 | **Latência:** do envio até aparecer nos outros navegadores, p95 < 1 s em ambiente local                                                                          |
| RNF-04 | **Webhooks seguros:** assinados com HMAC-SHA256, com janela de tempo contra replay e idempotentes ([seção 6.3](#63-webhook-api--web))                            |
| RNF-05 | **Webhooks confiáveis:** retentativa com backoff exponencial e registro de cada entrega no banco                                                                 |
| RNF-06 | **Limite de envio:** no máximo 5 mensagens a cada 10 s por participante (`429` acima disso, com aviso na tela)                                                   |
| RNF-07 | **Acessibilidade:** contraste AA nos dois temas; lista de mensagens com `aria-live="polite"`; tudo operável por teclado; foco visível. As stories passam no a11y |
| RNF-08 | **Segurança:** texto das mensagens sempre escapado (nada de `dangerouslySetInnerHTML`); token do participante só no cookie `httpOnly`, `SameSite=Lax`            |
| RNF-09 | **Textos** em português, nos `dictionary` da feature                                                                                                             |

---

## 6. Contratos

### 6.1 Endpoints da api

Todos sob `/api/v1/chat`, documentados no Swagger (fonte do `@repo/api-client`). As rotas que agem em nome de um participante exigem o header `X-Participant-Token`.

| Método e rota                  | Corpo / parâmetros                   | Resposta                               | Erros                                  |
| ------------------------------ | ------------------------------------ | -------------------------------------- | -------------------------------------- |
| `POST /participants`           | `{ name }`                           | `201 { id, name, token, joinedAt }`    | `400` nome inválido, `409` nome em uso |
| `GET /participants/online`     | —                                    | `200 { items: [{ id, name }], total }` | —                                      |
| `POST /participants/:id/leave` | — (token)                            | `204`                                  | `401` token inválido, `404`            |
| `POST /messages`               | `{ content, clientId }` (token)      | `201 MessageResponseDto`               | `400`, `401`, `429`                    |
| `GET /messages`                | `?limit=50&before=<seq>&after=<seq>` | `200 { items: MessageResponseDto[] }`  | `400`                                  |
| `POST /typing` _(Could)_       | — (token)                            | `204`                                  | `401`                                  |

`MessageResponseDto`:

```json
{
  "id": "uuid",
  "seq": 1042,
  "type": "USER | JOINED | LEFT",
  "content": "E aí, galera!",
  "clientId": "uuid gerado no navegador ou null",
  "author": { "id": "uuid", "name": "Bruno" },
  "createdAt": "2026-10-14T14:31:00.000Z"
}
```

- `seq` é um número crescente gerado pelo banco. Ele dá a **ordem** das mensagens e serve de **cursor** (`before`/`after`), inclusive na reconexão.
- Mensagens de sistema (`JOINED`, `LEFT`) são linhas da mesma tabela, com `content` vazio. O texto é montado no web a partir do `type` e do `author.name`.

### 6.2 Sessão (web)

| Cookie         | Conteúdo                  | Atributos                                                                                  |
| -------------- | ------------------------- | ------------------------------------------------------------------------------------------ |
| `chat_session` | `participantId` e `token` | `httpOnly`, `Secure` em produção, `SameSite=Lax`, sem expiração fixa (sessão do navegador) |
| `theme`        | `light` ou `dark`         | legível no servidor; 1 ano                                                                 |

### 6.3 Webhook (api → web)

O formato segue a especificação **[Standard Webhooks](https://www.standardwebhooks.com/)**.

**Destino:** `POST {WEBHOOK_TARGET_URL}`, por padrão `http://localhost:3000/webhooks/chat`.

**Headers:**

| Header              | Valor                                                                     |
| ------------------- | ------------------------------------------------------------------------- |
| `webhook-id`        | id único do evento (uuid). Igual em todas as retentativas do mesmo evento |
| `webhook-timestamp` | segundos desde a epoch, no momento do envio                               |
| `webhook-signature` | `v1,<base64(HMAC-SHA256(secret, "{id}.{timestamp}.{corpo}"))>`            |
| `content-type`      | `application/json`                                                        |

**Corpo (envelope):**

```json
{
  "type": "message.created",
  "occurredAt": "2026-10-14T14:31:00.000Z",
  "data": { "...": "MessageResponseDto ou dados do evento" }
}
```

| Evento             | Quando                                              | `data`                          |
| ------------------ | --------------------------------------------------- | ------------------------------- |
| `message.created`  | uma mensagem (de usuário ou de sistema) foi gravada | `MessageResponseDto`            |
| `presence.changed` | alguém entrou ou saiu                               | `{ online: number }`            |
| `typing.started`   | alguém está digitando _(Could)_                     | `{ participant: { id, name } }` |

**Regras do receptor (web):**

1. Lê o corpo **cru** (a assinatura é sobre os bytes exatos) e confere a assinatura com comparação de tempo constante. Assinatura inválida → `401`.
2. Recusa `webhook-timestamp` com mais de **5 minutos** de diferença → `401` (proteção contra replay).
3. Ignora um `webhook-id` já processado (cache em memória dos últimos ids) e responde `204` mesmo assim: a entrega é idempotente.
4. Publica no hub e responde **`204` imediatamente**. Nada lento acontece antes da resposta.

**Regras do emissor (api):**

1. O webhook é disparado **depois** que a transação no banco foi confirmada, fora do caminho da requisição (a resposta do `POST /messages` não espera o webhook).
2. Resposta `2xx` = entregue. Qualquer outra coisa, ou timeout de 5 s, = falha.
3. Retentativas com backoff exponencial: **1 s, 5 s, 30 s, 2 min, 10 min**. Depois disso, a entrega fica como `FAILED`.
4. Cada tentativa é registrada na tabela `webhook_deliveries` (status, código HTTP, duração, número da tentativa), para depurar e para o estudo.

### 6.4 Stream SSE (web → navegador)

**Rota:** `GET /chat/stream` (route handler do Next), autenticada pelo cookie `chat_session`. Sem sessão → `401`.

```
id: 1042
event: message
data: {"id":"…","seq":1042,"type":"USER","content":"E aí, galera!",…}

event: presence
data: {"online":8}

: heartbeat
```

| Evento SSE | Origem                               | `id:`               |
| ---------- | ------------------------------------ | ------------------- |
| `message`  | webhook `message.created`            | o `seq` da mensagem |
| `presence` | webhook `presence.changed`           | —                   |
| `typing`   | webhook `typing.started` _(Could)_   | —                   |
| heartbeat  | comentário `: heartbeat` a cada 25 s | —                   |

- O `id:` dos eventos `message` é o `seq`. Na reconexão, o navegador manda `Last-Event-ID` automaticamente, e o web busca na api `GET /messages?after=<seq>` antes de voltar a repassar eventos ao vivo (RF-23).
- Ao abrir o stream, o web registra a conexão do participante no hub. Ao fechar, remove. Quando o participante fica sem conexões por 30 s, o web chama `POST /participants/:id/leave` (RF-20).

---

## 7. Modelo de dados (api)

Substitui o model de referência `Example` (ver [decisão em aberto D1](#13-decisões-em-aberto)).

```prisma
model Participant {
  id        String    @id @default(uuid())
  name      String
  tokenHash String    @map("token_hash")
  joinedAt  DateTime  @default(now()) @map("joined_at")
  leftAt    DateTime? @map("left_at")
  messages  Message[]

  @@index([leftAt])
  @@map("participants")
}

enum MessageType {
  USER
  JOINED
  LEFT
}

model Message {
  id            String      @id @default(uuid())
  seq           BigInt      @unique @default(autoincrement())
  type          MessageType @default(USER)
  content       String      @default("") @db.VarChar(1000)
  clientId      String?     @map("client_id")
  participantId String      @map("participant_id")
  participant   Participant @relation(fields: [participantId], references: [id])
  createdAt     DateTime    @default(now()) @map("created_at")

  @@map("messages")
}

enum WebhookDeliveryStatus {
  PENDING
  SUCCEEDED
  FAILED
}

model WebhookDelivery {
  id         String                @id @default(uuid())
  eventId    String                @map("event_id")
  eventType  String                @map("event_type")
  payload    Json
  status     WebhookDeliveryStatus @default(PENDING)
  attempts   Int                   @default(0)
  lastStatus Int?                  @map("last_status")
  lastError  String?               @map("last_error")
  createdAt  DateTime              @default(now()) @map("created_at")
  updatedAt  DateTime              @updatedAt @map("updated_at")

  @@index([status])
  @@map("webhook_deliveries")
}
```

- **Online** = participante com `leftAt` nulo. A unicidade do nome (RF-03) é checada só entre eles, sem diferenciar maiúsculas.
- O **token** é guardado só como hash; o valor puro sai uma única vez, na resposta do `POST /participants`.
- Mensagens não expiram nesta versão.

---

## 8. Design

O design está em [.specs/figcraft/index.figcraft](figcraft/index.figcraft), página **Chat**: 12 frames = 2 telas × 3 tamanhos × 2 temas, nomeados `Tela · Tamanho · Tema`.

### 8.1 Telas e faixas

| Tela   | Rota    | Desktop (1440)                   | Tablet (768)                          | Mobile (390)                                           |
| ------ | ------- | -------------------------------- | ------------------------------------- | ------------------------------------------------------ |
| Entrar | `/`     | cartão de 420 px centralizado    | igual ao desktop                      | cartão na largura toda, título menor                   |
| Sala   | `/chat` | conversa em coluna de até 800 px | coluna na largura útil, menos padding | cabeçalho sem o nome (só avatar); balões quebram linha |

Em todas as faixas, a Sala tem cabeçalho fixo no topo, lista de mensagens rolável e campo de mensagem fixo embaixo. As mensagens começam de baixo para cima.

### 8.2 Tokens de cor

As cores vêm da coleção de variáveis **Tema** do FigCraft (modos Light e Dark). No web, viram variáveis CSS no `globals.css`, em `:root` (claro), `[data-theme="dark"]` (escuro) e `:root:not([data-theme])` sob `prefers-color-scheme: dark`, ligadas ao tema do Tailwind/shadcn. Dá para exportar direto do FigCraft (`variable.export` em CSS).

| Token            | Light       | Dark        | Uso                                       |
| ---------------- | ----------- | ----------- | ----------------------------------------- |
| `bg/page`        | `#F4F6FB`   | `#0B1020`   | fundo das telas                           |
| `bg/surface`     | `#FFFFFF`   | `#151B2E`   | cartão, cabeçalho, barra de envio, balões |
| `bg/subtle`      | `#F9FAFB`   | `#1C2438`   | campo de mensagem                         |
| `border/default` | `#E5E7EB`   | `#2A3350`   | bordas e divisórias                       |
| `text/primary`   | `#111827`   | `#F3F4F6`   | texto principal                           |
| `text/secondary` | `#687080`   | `#9CA3AF`   | autor e hora, textos de apoio             |
| `text/muted`     | `#68707F`   | `#7C8597`   | mensagens de sistema, placeholder         |
| `text/button`    | `#374151`   | `#D1D5DB`   | botões secundários e ícones               |
| `brand/default`  | `#4F46E5`   | `#5B5EF0`   | botões, balão próprio, avatar próprio     |
| `brand/soft`     | `#EEF2FF`   | `#1E1B4B`   | fundo do ícone da sala                    |
| `brand/text`     | `#4F46E5`   | `#A5B4FC`   | ícone da sala                             |
| `brand/ring`     | `#4F46E526` | `#6366F14D` | anel de foco                              |
| `text/on-brand`  | `#FFFFFF`   | `#FFFFFF`   | texto sobre a cor da marca                |
| `status/online`  | `#10B981`   | `#34D399`   | ponto "online"                            |
| `shadow/card`    | `#1118270F` | `#00000066` | sombra do cartão de entrada               |

Os avatares dos outros participantes usam pares de fundo e texto (`avatar/*-bg`, `avatar/*-fg`). A cor é escolhida de forma estável a partir do `id` do participante, para a mesma pessoa ter sempre a mesma cor.

| Token             | Light     | Dark      |
| ----------------- | --------- | --------- |
| `avatar/pink-bg`  | `#FCE7F3` | `#500724` |
| `avatar/pink-fg`  | `#BE185D` | `#F9A8D4` |
| `avatar/green-bg` | `#DCFCE7` | `#052E16` |
| `avatar/green-fg` | `#15803D` | `#86EFAC` |

`text/secondary` (claro), `text/muted` (claro e escuro) e `brand/default` (escuro) foram ajustados em relação ao FigCraft para passar no contraste AA (RNF-07). O FigCraft precisa receber os mesmos valores.

---

## 9. Onde o código fica

Segue a estrutura da base. Nada aqui muda as regras dos `ARCHITECTURE.md`; se uma decisão nova surgir, ela entra na tabela "Decisões" do app.

### 9.1 api

```
apps/api/src/modules/
├── chat/
│   ├── controllers/      # ParticipantsController, MessagesController (+ typing)
│   ├── services/         # ParticipantsService, MessagesService
│   ├── repositories/     # contratos (classes abstratas) + implementações Prisma
│   ├── dtos/request|response/
│   ├── mappers/          # MessageMapper, ParticipantMapper
│   ├── guards/           # ParticipantTokenGuard (X-Participant-Token)
│   └── chat.module.ts    # importa WebhooksModule
└── webhooks/
    ├── services/         # WebhookDispatcher: assina, envia, agenda retentativas
    ├── repositories/     # WebhookDeliveryRepository
    ├── signing/          # assinatura Standard Webhooks (função pura)
    └── webhooks.module.ts  # exporta o WebhookDispatcher
```

O `chat` não sabe para onde o evento vai: só chama `webhookDispatcher.dispatch(type, data)`.

### 9.2 web

```
apps/web/src/
├── app/
│   ├── page.tsx                    # Entrar
│   ├── chat/page.tsx               # Sala
│   ├── chat/stream/route.ts        # GET: stream SSE (só delega para a feature)
│   └── webhooks/chat/route.ts      # POST: receptor do webhook (só delega para a feature)
├── features/chat/
│   ├── containers/                 # ChatRoomContainer (histórico + online, no servidor)
│   ├── components/                 # JoinForm.client, MessageList, MessageBubble, SystemMessage,
│   │                               # Composer.client, ChatHeader, OnlineBadge, TypingIndicator,
│   │                               # ChatStream.client (EventSource → estado da lista)
│   ├── queries/                    # getMessages, getOnline (server-only)
│   ├── actions/                    # join, sendMessage, leave, notifyTyping
│   ├── realtime/                   # hub em memória, verificação do webhook, formatação SSE
│   ├── session/                    # ler e gravar o cookie chat_session (server-only)
│   ├── schemas/                    # zod: nome, mensagem, envelope do webhook
│   ├── chat.dictionary.ts
│   ├── chat.types.ts
│   └── test-fixtures.ts            # makeMessage(), makeParticipant()
└── components/ui/
    ├── Avatar, ThemeToggle.client  # genéricos, reaproveitáveis
```

- `ChatStream.client.tsx` é o único componente que abre o `EventSource`. Ele recebe as mensagens iniciais por props (vindas do SSR) e acrescenta as que chegam pelo stream.
- `realtime/` é **server-only**: o hub vive no processo do Next.

### 9.3 Variáveis de ambiente novas

| App | Variável             | Exemplo                                 | Uso                                                     |
| --- | -------------------- | --------------------------------------- | ------------------------------------------------------- |
| api | `WEBHOOK_TARGET_URL` | `http://localhost:3000/webhooks/chat`   | destino dos webhooks. No Compose: `http://web:3000/...` |
| api | `WEBHOOK_SECRET`     | `whsec_<base64 de 32 bytes aleatórios>` | assinatura                                              |
| web | `WEBHOOK_SECRET`     | o mesmo da api                          | verificação                                             |

Ambas validadas com zod, como as demais. O `make install` gera um segredo aleatório e grava o mesmo valor nos dois `.env`.

---

## 10. Testes e qualidade

Vale tudo o que a base já exige (100% de cobertura, stories com a11y, `make gate` e `make e2e` no CI). Específico do chat:

| Onde                     | O que testar                                                                                                                                                                        |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| api: `webhooks/signing`  | assinatura bate com os vetores de teste da especificação Standard Webhooks                                                                                                          |
| api: `WebhookDispatcher` | sucesso na 1ª tentativa; falha → agenda o backoff certo; desiste após a 5ª; timeout; registra cada tentativa (relógio e HTTP falsos)                                                |
| api: services            | nome duplicado (sem diferenciar maiúsculas) → `409`; entrar/sair geram mensagem de sistema e `presence.changed`; limite de envio → `429`                                            |
| api: e2e                 | `POST /messages` grava e dispara o webhook para um servidor HTTP de teste, com assinatura válida                                                                                    |
| web: `realtime/`         | assinatura inválida → `401`; timestamp velho → `401`; id repetido → ignorado; hub entrega a todos os inscritos e remove quem desconectou; saída após 30 s                           |
| web: `ChatStream`        | acrescenta mensagens recebidas; não duplica a otimista; mostra "Reconectando…" (`EventSource` falso)                                                                                |
| web: Storybook           | uma story por estado: lista vazia, longa, mensagens próprias e dos outros, sistema, digitando, erro de envio, nome em uso; **claro e escuro**; mobile, tablet e desktop (viewports) |
| E2E (Playwright)         | **dois contextos de navegador**: A e B entram; A envia e B recebe sem recarregar; B sai e A vê "saiu do chat" e o contador cair; tema persiste após recarregar                      |

---

## 11. Fases de entrega

Cada fase termina com `make gate` e `make e2e` verdes.

| Fase | Entrega                                                                                                                      | Requisitos                                 |
| ---- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| F0   | Tokens de cor e tema claro/escuro no web (cookie + `ThemeToggle`); componentes visuais da Sala no Storybook, com dados fixos | RF-25, RF-26, RF-27                        |
| F1   | Entrar e sair (sem tempo real); histórico via SSR; enviar mensagem com `refresh()`                                           | RF-01 a RF-13, RF-19                       |
| F2   | **Webhooks**: dispatcher com assinatura e retentativa na api; receptor, hub e stream SSE no web                              | RF-14, RF-18, RF-22, RNF-04, RNF-05        |
| F3   | Robustez: reconexão com `Last-Event-ID`, saída por desconexão, envio otimista, "Novas mensagens ↓", limite de envio          | RF-15 a RF-17, RF-20, RF-23, RF-24, RNF-06 |
| F4   | Extras: "está digitando", carregar mensagens anteriores                                                                      | RF-11, RF-21                               |

A F1 propositalmente já funciona como chat (recarregando a página). Assim a F2 isola só o que muda ao trocar a atualização manual pelos webhooks, que é o ponto do estudo.

---

## 12. Riscos e limitações

| Risco                                                                                                                                                   | Mitigação                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **O hub vive na memória do processo do Next.** Com 2+ instâncias do web, cada uma só conhece os próprios navegadores, e o webhook chega em só uma delas | Nesta versão o web roda com **uma instância**. Evolução: o receptor publica num Redis pub/sub, e cada instância repassa aos seus navegadores            |
| O webhook sai **depois** da gravação, fora da transação. Se a api cair entre gravar e enviar, o evento se perde                                         | A reconexão com `after=<seq>` recupera mensagens perdidas. Evolução: **transactional outbox** (o evento é gravado na mesma transação e um worker envia) |
| Proxies e load balancers encerram conexões ociosas ou guardam a resposta em buffer                                                                      | Heartbeat a cada 25 s; header `X-Accel-Buffering: no`; `Cache-Control: no-cache`                                                                        |
| Next com Cache Components tentar pré-renderizar o stream                                                                                                | O route handler do SSE é dinâmico (lê cookies) e não é cacheado. Validar na F2 com o build de produção                                                  |
| Cada aba aberta é uma conexão SSE no servidor                                                                                                           | Aceitável para o estudo. Medir o consumo com 100 conexões na F3                                                                                         |
| Nome de outra pessoa "sequestrado" depois que ela sai                                                                                                   | Esperado, já que não há login. O nome só é reservado enquanto o participante está online                                                                |

---

## 13. Decisões em aberto

| #   | Pergunta                                                                                                         | Proposta                                                                                          |
| --- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| D1  | Remover o módulo e a feature `examples` da base?                                                                 | Sim, na F1, junto com a migration que cria as tabelas do chat                                     |
| D2  | Por quanto tempo guardar as mensagens?                                                                           | Sem limite nesta versão; rever se o banco crescer                                                 |
| D3  | Mostrar a lista de quem está online (e não só o número)?                                                         | Não no MVP; o endpoint `GET /participants/online` já permite                                      |
| D4  | O destino do webhook vem de variável de ambiente ou de uma tabela de assinaturas (como num produto de webhooks)? | Variável de ambiente (um só assinante: o web). Tabela de assinaturas é uma boa extensão do estudo |
