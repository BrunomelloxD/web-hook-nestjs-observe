# Chat básico: entrar, histórico, enviar e sair (F1) Specification

Origem: [PRD](../../prd.md) §4.1 a §4.3, §6.1, §6.2, §7 e fase F1. Requisitos do PRD cobertos: RF-01 a RF-10, RF-12, RF-13, RF-19, RNF-02, RNF-08, D1.

## Problem Statement

Ainda não existe chat: a base só tem o módulo de referência `examples`. A F1 entrega um chat completo **sem tempo real**: a pessoa entra com um nome, vê o histórico renderizado no servidor, envia mensagens e sai. As mensagens dos outros aparecem ao recarregar. Assim a F2 isola só a troca da atualização manual pelos webhooks.

## Goals

- [ ] Duas pessoas em navegadores diferentes conversam recarregando a página, sem nenhuma chamada do navegador à api
- [ ] Todos os endpoints de §6.1 (menos `POST /typing`) existem, estão no Swagger e no `@repo/api-client`
- [ ] O módulo e a feature `examples` foram removidos, com `make gate` verde e 100% de cobertura

## Out of Scope

| Feature                                                | Reason                       |
| ------------------------------------------------------ | ---------------------------- |
| Mensagens chegando sem recarregar, contador ao vivo    | F2 (`chat-webhooks`)         |
| Envio otimista, rolagem inteligente, limite de envio   | F3 (`chat-resilience`)       |
| Saída por desconexão (30 s)                            | F3 (`chat-resilience`)       |
| "Carregar mensagens anteriores", "digitando"           | F4 (`chat-extras`)           |
| Login, senha, várias salas, editar ou apagar mensagens | Fora de escopo do PRD (§1.2) |

---

## Assumptions & Open Questions

| Assumption / decision                              | Chosen default                                                                                                                                          | Rationale                                                                      | Confirmed? |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ---------- |
| D1: remover `examples`                             | Remover módulo da api, feature e rota do web, seed e model `Example`, na mesma migration que cria as tabelas do chat                                    | Proposta do PRD                                                                | n          |
| Regra exata do nome (RF-02)                        | Depois do `trim`, casa com `^[\p{L}\p{M}0-9 ._-]{2,20}$` (flag `u`); espaços internos ficam como estão                                                  | "Letras com acento" inclui letras Unicode e marcas combinantes                 | n          |
| Unicidade do nome com entradas simultâneas         | Índice único parcial em `lower(name) WHERE left_at IS NULL`, criado em SQL na migration; violação vira `409`                                            | Checar antes de inserir tem corrida; o banco garante                           | n          |
| O que é "sessão válida" (RF-05)                    | Cookie `chat_session` presente **e** o `participantId` está em `GET /participants/online`. Se não estiver, o web apaga o cookie e trata como sem sessão | Não existe endpoint "quem sou eu"; o participante pode ter saído por outra aba | n          |
| Formato e validade do token                        | 32 bytes aleatórios em base64url; guardado como SHA-256 hex; válido enquanto `leftAt` é nulo                                                            | Token opaco, sem expiração própria (PRD §6.2)                                  | n          |
| Token válido de outro participante em `/:id/leave` | `401`                                                                                                                                                   | O token não autoriza agir sobre outro id                                       | n          |
| Sair duas vezes                                    | `POST /participants/:id/leave` de quem já saiu → `401` (token não vale mais); o web apaga o cookie e redireciona mesmo assim                            | Token inválido após a saída; o resultado para a pessoa é o mesmo               | n          |
| Conteúdo gravado                                   | O `content` é gravado depois do `trim`                                                                                                                  | Evita balões com espaços sobrando                                              | n          |
| `clientId` na F1                                   | Opcional (`uuid` ou ausente); o `Composer` já gera um `crypto.randomUUID()` por envio                                                                   | Prepara a F3 sem custo                                                         | n          |
| `limit` de `GET /messages`                         | Inteiro de 1 a 100, padrão 50; `before` e `after` juntos → `400`                                                                                        | Limite superior evita respostas enormes                                        | n          |
| Ordem de `GET /messages`                           | Sempre `seq` crescente. Sem cursor ou com `before`: as `limit` mais recentes antes do cursor. Com `after`: as `limit` primeiras depois do cursor        | O web renderiza em ordem cronológica sem reordenar                             | n          |
| Mensagens de sistema `JOINED`/`LEFT`               | Gravadas na mesma transação que cria o participante ou marca `leftAt`                                                                                   | Nunca existe entrada sem a mensagem de sistema                                 | n          |
| Mensagem de sistema no web                         | `JOINED` → "{nome} entrou no chat"; `LEFT` → "{nome} saiu do chat"                                                                                      | Texto do PRD (RF-06, RF-19)                                                    | n          |
| Após enviar na F1                                  | A action chama `refresh()` (`next/cache`), como o `createExample` da base; o campo é limpo                                                              | PRD fase F1: "enviar mensagem com `refresh()`"                                 | n          |
| Retenção de dados (D2)                             | Mensagens e participantes não expiram                                                                                                                   | Proposta do PRD                                                                | n          |

