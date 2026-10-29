# Robustez do chat em tempo real (F3) Specification

Origem: [PRD](../../prd.md) §4.3 a §4.5, §6.4 e fase F3. Requisitos do PRD cobertos: RF-15, RF-16, RF-17, RF-20, RF-23, RF-24, RNF-06.

## Problem Statement

Com a F2, o chat funciona em tempo real nas condições ideais. Mas uma queda rápida de rede perde mensagens, fechar a aba deixa a pessoa "online" para sempre, a própria mensagem demora a aparecer e nada impede alguém de inundar a sala. A F3 fecha essas lacunas.

## Goals

- [ ] Depois de uma queda de conexão, nenhuma mensagem gravada durante a queda falta na lista
- [ ] Quem fecha a aba sai da contagem de online em 30 s (± 1 s)
- [ ] A própria mensagem aparece na hora, sem duplicar quando o SSE a confirma

## Out of Scope

| Feature                                                            | Reason                                        |
| ------------------------------------------------------------------ | --------------------------------------------- |
| Recuperar presença de quem estava conectado quando o web reiniciou | Hub em memória; limitação aceita (PRD §12)    |
| Fila de envio offline (enviar quando a rede voltar)                | O PRD prevê só "Tentar de novo" manual        |
| Limite de envio distribuído entre instâncias da api                | A api roda com uma instância no estudo        |
| Medir 100 conexões SSE                                             | Atividade de medição (PRD §12), não requisito |

---

## Assumptions & Open Questions

| Assumption / decision                                   | Chosen default                                                                                                                                                                                             | Rationale                                                                                                                                 | Confirmed? |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Idempotência do "Tentar de novo"                        | O reenvio usa o mesmo `clientId`. A api tem índice único em `(participant_id, client_id)`; um `POST /messages` com par já gravado responde `201` com a mensagem existente, sem gravar nem disparar webhook | Uma falha por timeout pode ter gravado a mensagem; sem isso, o retry duplica                                                              | n          |
| Recuperação com muitas mensagens perdidas               | O web busca `GET /messages?after=<seq>&limit=100` em páginas até receber menos de 100                                                                                                                      | Recupera tudo, sem limite arbitrário                                                                                                      | n          |
| Eventos ao vivo durante a recuperação                   | A conexão é registrada no hub antes da busca; eventos ao vivo ficam num buffer e são escritos depois do histórico, descartando `seq` já enviado                                                            | Registrar depois perderia eventos que chegam durante a busca                                                                              | n          |
| `Last-Event-ID` inválido                                | Não inteiro positivo → ignorado; vale o `after` da query, se for válido; sem nenhum dos dois, sem recuperação                                                                                              | Cabeçalho vem do cliente                                                                                                                  | n          |
| Queda antes do primeiro evento `message`                | O `ChatStream.client` abre `/chat/stream?after=<último seq renderizado pelo servidor>`; sem `Last-Event-ID`, o web recupera a partir desse `after`. Sala sem mensagens → sem `after`                       | O navegador só manda `Last-Event-ID` depois de receber um evento com `id`; sem isso, o que foi gravado entre o HTML e a queda se perderia | y          |
| Saída por desconexão quando a pessoa já saiu pelo botão | O timer é cancelado no "Sair"; se a api responder `401`, o web ignora                                                                                                                                      | Evita duas saídas                                                                                                                         | n          |
| Limite de envio (RNF-06)                                | Janela deslizante de 10 s por participante, em memória na api; a 6ª mensagem em 10 s → `429` com header `Retry-After` em segundos                                                                          | Uma instância da api; janela deslizante é o comportamento descrito                                                                        | n          |
| Aviso de limite na tela                                 | "Você está enviando mensagens rápido demais. Aguarde alguns segundos." no `Composer`; a mensagem otimista vira "Não enviada · Tentar de novo"                                                              | PRD pede "aviso na tela" sem texto definido                                                                                               | n          |
| "Estar no fim" da lista (RF-15)                         | Distância até o fim ≤ 80 px                                                                                                                                                                                | Tolerância para arredondamento de rolagem                                                                                                 | n          |
| Mensagem própria e "Novas mensagens ↓"                  | Ao enviar, a lista sempre rola até o fim                                                                                                                                                                   | Quem envia quer ver a própria mensagem                                                                                                    | n          |
| Tempo até mostrar "Reconectando…"                       | Assim que o `EventSource` dispara `error`; some no próximo `open`                                                                                                                                          | PRD não define atraso                                                                                                                     | n          |
| Ordem da mensagem otimista                              | Fica no fim da lista até a confirmação; ao chegar o evento com o mesmo `clientId`, é substituída e reposicionada pelo `seq`                                                                                | A otimista ainda não tem `seq`                                                                                                            | n          |

