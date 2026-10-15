# Tempo real por webhooks e SSE (F2) Specification

Origem: [PRD](../../prd.md) §2, §6.3, §6.4, §7 (`WebhookDelivery`), §9.3 e fase F2. Requisitos do PRD cobertos: RF-14, RF-18, RF-22, RNF-03, RNF-04, RNF-05, D4.

## Problem Statement

Na F1, as mensagens dos outros só aparecem ao recarregar. O objetivo do estudo é entregá-las **por push, sem polling**. A api avisa o servidor do Next por um webhook assinado (Standard Webhooks), e o Next repassa o evento aos navegadores conectados por SSE.

## Goals

- [ ] Uma mensagem enviada aparece nos outros navegadores em p95 < 1 s em ambiente local (RNF-03)
- [ ] Zero requisições periódicas do navegador ou do web para buscar dados
- [ ] Cada entrega de webhook fica registrada no banco, com retentativa e backoff

## Out of Scope

| Feature                                                     | Reason                                       |
| ----------------------------------------------------------- | -------------------------------------------- |
| Recuperar mensagens perdidas na reconexão (`Last-Event-ID`) | F3 (`chat-resilience`)                       |
| Saída automática ao fechar a aba                            | F3 (`chat-resilience`)                       |
| Evento `typing.started`                                     | F4 (`chat-extras`)                           |
| Várias instâncias do web, Redis pub/sub                     | PRD §1.2 e §12: o web roda com uma instância |
| Transactional outbox                                        | Evolução citada no PRD §12                   |
| Tabela de assinaturas de webhook                            | D4: destino vem de variável de ambiente      |

---

## Assumptions & Open Questions

| Assumption / decision                                                                                  | Chosen default                                                                                                                                           | Rationale                                                                                               | Confirmed?                  |
| ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | --------------------------- |
| D4: destino do webhook                                                                                 | Uma variável `WEBHOOK_TARGET_URL`                                                                                                                        | Proposta do PRD; um só assinante                                                                        | n                           |
| Número de tentativas                                                                                   | 1 tentativa inicial + 5 retentativas (6 no total), com esperas de 1 s, 5 s, 30 s, 2 min e 10 min antes de cada retentativa; `FAILED` após a 6ª falha     | O PRD lista 5 esperas; "desiste após a 5ª" lido como 5ª retentativa                                     | n                           |
| Registro de cada tentativa (PRD §6.3 pede duração e nº da tentativa; o model do §7 só guarda a última) | Nova tabela `webhook_delivery_attempts` (`deliveryId`, `attempt`, `statusCode?`, `durationMs`, `error?`, `createdAt`), além de `WebhookDelivery`         | Sem ela, o histórico das tentativas e a duração se perdem, e o estudo precisa deles                     | n                           |
| Onde as retentativas são agendadas                                                                     | Timers no processo da api. Entregas `PENDING` não são retomadas depois de reiniciar a api                                                                | Simples para o estudo; a reconexão com `after=<seq>` (F3) recupera mensagens. Outbox fica como evolução | n                           |
| Chave do HMAC                                                                                          | `WEBHOOK_SECRET` no formato `whsec_<base64>`; a chave é o base64 decodificado depois do prefixo, como na especificação Standard Webhooks                 | Compatível com os vetores de teste oficiais                                                             | n                           |
| Tolerância do timestamp                                                                                | `                                                                                                                                                        | agora − webhook-timestamp                                                                               | ≤ 300 s`, nos dois sentidos | PRD: "mais de 5 minutos de diferença" | n   |
| Cache de idempotência do receptor                                                                      | Últimos 1000 `webhook-id` em memória (descarta o mais antigo)                                                                                            | Cobre todas as retentativas de uma janela de 5 min no volume do estudo                                  | n                           |
| Eventos de entrada e saída                                                                             | Cada entrada/saída dispara dois webhooks: `message.created` (mensagem `JOINED`/`LEFT`) e `presence.changed` (`{ online }`)                               | PRD §6.3                                                                                                | n                           |
| Valor de `online` em `presence.changed`                                                                | Contagem de participantes com `leftAt` nulo, lida depois do commit                                                                                       | Reflete o estado gravado                                                                                | n                           |
| Ordem de chegada                                                                                       | Não garantida entre webhooks; o navegador insere cada `message` na posição do seu `seq` e ignora `seq` já presente                                       | Retentativas podem inverter a ordem                                                                     | n                           |
| Mensagem própria vinda pelo SSE                                                                        | Na F2, o web não faz mais `router.refresh()` após enviar; a própria mensagem chega pelo SSE, e o `seq` já presente é ignorado                            | Um só caminho de atualização. O envio otimista vem na F3                                                | n                           |
| Observabilidade                                                                                        | A api registra no log (pino) cada tentativa com `eventId`, tipo, tentativa, status e duração. O web registra `warn` para webhooks recusados, sem o corpo | Depuração sem vazar conteúdo                                                                            | n                           |
| Retenção de `webhook_deliveries`                                                                       | Sem expiração nesta versão                                                                                                                               | Mesmo critério do D2                                                                                    | n                           |

