# web

App Next do monorepo (SSR-first). Estrutura, convenções e checklist para criar features em [ARCHITECTURE.md](ARCHITECTURE.md).

## Rodando

Na raiz do monorepo:

```bash
make install
make dev
```

| URL                     | O quê                           |
| ----------------------- | ------------------------------- |
| `http://localhost:3000` | web                             |
| `http://localhost:6006` | Storybook (`npm run storybook`) |

## Scripts

Rode dentro de `apps/web`, ou da raiz com `--workspace=apps/web`.

| Comando                   | O quê                                                                |
| ------------------------- | -------------------------------------------------------------------- |
| `npm run dev`             | Next em modo dev (fora do Docker; precisa da api rodando ou do mock) |
| `npm run build`           | build de produção                                                    |
| `npm run lint`            | oxlint (com fronteiras entre pastas) + `check:conventions`           |
| `npm run typecheck`       | tipos (gera os tipos de rota do Next antes)                          |
| `npm test`                | testes unitários                                                     |
| `npm run test:cov`        | unitários com cobertura (mínimo 100%)                                |
| `npm run test:storybook`  | stories como teste (Chromium, a11y)                                  |
| `npm run test:e2e`        | Playwright contra a stack rodando                                    |
| `npm run storybook`       | Storybook em modo dev                                                |
| `npm run build-storybook` | Storybook estático                                                   |