**Open questions:** none - all resolved or logged above (required before the spec is confirmed).

---

## User Stories

### P2: Não perder mensagens numa queda rápida

**User Story**: Como participante, quero continuar recebendo mensagens depois de uma queda rápida de conexão para não perder nada da conversa.

**Why P2**: RF-23 e RF-24 são Should; o chat funciona sem eles, mas perde mensagens.

**Acceptance Criteria**:

1. WHEN `GET /chat/stream` chega com `Last-Event-ID` inteiro positivo THEN o web SHALL escrever, antes de qualquer evento ao vivo, todas as mensagens com `seq` maior que esse valor, em ordem crescente de `seq`
2. WHILE o web busca as mensagens perdidas the web SHALL guardar os eventos ao vivo daquela conexão e escrevê-los depois, omitindo `seq` já escrito
3. IF nem `Last-Event-ID` nem o `after` da query é inteiro positivo THEN o web SHALL abrir o stream sem recuperação
4. IF a busca das mensagens perdidas falha THEN o web SHALL encerrar a conexão para o `EventSource` tentar de novo
5. WHILE o `EventSource` está desconectado the `Composer` SHALL mostrar "Reconectando…" acima do campo
6. WHEN o `EventSource` reabre THEN o `Composer` SHALL esconder "Reconectando…"
7. WHEN `GET /chat/stream` chega sem `Last-Event-ID` inteiro positivo e com `after` inteiro positivo na query THEN o web SHALL escrever, antes de qualquer evento ao vivo, todas as mensagens com `seq` maior que `after`, em ordem crescente de `seq`, como no AC1-2; com os dois válidos, vale o `Last-Event-ID`
8. WHEN o `ChatStream.client` abre o stream THEN ele SHALL usar `/chat/stream?after=<último seq renderizado pelo servidor>`, para que as mensagens gravadas entre o HTML e o primeiro evento SSE (inclusive numa queda antes de qualquer evento `message`) cheguem em ordem; sala sem mensagens → `/chat/stream` sem `after`

**Independent Test**: E2E: B perde a rede antes de receber qualquer mensagem pelo SSE, A envia 3 mensagens, B volta e vê as 3 na ordem, sem recarregar.

---

### P2: Sair ao fechar a aba

**User Story**: Como participante, quero que o contador de online seja verdadeiro para saber com quem estou falando.

**Why P2**: RF-20 é Should.

**Acceptance Criteria**:

1. WHEN a última conexão SSE de um participante fecha THEN o web SHALL agendar a saída dele para dali a 30 s
2. WHEN o participante abre uma conexão SSE antes dos 30 s THEN o web SHALL cancelar a saída agendada
3. WHEN os 30 s passam sem nova conexão THEN o web SHALL chamar `POST /participants/:id/leave` com o token do participante
4. WHILE o participante tem pelo menos uma conexão SSE aberta the web SHALL não agendar a saída dele
5. WHEN o participante aciona "Sair" THEN o web SHALL cancelar qualquer saída agendada para ele
6. IF a api responde `401` ou `404` à saída agendada THEN o web SHALL descartar o resultado sem erro

**Independent Test**: Teste do hub com relógio falso: fechar a única conexão, avançar 29 s (sem chamada), avançar mais 1 s (uma chamada); reabrir antes dos 30 s cancela.

---

### P2: Envio otimista sem duplicar

**User Story**: Como participante, quero ver minha mensagem na hora em que envio para conversar com fluidez.

**Why P2**: RF-16 e RF-17 são Should.

**Acceptance Criteria**:

1. WHEN a pessoa envia uma mensagem THEN o `ChatStream.client` SHALL acrescentá-la na hora ao fim da lista com estado "enviando" e o `clientId` gerado
2. WHEN chega um evento `message` com `clientId` igual ao de uma otimista THEN o `ChatStream.client` SHALL substituir a otimista pela mensagem recebida, sem duplicar
3. WHEN a Server Action retorna sucesso antes do evento SSE THEN o `ChatStream.client` SHALL substituir a otimista pela mensagem retornada
4. IF a Server Action falha THEN a mensagem SHALL mostrar "Não enviada · Tentar de novo"
5. WHEN a pessoa aciona "Tentar de novo" THEN o web SHALL reenviar o mesmo conteúdo com o mesmo `clientId`, voltando ao estado "enviando"
6. WHEN `POST /messages` recebe um `clientId` já gravado para o mesmo participante THEN a api SHALL responder `201` com a mensagem existente, sem gravar outra e sem disparar webhook
7. The web SHALL parar de chamar `router.refresh()` após o envio