**Open questions:** none - all resolved or logged above (required before the spec is confirmed).

---

## User Stories

### P1: Entrar com um nome ⭐ MVP

**User Story**: Como participante, quero entrar digitando só o meu nome para conversar sem criar conta.

**Why P1**: Sem entrar não há chat (RF-01 a RF-06).

**Acceptance Criteria**:

1. The tela Entrar (`/`) SHALL ter um único campo rotulado "Seu nome" e o botão "Entrar no chat"
2. IF o nome, depois do `trim`, tem menos de 2 ou mais de 20 caracteres THEN o web SHALL mostrar o erro de validação no campo sem chamar a api
3. IF o nome contém caractere fora de letras, marcas, dígitos, espaço, `-`, `_` e `.` THEN o web SHALL mostrar o erro de validação no campo sem chamar a api
4. IF `POST /participants` recebe nome inválido THEN a api SHALL responder `400`
5. IF já existe participante online com o mesmo nome, sem diferenciar maiúsculas e minúsculas THEN a api SHALL responder `409`
6. WHEN a api responde `409` THEN o web SHALL mostrar "Esse nome já está em uso na sala." no campo
7. WHEN `POST /participants` recebe um nome válido e livre THEN a api SHALL responder `201 { id, name, token, joinedAt }` com o nome depois do `trim`
8. The api SHALL guardar só o hash do token; o token puro SHALL aparecer só na resposta do `POST /participants`
9. WHEN um participante é criado THEN a api SHALL gravar, na mesma transação, uma mensagem `type=JOINED` com `content` vazio e `participantId` do novo participante
10. WHEN a api responde `201` THEN o web SHALL gravar `participantId` e `token` no cookie `chat_session` (`httpOnly`, `SameSite=Lax`, `Secure` em produção, sem `Expires`/`Max-Age`) e redirecionar para `/chat`
11. WHEN quem tem sessão válida abre `/` THEN o web SHALL redirecionar para `/chat`
12. WHEN quem não tem sessão válida abre `/chat` THEN o web SHALL redirecionar para `/`
13. IF o cookie `chat_session` existe mas o participante não está online THEN o web SHALL apagar o cookie e tratar a requisição como sem sessão

**Independent Test**: Entrar como "Ana", ver `/chat` com "Ana entrou no chat"; em outro navegador tentar "ana" e ver "Esse nome já está em uso na sala.".

---

### P1: Ver a sala e o histórico ⭐ MVP

**User Story**: Como participante, quero ver as últimas mensagens da sala ao entrar para entender a conversa em andamento.

**Why P1**: RF-07 a RF-10 são Must.

**Acceptance Criteria**:

