# Extras: digitando e mensagens anteriores (F4) Specification

Origem: [PRD](../../prd.md) §4.2, §4.4, §6.1 (`POST /typing`), §6.3 (`typing.started`), §6.4 e fase F4. Requisitos do PRD cobertos: RF-11, RF-21.

## Problem Statement

O chat já está completo e robusto, mas a pessoa só vê as últimas 50 mensagens e não sabe quando alguém está respondendo. A F4 adiciona o "está digitando", que exercita um terceiro tipo de evento no fluxo de webhooks, e a paginação para trás pelo cursor `before`.

## Goals

- [ ] O aviso "{nome} está digitando…" aparece para os outros em menos de 1 s depois da primeira tecla
- [ ] Toda mensagem da sala pode ser alcançada pela paginação para trás

## Out of Scope

| Feature                                | Reason                                                             |
| -------------------------------------- | ------------------------------------------------------------------ |
| Lista de quem está online (D3)         | Proposta do PRD: não no MVP                                        |
| Evento "parou de digitar" vindo da api | O aviso some por tempo no navegador (5 s), sem evento extra        |
| Gravar eventos de digitação no banco   | São efêmeros; só o registro de entrega do webhook vai para o banco |

---

## Assumptions & Open Questions

| Assumption / decision                          | Chosen default                                                                                             | Rationale                                                                 | Confirmed? |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ---------- |
| D3: lista de quem está online                  | Não exibir; só o contador                                                                                  | Proposta do PRD                                                           | n          |
| Frequência de `notifyTyping`                   | No máximo uma chamada a cada 3 s por participante, enquanto há teclas no campo                             | Com o aviso durando 5 s, 3 s mantém o aviso contínuo sem inundar a api    | n          |
| Limite de `POST /typing` na api                | Chamadas a menos de 2 s da anterior do mesmo participante respondem `204` sem disparar webhook             | Protege o fluxo de webhooks de clientes que ignoram o limite do navegador | n          |
| Retentativa de `typing.started`                | Usa o mesmo dispatcher, mas sem retentativa (1 tentativa), registrada em `webhook_deliveries`              | Um aviso de digitação atrasado em 10 min não tem valor                    | n          |
| Vários digitando                               | 1 pessoa: "{nome} está digitando…"; 2: "{a} e {b} estão digitando…"; 3+: "Várias pessoas estão digitando…" | O PRD só define o caso de uma pessoa                                      | n          |
| Quando mostrar "Carregar mensagens anteriores" | Enquanto a última página carregada (inicial ou anterior) veio com 50 itens                                 | Página incompleta indica o início da sala                                 | n          |
| Mensagens anteriores e o SSE                   | Mensagens antigas entram no topo, sem mudar a posição visível da leitura                                   | Inserir no topo sem compensar a rolagem faz a lista "pular"               | n          |

**Open questions:** none - all resolved or logged above (required before the spec is confirmed).

---

## User Stories

### P3: Ver quem está digitando

**User Story**: Como participante, quero ver quando alguém está digitando para saber que uma resposta vem aí.

**Why P3**: RF-21 é Could.

**Acceptance Criteria**:

1. WHEN a pessoa digita no `Composer` THEN o web SHALL chamar a action `notifyTyping` no máximo uma vez a cada 3 s
2. WHEN `POST /typing` recebe token válido THEN a api SHALL responder `204` e disparar o webhook `typing.started` com `data = { participant: { id, name } }`
3. IF `POST /typing` recebe token inválido THEN a api SHALL responder `401`
4. IF `POST /typing` chega menos de 2 s depois da anterior do mesmo participante THEN a api SHALL responder `204` sem disparar webhook
5. The api SHALL fazer só uma tentativa de entrega para `typing.started`
6. WHEN o web recebe um webhook `typing.started` válido THEN o web SHALL escrever em todas as conexões SSE um evento `event: typing` com o `data` do webhook e sem `id:`
7. IF o evento `typing` é do próprio participante THEN o `TypingIndicator` SHALL ignorá-lo
8. WHEN chega um evento `typing` de outro participante THEN o `TypingIndicator` SHALL mostrar o nome dele por 5 s, reiniciando a contagem a cada novo evento da mesma pessoa
9. WHEN chega uma mensagem `USER` de um participante que está no `TypingIndicator` THEN o `TypingIndicator` SHALL removê-lo na hora
10. WHILE há exatamente dois participantes digitando the `TypingIndicator` SHALL mostrar "{a} e {b} estão digitando…"
11. WHILE há três ou mais participantes digitando the `TypingIndicator` SHALL mostrar "Várias pessoas estão digitando…"

**Independent Test**: E2E: A digita sem enviar e B vê "A está digitando…"; 5 s depois de A parar, o aviso some.

---

### P3: Carregar mensagens anteriores

**User Story**: Como participante, quero ler mensagens mais antigas que as 50 iniciais para entender o contexto da conversa.

**Why P3**: RF-11 é Could.

**Acceptance Criteria**:

1. WHILE a última página carregada tem 50 mensagens the `MessageList` SHALL mostrar o botão "Carregar mensagens anteriores" no topo
2. WHEN a pessoa aciona "Carregar mensagens anteriores" THEN o web SHALL buscar `GET /messages?before=<menor seq carregado>&limit=50` por uma Server Action e inserir o resultado no topo, em ordem crescente de `seq`
3. WHEN as mensagens anteriores são inseridas THEN a `MessageList` SHALL manter visível a mesma mensagem que estava no topo antes do clique
4. WHILE a busca está em andamento the botão SHALL ficar desabilitado com o texto "Carregando…"
5. IF a busca retorna menos de 50 mensagens THEN a `MessageList` SHALL esconder o botão
6. IF a busca falha THEN a `MessageList` SHALL manter o botão e mostrar o erro do dicionário
7. The web SHALL não duplicar uma mensagem que já está na lista

**Independent Test**: Com 120 mensagens no banco, abrir `/chat`, clicar duas vezes e ver as 120 em ordem, sem o botão no fim.

---

## Edge Cases

- IF a sala tem exatamente 50 mensagens THEN o botão SHALL aparecer, e o clique SHALL trazer 0 mensagens e esconder o botão
- IF chegam mensagens ao vivo enquanto a busca de anteriores está em andamento THEN a lista SHALL conter as duas, sem duplicar e em ordem de `seq`
- IF o participante que digitava sai da sala THEN o `TypingIndicator` SHALL removê-lo em no máximo 5 s

---

## Requirement Traceability

| Requirement ID | Story                   | Tasks                    | Phase | Status   |
| -------------- | ----------------------- | ------------------------ | ----- | -------- |
| TYPE-01        | P3: Digitando (AC 1-5)  | T1, T2, T3, T6, T10, T14 | Tasks | In Tasks |
| TYPE-02        | P3: Digitando (AC 6-11) | T4, T5, T8, T9, T12, T14 | Tasks | In Tasks |
| HIST-01        | P3: Anteriores (AC 1-7) | T7, T8, T11, T12, T14    | Tasks | In Tasks |

**Coverage:** 3 total, 3 mapped to tasks, 0 unmapped ✅

---

## Success Criteria

- [ ] E2E do "digitando" e da paginação verdes
- [ ] Nenhuma requisição periódica nova (o `notifyTyping` só dispara com teclas)
- [ ] `make gate` e `make e2e` verdes
