# TaskFlow

Aplicação full stack para organizar projetos em workspaces, quadros Kanban e tarefas. Construída para portfólio e demonstrações técnicas, com dados persistidos no PostgreSQL. O deploy ainda não foi realizado.

## Funcionalidades

- Cadastro, login, sessão persistente e logout.
- Workspaces isolados por associação, com papéis de proprietário, administrador e membro.
- Criação, renomeação e exclusão de quadros, com três colunas de status explícito.
- Tarefas com descrição, prioridade, prazo, responsável e ordenação persistida.
- Arraste pela alça entre colunas, incluindo suporte a teclado.
- Dashboard com contagens, tarefas que precisam de atenção e progresso por quadro.

## Stack e arquitetura

React 19, Next.js 16, TypeScript, Tailwind CSS 4, dnd-kit e Radix Select no frontend. NestJS 12, Prisma 7 e PostgreSQL 17 no backend. npm é o gerenciador de pacotes. A interface preserva a paleta clara e a sidebar escura; não há dark mode.

```text
apps/
  web/                 Next.js com exportação estática
    src/components/    Componentes de interface, autenticação e layout
    src/features/      Workspaces, quadros, tarefas e dashboard
    src/styles/        Estilos por responsabilidade e controles compartilhados
    functions/api/     Proxy de API para a futura Cloudflare Pages
    test/              Testes de lógica, proxy e navegador
  server/              API NestJS independente
    src/               Módulos, guards, DTOs e services
    prisma/            Schema e migrações PostgreSQL
    test/              Testes HTTP e de integração
compose.yaml           PostgreSQL de desenvolvimento
```

O frontend exporta para `apps/web/out`; as rotas privadas usam autenticação no cliente, e a API autoriza cada operação. A rota de detalhe usa `/quadros/detalhes/?id=...`, compatível com hospedagem estática. A futura Pages Function encaminhará `/api/*` à API separada, mantendo cookies na mesma origem do site.

## Executar localmente

Requisitos: Node.js **24**, npm e Docker com Compose.

```bash
npm --prefix apps/server ci
npm --prefix apps/web ci
cp apps/server/.env.example apps/server/.env
cp apps/web/.env.example apps/web/.env.local

docker compose up -d db
```

Configure `DATABASE_URL` em `apps/server/.env` usando os valores locais de `compose.yaml` e a porta externa **5433**. O exemplo de ambiente usa placeholders, sem credenciais privadas.

```bash
cd apps/server
npx prisma generate --config prisma7.config.ts
npx prisma migrate deploy --config prisma7.config.ts
npm run start:dev
```

Em outro terminal:

```bash
npm --prefix apps/web run dev
```

Frontend: `http://localhost:3000`. API: `http://localhost:3001/api`. Saúde: `/api/health`. O desenvolvimento direto usa `NEXT_PUBLIC_API_URL=http://localhost:3001/api`. Para testar o proxy local, consulte [o frontend](apps/web/README.md).

## Decisões técnicas

**Autenticação.** Senhas usam Argon2id. Um token aleatório de sessão vai em cookie `HttpOnly`, `SameSite=Lax` e `Secure` em produção; o banco guarda somente seu SHA-256 e a expiração. Guards conferem sessão, origem das escritas e, quando configurado, o segredo do proxy. Login e cadastro têm limites por IP e conta.

**Autorização.** Somente participantes acessam o workspace. Proprietários e administradores gerenciam quadros; membros podem criar, editar e mover tarefas, e excluir apenas as que criaram. Recursos de terceiros respondem 404. Exclusões exigem confirmação na interface.

**Movimentação.** Arraste pela alça para organizar as tarefas entre as colunas do quadro. O menu **Mover tarefa** permite escolher coluna e posição com mouse, teclado e touch. A interface antecipa a ordem, reverte em caso de falha e reconcilia os dados com a API.

O servidor valida a coluna e a posição e bloqueia o quadro durante escritas de tarefas. A transação mantém a ordem contígua na origem e no destino, inclusive com operações concorrentes.

**Dashboard.** As contagens usam `ColumnStatus`: total, `IN_PROGRESS`, `DONE` e prazos anteriores ao dia civil atual fora de `DONE`. Progresso é a porcentagem arredondada de concluídas; quadros vazios não recebem porcentagem fictícia. Até cinco tarefas aparecem em atenção: atrasadas, prazo até os próximos sete dias e depois prioridade alta/urgente. A tela consulta novamente ao entrar ou recuperar foco.

## Testes e build

```bash
npm --prefix apps/web run lint
npm --prefix apps/web test
npm --prefix apps/web run build
npm --prefix apps/server run lint
npm --prefix apps/server test
npm --prefix apps/server run build
```

Integração com banco real deve usar **um banco separado**, cujo nome comece com `taskflow_etapa07_test`. Nunca aponte os testes para dados de desenvolvimento que precisam ser preservados.

```bash
cd apps/server
# Configure DATABASE_URL para o banco isolado antes destes comandos.
npx prisma migrate deploy --config prisma7.config.ts
RUN_DATABASE_TESTS=true npm run test:e2e
npx prisma validate --config prisma7.config.ts
npx prisma migrate status --config prisma7.config.ts
```

As suítes de navegador existentes e a nova auditoria estão documentadas em [apps/web/README.md](apps/web/README.md). Resultados executados, arquivos alterados, limitações e evidências visuais: [relatório da etapa 07](docs/ETAPA_07.md).