1. WHEN `/chat` é aberto com sessão válida THEN o web SHALL renderizar no servidor as últimas 50 mensagens em ordem crescente de `seq`
2. WHEN `/chat` termina de carregar THEN a `MessageList` SHALL estar rolada até a última mensagem
3. The `ChatHeader` SHALL mostrar "Sala geral", "{N} pessoas online" com N igual ao `total` de `GET /participants/online`, o avatar e o nome do participante, o `ThemeToggle` e o botão "Sair"
4. WHEN N é 1 THEN o `ChatHeader` SHALL mostrar "1 pessoa online"
5. The web SHALL renderizar mensagens `USER` cujo `author.id` é o participante da sessão como mensagens próprias, e as demais `USER` como mensagens dos outros
6. The web SHALL renderizar mensagens `JOINED` como "{nome} entrou no chat" e `LEFT` como "{nome} saiu do chat", com `SystemMessage`
7. WHILE a sala não tem mensagens the `MessageList` SHALL mostrar o estado vazio do dicionário
8. WHEN `GET /messages` é chamado sem cursor THEN a api SHALL devolver as `limit` mensagens de maior `seq`, ordenadas por `seq` crescente
9. WHEN `GET /messages` é chamado com `before=<seq>` THEN a api SHALL devolver as `limit` mensagens de maior `seq` menores que o cursor, ordenadas por `seq` crescente
10. WHEN `GET /messages` é chamado com `after=<seq>` THEN a api SHALL devolver as `limit` mensagens de menor `seq` maiores que o cursor, ordenadas por `seq` crescente
11. IF `GET /messages` recebe `before` e `after` juntos, ou `limit` fora de 1 a 100 THEN a api SHALL responder `400`
12. The api SHALL serializar `seq` como número JSON em `MessageResponseDto`
13. IF a api não responde ao carregar `/chat` THEN o web SHALL mostrar a página de erro da rota com a opção de tentar de novo

**Independent Test**: Com 60 mensagens no banco, abrir `/chat` e ver as 50 últimas na ordem certa já no HTML do servidor.

---

### P1: Enviar mensagem ⭐ MVP

**User Story**: Como participante, quero enviar uma mensagem e vê-la na hora para conversar com fluidez.

**Why P1**: RF-12 e RF-13 são Must.

**Acceptance Criteria**:

1. WHEN a pessoa pressiona Enter no campo "Escreva uma mensagem…" THEN o `Composer` SHALL enviar a mensagem
2. WHEN a pessoa pressiona Shift+Enter THEN o `Composer` SHALL inserir uma quebra de linha sem enviar
3. WHEN a pessoa aciona o botão "Enviar" THEN o `Composer` SHALL enviar a mensagem
4. IF o conteúdo, depois do `trim`, está vazio THEN o `Composer` SHALL não enviar e SHALL manter o botão "Enviar" desabilitado
5. IF o conteúdo passa de 1000 caracteres THEN o `Composer` SHALL impedir o envio e mostrar o erro do dicionário
6. WHEN a Server Action `sendMessage` é chamada THEN o web SHALL chamar `POST /api/v1/chat/messages` com `{ content, clientId }` e o header `X-Participant-Token` lido do cookie
7. IF `POST /messages` recebe `content` vazio depois do `trim` ou com mais de 1000 caracteres THEN a api SHALL responder `400`
8. IF `POST /messages` ou `POST /participants/:id/leave` recebe `X-Participant-Token` ausente, desconhecido ou de participante que saiu THEN a api SHALL responder `401`
9. WHEN `POST /messages` é válido THEN a api SHALL gravar a mensagem com `type=USER`, o `content` depois do `trim` e o `participantId` do token, e responder `201 MessageResponseDto`
10. WHEN o envio termina com sucesso THEN o web SHALL limpar o campo e atualizar a lista com a nova mensagem no fim
11. IF a action recebe `401` da api THEN o web SHALL apagar o cookie e redirecionar para `/`
12. The web SHALL nunca renderizar `content` como HTML

**Independent Test**: Enviar "olá" e vê-lo no fim da lista à direita; em outro navegador, recarregar e vê-lo à esquerda.

---

### P1: Sair da sala ⭐ MVP

**User Story**: Como participante, quero sair da sala para liberar meu nome e encerrar a sessão.

**Why P1**: RF-19 é Must.

