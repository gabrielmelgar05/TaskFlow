# TaskFlow — frontend

Interface React/Next.js com TypeScript e Tailwind CSS. Navegação principal: **Visão geral** e **Quadros**. Login e cadastro são públicos; o layout privado espera a verificação da sessão antes de mostrar dados.

## Desenvolvimento

Requer Node.js 24 e a API do [backend](../server/README.md).

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Configure `NEXT_PUBLIC_API_URL=http://localhost:3001/api` para desenvolvimento direto. Essa variável é pública e incorporada ao build. Nunca coloque segredos nela.

```bash
npm run lint
npm test
NEXT_PUBLIC_API_URL=/api npm run build
```

O build gera `out/index.html`, `login/index.html`, `cadastro/index.html`, `quadros/index.html`, `quadros/detalhes/index.html` e `_routes.json`. `output: "export"` e `trailingSlash: true` permanecem habilitados. Não há servidor Next em produção; dados privados são solicitados à API.

## Testar a exportação e o proxy local

```bash
cp .dev.vars.example .dev.vars
# Configure API_ORIGIN e, se usado, o mesmo API_PROXY_SECRET do backend.
NEXT_PUBLIC_API_URL=/api npm run build
npm run preview:pages -- out --port 8788
```

Inclua `http://localhost:8788` no `CORS_ORIGIN` do backend. O proxy é uma Pages Function em `functions/api/[[path]].ts`: aceita apenas `/api/*`, usa uma origem fixa do ambiente, preserva cookies, aplica timeout e não segue redirecionamentos do upstream. `.dev.vars`, `.env.local` e `.wrangler` são ignorados pelo Git. Esses comandos são de execução local; não fazem deploy.

## Componentes e interação

- `components/ui`: botões primário, secundário, discreto e destrutivo; diálogos com foco; menus de ações; Select baseado em Radix.
- `features`: telas e lógica de workspaces, quadros, tarefas e dashboard.
- `styles`: layout, formulários, quadros, tarefas, dashboard e controles; tokens comuns ficam em `app/globals.css`.
- `lib/api.ts`: cookies incluídos, timeout, erros seguros e mensagens por campo.
- `hooks/use-api-resource.ts`: consultas com cancelamento e chave, evitando respostas atrasadas ao trocar de workspace.

A escala operacional usa 15–16 px; informações auxiliares usam 13–14 px. A sidebar tem 244 px no desktop e vira navegação horizontal no mobile. O Kanban permite rolagem interna em telas estreitas. O foco visível e `prefers-reduced-motion` são preservados.

O Select oferece opções estilizadas, busca por digitação, setas, Home/End, Enter, Escape e fechamento ao clicar fora. Dentro de um diálogo, o portal fica no próprio diálogo para funcionar na camada modal nativa.

**Tarefas:** arraste pela alça para organizar as colunas ou use **Mover tarefa** para escolher coluna e posição. A interface antecipa a ordem, reverte em falha e reconcilia com a API. O dnd-kit também permite arrastar pela alça com teclado; o formulário de movimentação funciona com teclado e touch.

## Testes de navegador

Os roteiros usam Playwright/Chromium, API real, Pages Function local e PostgreSQL isolado. Instale Playwright separadamente se não estiver disponível; não é dependência de runtime do produto. `PLAYWRIGHT_MODULE` aceita o caminho para um módulo Playwright existente; `CHROMIUM_PATH` permite usar um Chromium instalado.

Prepare o banco `taskflow_etapa07_test*`, aplique as migrações e inicie o backend apontando exclusivamente para ele. Configure a origem e o proxy correspondentes. Exemplo com preview em `http://localhost:3100`:

```bash
export DATABASE_URL='postgresql://USUARIO:SENHA@localhost:5433/taskflow_etapa07_test'
export BROWSER_BASE_URL=http://localhost:3100
# PLAYWRIGHT_MODULE e CHROMIUM_PATH são opcionais.
node test/boards.browser.mjs
node test/tasks.browser.mjs
node test/dashboard.browser.mjs
node test/quality.browser.mjs
```

Execute sequencialmente. As suítes criam contas e registros próprios e removem seus fixtures. Os roteiros cobrem CRUD, arraste pela alça e por teclado, menu acessível, contagens, rollback e persistência. A suíte de qualidade cobre formulários, indicadores, sessão expirada, axe e screenshots em **320, 375, 768, 1024, 1440 e 1920 px**. As evidências ficam em `/tmp/taskflow-etapa07`. Axe é obtido da instalação existente das ferramentas de lint.

As dependências transitivas de lint têm um override restrito de minimatch, documentado no [relatório](../../docs/ETAPA_07.md). Consulte esse relatório para resultados efetivamente executados e limitações de navegadores.