**Open questions:** none - all resolved or logged above (required before the spec is confirmed).

---

## User Stories

### P1: A api emite webhooks assinados e confiáveis ⭐ MVP

**User Story**: Como mantenedor, quero que a api avise o web por webhook assinado, com retentativa, para estudar entregas como num sistema de produção.

**Why P1**: É o ponto do estudo (M3, RNF-04, RNF-05).

**Acceptance Criteria**:

1. WHEN a transação que grava uma mensagem é confirmada THEN a api SHALL disparar o webhook `message.created` com `data` igual ao `MessageResponseDto`
2. WHEN a transação de entrada ou saída de um participante é confirmada THEN a api SHALL disparar o webhook `presence.changed` com `data = { online }`
3. The api SHALL responder `POST /messages`, `POST /participants` e `POST /participants/:id/leave` sem esperar a entrega do webhook
4. The api SHALL enviar cada webhook como `POST {WEBHOOK_TARGET_URL}` com corpo `{ type, occurredAt, data }` e os headers `webhook-id`, `webhook-timestamp`, `webhook-signature` e `content-type: application/json`
5. The api SHALL calcular `webhook-signature` como `v1,` + base64(HMAC-SHA256(chave, "{id}.{timestamp}.{corpo}")), reproduzindo os vetores de teste da especificação Standard Webhooks
6. The api SHALL usar o mesmo `webhook-id` em todas as tentativas do mesmo evento, recalculando `webhook-timestamp` e a assinatura a cada tentativa
7. WHEN o destino responde `2xx` THEN a api SHALL marcar a entrega como `SUCCEEDED`
8. IF o destino responde fora de `2xx`, a conexão falha ou não há resposta em 5 s THEN a api SHALL contar a tentativa como falha
9. WHEN a tentativa N (1 a 5) falha THEN a api SHALL agendar a próxima depois de 1 s, 5 s, 30 s, 2 min e 10 min, respectivamente
10. WHEN a 6ª tentativa falha THEN a api SHALL marcar a entrega como `FAILED` e não tentar mais
11. The api SHALL gravar um `WebhookDelivery` por evento e uma linha em `webhook_delivery_attempts` por tentativa, com número da tentativa, código HTTP (ou nulo), duração em ms e erro (ou nulo)
12. The api SHALL validar `WEBHOOK_TARGET_URL` (URL) e `WEBHOOK_SECRET` (`whsec_` + base64) com zod na inicialização
13. The módulo `chat` SHALL depender só de `WebhookDispatcher.dispatch(type, data)`, sem conhecer o destino

**Independent Test**: E2E da api com um servidor HTTP de teste: `POST /messages` gera uma requisição com assinatura válida; o servidor responde `500` duas vezes e `204` na terceira, e o banco mostra 3 tentativas e `SUCCEEDED`.

---

### P1: O web recebe o webhook com segurança ⭐ MVP

**User Story**: Como mantenedor, quero que o web aceite só webhooks autênticos e novos para que ninguém injete mensagens na sala.

**Why P1**: RNF-04.

**Acceptance Criteria**:

1. The rota `POST /webhooks/chat` SHALL ler o corpo cru e verificar a assinatura sobre esses bytes, com comparação de tempo constante
2. IF a assinatura falta ou não confere THEN o web SHALL responder `401` sem publicar no hub
3. IF `webhook-timestamp` difere do relógio do web em mais de 300 s THEN o web SHALL responder `401` sem publicar no hub
4. IF o corpo não segue o envelope `{ type, occurredAt, data }` de um tipo conhecido THEN o web SHALL responder `400` sem publicar no hub
5. IF o `webhook-id` está entre os últimos 1000 processados THEN o web SHALL responder `204` sem publicar no hub
6. WHEN o webhook é válido e novo THEN o web SHALL publicar o evento no hub e responder `204`
7. The rota `POST /webhooks/chat` SHALL não fazer nenhuma chamada de rede antes de responder
8. The web SHALL validar `WEBHOOK_SECRET` com zod na inicialização
9. WHEN `make install` cria os `.env` THEN o Makefile SHALL gerar um `WEBHOOK_SECRET` aleatório de 32 bytes e gravar o mesmo valor na api e no web

**Independent Test**: Testes do route handler com assinatura válida, inválida, timestamp velho e id repetido, verificando o status e se o hub recebeu o evento.

---

### P1: O navegador recebe eventos por SSE ⭐ MVP

**User Story**: Como participante, quero receber as mensagens dos outros sem recarregar a página para acompanhar a conversa em tempo real.

