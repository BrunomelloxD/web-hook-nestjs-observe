# Tema e componentes visuais do chat (F0) Specification

Origem: [PRD](../../prd.md) §4.6, §8 e fase F0. Requisitos do PRD cobertos: RF-25, RF-26, RF-27, RNF-07 (parte visual), RNF-09.

## Problem Statement

O chat ainda não tem identidade visual: o web usa os tokens padrão do shadcn, não tem tema escuro e não tem os componentes da Sala. Sem isso, as fases seguintes construiriam lógica sobre uma UI provisória. A F0 entrega os tokens do design, o tema claro/escuro sem piscar e os componentes visuais da Sala no Storybook, com dados fixos.

## Goals

- [ ] As 15 cores da coleção **Tema** do FigCraft existem como variáveis CSS nos dois modos, com os valores do PRD §8.2 (4 deles ajustados para AA, ver design)
- [ ] O tema escolhido é aplicado já no HTML do servidor (zero flash ao recarregar)
- [ ] Cada componente visual da Sala tem stories nos dois temas e nas três faixas, todas passando no addon de a11y

## Out of Scope

| Feature                                     | Reason                                                          |
| ------------------------------------------- | --------------------------------------------------------------- |
| Dados reais, Server Actions, chamadas à api | Entram na F1 (`chat-core`)                                      |
| Tempo real (SSE, webhooks)                  | Entram na F2 (`chat-webhooks`)                                  |
| Temas além de claro e escuro                | PRD §4.6 define só os dois                                      |
| Salvar o tema por participante na api       | O tema é preferência do navegador (cookie), não do participante |

---

## Assumptions & Open Questions

| Assumption / decision                        | Chosen default                                                                                                                                 | Rationale                                                                            | Confirmed? |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ---------- |
| Caminho do design                            | O arquivo real é `.specs/figcraft/index.figcraft`; o link do PRD (`apps/web/figcraft/...`) está desatualizado e será corrigido no PRD          | É onde o arquivo existe hoje                                                         | n          |
| Como seguir o sistema sem cookie, sem piscar | Sem cookie, o `<html>` fica **sem** `data-theme`; o CSS aplica o escuro via `@media (prefers-color-scheme: dark)` em `:root:not([data-theme])` | O navegador conhece a preferência do sistema; o CSS resolve sem flash                | y          |
| Como aplicar o cookie sem piscar             | Script inline no `<head>` lê o cookie `theme` e grava `data-theme` antes da primeira pintura; o root layout não lê cookies (AD-001)            | Ler o cookie no root layout com Cache Components deixaria o app inteiro bloqueante   | y          |
| Contraste AA x valores do FigCraft           | 4 valores ajustados: `text/secondary` claro `#687080`, `text/muted` claro `#68707F` e escuro `#7C8597`, `brand/default` escuro `#5B5EF0`       | Com os valores originais, 4 combinações ficam abaixo de 4.5:1                        | y          |
| O que o botão alterna quando não há cookie   | Lê o tema efetivo (`matchMedia`) e grava o oposto                                                                                              | O ícone mostrado já reflete o tema efetivo; o clique deve inverter o que a pessoa vê | n          |
| Quantidade e valores dos pares `avatar/*`    | Os pares que existirem na coleção Tema do FigCraft, exportados como estão; índice = hash estável (FNV-1a) do `id` módulo o número de pares     | PRD §8.2 não lista os valores; a fonte é o design                                    | n          |
| Faixas de viewport no Storybook              | Três viewports nomeados: `mobile` 390×844, `tablet` 768×1024, `desktop` 1440×900                                                               | Mesmos tamanhos dos frames do design                                                 | n          |
| Hora exibida nos balões                      | `HH:mm`, `pt-BR`, fuso fixo `America/Sao_Paulo`, no servidor e no cliente                                                                      | Fuso fixo evita diferença de hidratação entre o servidor e o navegador               | n          |

**Open questions:** none - all resolved or logged above (required before the spec is confirmed).

---

## User Stories

### P1: Tokens de cor do design ⭐ MVP

**User Story**: Como participante, quero que o chat tenha as cores do design nos dois temas para usá-lo com conforto.

**Why P1**: Todos os componentes dependem dos tokens.

**Acceptance Criteria**:

1. The web SHALL definir em `globals.css` uma variável CSS para cada um dos 15 tokens do PRD §8.2, com o valor Light em `:root` e o valor Dark em `[data-theme="dark"]` e em `:root:not([data-theme])` sob `@media (prefers-color-scheme: dark)`
2. The web SHALL ligar os tokens ao tema do Tailwind/shadcn, de forma que nenhum componente do chat use cor literal (hex, rgb ou classe de paleta do Tailwind)
3. The web SHALL garantir contraste WCAG AA entre `text/primary`, `text/secondary` e `text/on-brand` e os fundos sobre os quais aparecem, nos dois temas

**Independent Test**: Teste unitário que lê `globals.css` e compara cada variável com a tabela do PRD; stories passam no a11y nos dois temas.

---

### P1: Tema claro e escuro sem piscar ⭐ MVP

**User Story**: Como participante, quero alternar entre tema claro e escuro e manter a escolha para usar o chat com conforto.

**Why P1**: RF-25 e RF-26 são Must.

**Acceptance Criteria**:

1. WHILE não existe cookie `theme` the `<html>` SHALL ficar sem atributo `data-theme`, aplicando o tema do sistema via `prefers-color-scheme`
2. WHEN a página carrega com o cookie `theme=dark` THEN o web SHALL aplicar `data-theme="dark"` no `<html>` antes da primeira pintura, por script inline no `<head>`
3. WHEN a página carrega com o cookie `theme=light` THEN o web SHALL aplicar `data-theme="light"` no `<html>` antes da primeira pintura, por script inline no `<head>`
4. IF o cookie `theme` tem valor diferente de `light` ou `dark` THEN o web SHALL tratá-lo como ausente
5. WHILE o tema efetivo é claro the `ThemeToggle` SHALL mostrar o ícone de lua com rótulo acessível "Usar tema escuro"
6. WHILE o tema efetivo é escuro the `ThemeToggle` SHALL mostrar o ícone de sol com rótulo acessível "Usar tema claro"
7. WHEN a pessoa aciona o `ThemeToggle` THEN o web SHALL trocar o `data-theme` do `<html>` para o tema oposto ao efetivo sem recarregar a página
8. WHEN a pessoa aciona o `ThemeToggle` THEN o web SHALL gravar o cookie `theme` com o novo valor, `Path=/`, `SameSite=Lax` e validade de 1 ano

**Independent Test**: Abrir `/` com `theme=dark` e ver `data-theme="dark"` no `<html>` já no evento `DOMContentLoaded` (antes da hidratação); clicar no botão, recarregar e ver o tema mantido.

---

### P1: Componentes visuais da Sala e da tela Entrar ⭐ MVP

**User Story**: Como participante, quero telas que funcionem no celular, no tablet e no computador para conversar de qualquer lugar.

**Why P1**: RF-27 é Must, e as fases F1 a F4 só ligam dados a esses componentes.

**Acceptance Criteria**:

1. The web SHALL fornecer os componentes `JoinForm`, `ChatHeader`, `OnlineBadge`, `MessageList`, `MessageBubble`, `SystemMessage`, `Composer`, `TypingIndicator` e `Avatar`, todos recebendo dados só por props
2. The `MessageBubble` SHALL renderizar mensagens de outros à esquerda (avatar, nome, hora, balão `bg/surface`) e mensagens próprias à direita ("Você", hora, balão `brand/default` com texto `text/on-brand`)
3. The `SystemMessage` SHALL renderizar o texto centralizado na cor `text/muted`
4. The `Avatar` SHALL mostrar a inicial do nome em maiúscula, com o par de cores `avatar/*` escolhido de forma determinística a partir do `id`
5. The `MessageBubble` SHALL renderizar o conteúdo como texto, sem `dangerouslySetInnerHTML`, quebrando palavras longas sem rolagem horizontal
6. WHILE a largura da viewport é menor que 768 px the `ChatHeader` SHALL mostrar só o avatar do participante, sem o nome
7. WHILE a largura da viewport é de 1280 px ou mais the Sala SHALL limitar a coluna da conversa a 800 px, centralizada
8. WHILE a largura da viewport é de 768 px ou mais the tela Entrar SHALL mostrar o cartão com 420 px de largura, centralizado
9. WHILE a largura da viewport é menor que 768 px the tela Entrar SHALL mostrar o cartão na largura toda
10. The Sala SHALL manter o cabeçalho fixo no topo, o `Composer` fixo embaixo e só a `MessageList` rolável
11. The `MessageList` SHALL ter `aria-live="polite"`
12. The web SHALL manter todos os textos do chat em `chat.dictionary.ts`, em português
13. The Storybook SHALL ter uma story para cada estado: lista vazia, lista longa, mensagens próprias e dos outros, mensagem de sistema, digitando, erro de envio e nome em uso
14. The Storybook SHALL permitir ver cada story nos temas claro e escuro e nas viewports `mobile`, `tablet` e `desktop`
15. The Storybook SHALL passar no addon de a11y em todas as stories do chat, nos dois temas

**Independent Test**: `make storybook`, percorrer as stories nos dois temas e três viewports e comparar com os 12 frames do FigCraft.

---

## Edge Cases

- IF o nome do autor começa com acento ou é minúsculo (ex.: "érica") THEN o `Avatar` SHALL mostrar "É"
- IF a mensagem tem uma palavra de 1000 caracteres sem espaço THEN o `MessageBubble` SHALL quebrá-la dentro do balão
- IF o conteúdo contém `<script>` THEN o `MessageBubble` SHALL exibi-lo como texto literal

---

## Requirement Traceability

| Requirement ID | Story                        | Tasks                           | Phase | Status   |
| -------------- | ---------------------------- | ------------------------------- | ----- | -------- |
| THEME-01       | P1: Tokens de cor (AC 1-3)   | T2, T3, T22                     | Tasks | In Tasks |
| THEME-02       | P1: Tema sem piscar (AC 1-4) | T1, T4, T21                     | Tasks | In Tasks |
| THEME-03       | P1: Tema sem piscar (AC 5-8) | T1, T9                          | Tasks | In Tasks |
| UI-01          | P1: Componentes (AC 1-5)     | T8, T10, T12-T18, T20           | Tasks | In Tasks |
| UI-02          | P1: Componentes (AC 6-10)    | T18, T19, T20                   | Tasks | In Tasks |
| UI-03          | P1: Componentes (AC 11-12)   | T11, T16                        | Tasks | In Tasks |
| UI-04          | P1: Componentes (AC 13-15)   | T6, T7, T14, T16, T17, T19, T20 | Tasks | In Tasks |

**Coverage:** 7 total, 7 mapped to tasks, 0 unmapped ✅

---

## Success Criteria

- [ ] Recarregar `/` e `/chat` com qualquer valor de `theme` não mostra troca de tema visível
- [ ] Os 12 frames do FigCraft têm equivalente no Storybook (2 telas × 3 faixas × 2 temas)
- [ ] `make gate` verde com 100% de cobertura