**Acceptance Criteria**:

1. WHEN a pessoa aciona "Sair" THEN o web SHALL chamar `POST /participants/:id/leave` com o token, apagar o cookie `chat_session` e redirecionar para `/`
2. WHEN a api recebe `POST /participants/:id/leave` com o token do próprio `:id` THEN a api SHALL, numa transação, preencher `leftAt` e gravar uma mensagem `type=LEFT`, e responder `204`
3. IF `:id` não existe THEN a api SHALL responder `404`
4. IF o token pertence a outro participante THEN a api SHALL responder `401`
5. IF a chamada à api falha THEN o web SHALL apagar o cookie e redirecionar para `/` mesmo assim
6. WHEN um participante sai THEN o nome dele SHALL ficar livre para uma nova entrada

**Independent Test**: Ana sai; em outro navegador, recarregar e ver "Ana saiu do chat" e o contador menor; entrar de novo como "Ana" funciona.

---

### P1: O navegador nunca chama a api ⭐ MVP

**User Story**: Como mantenedor, quero que o navegador fale só com o Next para manter a regra da base.

**Why P1**: RNF-02.

**Acceptance Criteria**:

1. The web SHALL chamar a api só de código server-only (queries, Server Actions e route handlers)
2. The web SHALL nunca expor a URL da api nem o token em código enviado ao navegador

**Independent Test**: E2E com Playwright registra as requisições do navegador e confirma que nenhuma vai para o host da api.

---

## Edge Cases

- IF duas pessoas entram com "Ana" e "ANA" ao mesmo tempo THEN a api SHALL criar só uma e responder `409` para a outra
- IF o nome é " Ana " THEN a api SHALL gravar "Ana"
- WHEN o conteúdo tem exatamente 1000 caracteres THEN a api SHALL aceitar
- WHEN o conteúdo tem 1001 caracteres THEN a api SHALL responder `400`
- WHEN o nome tem exatamente 2 ou exatamente 20 caracteres THEN a api SHALL aceitar
- IF `before` não é inteiro positivo THEN a api SHALL responder `400`

---

## Requirement Traceability

| Requirement ID | Story                      | Tasks                                  | Phase | Status   |
| -------------- | -------------------------- | -------------------------------------- | ----- | -------- |
| JOIN-01        | P1: Entrar (AC 1-3)        | T25, T27, T34, T38                     | Tasks | In Tasks |
| JOIN-02        | P1: Entrar (AC 4-9)        | T2, T3, T5, T9, T10, T13, T15          | Tasks | In Tasks |
| JOIN-03        | P1: Entrar (AC 10-13)      | T19, T20, T23, T24, T27, T36, T37, T38 | Tasks | In Tasks |
| ROOM-01        | P1: Sala (AC 1-7, 13)      | T21, T22, T31, T32, T35, T38           | Tasks | In Tasks |
| ROOM-02        | P1: Sala (AC 8-12)         | T6, T8, T9, T11, T14, T15              | Tasks | In Tasks |
| SEND-01        | P1: Enviar (AC 1-5, 10-12) | T26, T28, T30, T32, T38                | Tasks | In Tasks |
| SEND-02        | P1: Enviar (AC 6-9)        | T9, T11, T12, T14, T15, T28            | Tasks | In Tasks |
| LEAVE-01       | P1: Sair (AC 1-6)          | T5, T10, T13, T15, T29, T38            | Tasks | In Tasks |
| BFF-01         | P1: Navegador (AC 1-2)     | T33, T38                               | Tasks | In Tasks |
| CLEAN-01       | D1: remover `examples`     | T1, T2, T17, T34                       | Tasks | In Tasks |

**Coverage:** 10 total, 10 mapped to tasks, 0 unmapped ✅

---

## Success Criteria

- [ ] E2E com dois contextos: A e B entram, A envia, B recarrega e vê a mensagem; B sai e A, ao recarregar, vê "B saiu do chat"
- [ ] Nenhuma requisição do navegador vai para a api
- [ ] `make gate` e `make e2e` verdes