**Why P1**: RF-14, RF-18 e RF-22 são Must.

**Acceptance Criteria**:

1. IF `GET /chat/stream` chega sem sessão válida THEN o web SHALL responder `401`
2. WHEN `GET /chat/stream` chega com sessão válida THEN o web SHALL responder `200` com `content-type: text/event-stream`, `Cache-Control: no-cache` e `X-Accel-Buffering: no`, e registrar a conexão no hub
3. WHEN o hub publica `message.created` THEN o web SHALL escrever em todas as conexões abertas um evento `event: message`, com `id:` igual ao `seq` e `data:` igual ao `MessageResponseDto` em JSON
4. WHEN o hub publica `presence.changed` THEN o web SHALL escrever em todas as conexões abertas um evento `event: presence` com `data: {"online":N}`, sem `id:`
5. WHILE uma conexão SSE está aberta the web SHALL escrever o comentário `: heartbeat` a cada 25 s
6. WHEN o navegador fecha a conexão THEN o web SHALL removê-la do hub
7. The rota `GET /chat/stream` SHALL ser dinâmica e nunca cacheada nem pré-renderizada no build de produção
8. The `ChatStream.client` SHALL ser o único componente que abre um `EventSource`, para `/chat/stream`
9. WHEN chega um evento `message` com `seq` ainda ausente da lista THEN o `ChatStream.client` SHALL inseri-lo na posição de ordem crescente de `seq`
10. IF chega um evento `message` com `seq` já presente na lista THEN o `ChatStream.client` SHALL ignorá-lo
11. WHEN chega um evento `presence` THEN o `ChatHeader` SHALL mostrar "{online} pessoas online"
12. IF a conexão SSE cai THEN o navegador SHALL reconectar pelo mecanismo nativo do `EventSource`, sem código de polling
13. The navegador e o web SHALL não usar `setInterval`, `setTimeout` recorrente nem requisições periódicas para buscar mensagens ou presença

**Independent Test**: E2E com dois contextos: A envia e B vê a mensagem sem recarregar; C entra e A e B veem o contador subir.

---

## Edge Cases

- IF o `WEBHOOK_TARGET_URL` está fora do ar quando a mensagem é gravada THEN a api SHALL responder `201` ao `POST /messages` e retentar a entrega em segundo plano
- IF o mesmo webhook chega duas vezes (retentativa após timeout que na verdade entregou) THEN o navegador SHALL mostrar a mensagem uma vez só
- IF não há nenhuma conexão SSE aberta THEN o web SHALL responder `204` ao webhook válido e descartar o evento
- IF o corpo do webhook foi alterado em um byte (ex.: espaço a mais) THEN o web SHALL responder `401`
- IF o navegador desconecta enquanto o hub escreve THEN o web SHALL remover a conexão sem afetar as outras

---

## Requirement Traceability

| Requirement ID | Story                  | Tasks              | Phase   | Status      |
| -------------- | ---------------------- | ------------------ | ------- | ----------- |
| WHOUT-01       | P1: Emissor (AC 1-3)   | T6, T7, T8, T9     | Execute | Implemented |
| WHOUT-02       | P1: Emissor (AC 4-6)   | T3, T4, T6, T9     | Execute | Implemented |
| WHOUT-03       | P1: Emissor (AC 7-11)  | T2, T4, T5, T6, T9 | Execute | Implemented |
| WHOUT-04       | P1: Emissor (AC 12-13) | T1, T7             | Execute | Implemented |
| WHIN-01        | P1: Receptor (AC 1-4)  | T13, T15, T18      | Execute | Implemented |
| WHIN-02        | P1: Receptor (AC 5-7)  | T14, T18, T25      | Tasks   | In Tasks    |
| WHIN-03        | P1: Receptor (AC 8-9)  | T10, T11, T12      | Tasks   | In Tasks    |
| SSE-01         | P1: SSE (AC 1-7)       | T16, T17, T19, T25 | Tasks   | In Tasks    |
| SSE-02         | P1: SSE (AC 8-11)      | T20, T22, T23, T25 | Tasks   | In Tasks    |
| SSE-03         | P1: SSE (AC 12-13)     | T21, T24, T25      | Tasks   | In Tasks    |

**Coverage:** 10 total, 10 mapped to tasks, 0 unmapped ✅

---

## Success Criteria

- [ ] p95 < 1 s entre o envio em A e a exibição em B, medido no E2E local com 20 mensagens
- [ ] A aba Network do navegador mostra uma única conexão `/chat/stream` e nenhuma requisição periódica
- [ ] `webhook_delivery_attempts` mostra o histórico de cada entrega, incluindo as que viraram `FAILED`
- [ ] `make gate` e `make e2e` verdes, com `next build` sem pré-renderizar `/chat/stream`