**Independent Test**: Teste do `ChatStream` com `EventSource` falso: enviar, ver "enviando", emitir o evento com o mesmo `clientId` e ver uma só mensagem.

---

### P2: Rolagem que respeita a leitura

**User Story**: Como participante, quero que a lista só role sozinha quando eu estiver no fim para poder ler mensagens antigas sem ser interrompido.

**Why P2**: RF-15 é Should.

**Acceptance Criteria**:

1. WHILE a lista está a 80 px ou menos do fim, WHEN chega uma mensagem nova the `MessageList` SHALL rolar até o fim
2. WHILE a lista está a mais de 80 px do fim, WHEN chega uma mensagem nova the `MessageList` SHALL manter a posição e mostrar o botão "Novas mensagens ↓"
3. WHEN a pessoa aciona "Novas mensagens ↓" THEN a `MessageList` SHALL rolar até o fim e esconder o botão
4. WHEN a pessoa rola manualmente até o fim THEN a `MessageList` SHALL esconder "Novas mensagens ↓"
5. WHEN a pessoa envia uma mensagem THEN a `MessageList` SHALL rolar até o fim

**Independent Test**: Story com interação: rolar para cima, injetar mensagem, ver o botão; clicar e ver a lista no fim.

---

### P2: Limite de envio

**User Story**: Como participante, quero que ninguém consiga inundar a sala para manter a conversa legível.

**Why P2**: RNF-06.

**Acceptance Criteria**:

1. IF um participante já teve 5 envios aceitos nos últimos 10 s THEN a api SHALL responder `429` ao `POST /messages` com `Retry-After` em segundos inteiros
2. The api SHALL contar o limite por participante, sem afetar os outros
3. The api SHALL não contar no limite um reenvio com `clientId` já gravado
4. WHEN a action recebe `429` THEN o `Composer` SHALL mostrar "Você está enviando mensagens rápido demais. Aguarde alguns segundos." até o próximo envio ou "Tentar de novo"
5. WHEN a action recebe `429` THEN a mensagem otimista SHALL ir para "Não enviada · Tentar de novo"

**Independent Test**: Teste do service com relógio falso: 5 envios passam, o 6º dá `429`; depois de 10 s, passa de novo.

---

## Edge Cases

- IF a pessoa abre duas abas e fecha uma THEN o web SHALL não agendar a saída
- IF a pessoa dá F5 THEN o web SHALL cancelar a saída agendada quando o novo stream abrir, e ninguém SHALL ver "saiu do chat"
- IF 250 mensagens foram gravadas durante a queda THEN o web SHALL escrever as 250 antes dos eventos ao vivo
- IF o evento SSE da própria mensagem chega antes da resposta da action THEN o `ChatStream.client` SHALL manter uma só mensagem
- WHEN a 5ª mensagem é enviada dentro de 10 s THEN a api SHALL aceitar

---

## Requirement Traceability

| Requirement ID | Story                    | Tasks                       | Phase   | Status   |
| -------------- | ------------------------ | --------------------------- | ------- | -------- |
| RECON-01       | P2: Queda (AC 1-4, 7-8)  | T8, T11, T18, T19, T20, T21 | Execute | Verified |
| RECON-02       | P2: Queda (AC 5-6)       | T13, T14, T17, T18          | Execute | Verified |
| AWAY-01        | P2: Fechar aba (AC 1-6)  | T7, T9, T10, T18            | Execute | Verified |
| OPT-01         | P2: Otimista (AC 1-5, 7) | T13, T16, T17, T18          | Execute | Verified |
| OPT-02         | P2: Otimista (AC 6)      | T1, T2, T5, T6              | Execute | Verified |
| SCROLL-01      | P2: Rolagem (AC 1-5)     | T15, T16, T17               | Execute | Verified |
| RATE-01        | P2: Limite (AC 1-3)      | T3, T4, T5, T6, T19         | Execute | Verified |
| RATE-02        | P2: Limite (AC 4-5)      | T12, T17, T19               | Execute | Verified |

**Coverage:** 8 total, 8 mapped to tasks, 0 unmapped ✅

---

## Success Criteria

- [x] E2E: B fica offline, A envia, B volta e vê tudo sem recarregar
- [x] E2E: B fecha a aba e A vê "B saiu do chat" e o contador cair em até 31 s
- [x] Nenhuma mensagem duplicada em 100 envios de 20 participantes × 5 com o SSE ativo
- [x] `make gate` e `make e2e` verdes
