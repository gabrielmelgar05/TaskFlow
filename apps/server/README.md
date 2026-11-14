# TaskFlow — API

API NestJS 12 em TypeScript/ESM, com Prisma 7 e adapter PostgreSQL. A aplicação usa `/api` como prefixo global. O frontend e o backend permanecem independentes.

## Executar

Requer Node.js 24, npm e PostgreSQL 17. Na raiz, `docker compose up -d db` inicia o PostgreSQL local na porta **5433**.

```bash
npm ci
cp .env.example .env
# Preencha DATABASE_URL usando seu PostgreSQL local.
npx prisma generate --config prisma7.config.ts
npx prisma migrate deploy --config prisma7.config.ts
npm run start:dev
```

`prisma7.config.ts` declara o schema, as migrações e a URL lida do ambiente. Não use reset para atualizar o banco.

| Variável           | Uso                                                                         |
| ------------------ | --------------------------------------------------------------------------- |
| `DATABASE_URL`     | URL privada do PostgreSQL                                                   |
| `PORT`             | Porta da API, padrão 3001                                                   |
| `CORS_ORIGIN`      | Lista explícita de origens, separadas por vírgula                           |
| `NODE_ENV`         | development, test ou production                                             |
| `COOKIE_SECURE`    | false em HTTP local; obrigatório true em produção                           |
| `SESSION_TTL_DAYS` | Expiração de sessão, de 1 a 30 dias; padrão 7                               |
| `API_PROXY_SECRET` | Segredo privado compartilhado com a Pages Function; obrigatório em produção |

## Endpoints

| Método e rota, após `/api`                                | Comportamento                                                      |
| --------------------------------------------------------- | ------------------------------------------------------------------ |
| `GET /health`                                             | Verifica PostgreSQL, sem autenticação                              |
| `POST /auth/register`, `POST /auth/login`                 | Criam sessão e cookie                                              |
| `GET /auth/me`, `POST /auth/logout`                       | Consultam e invalidam a sessão                                     |
| `GET/POST /workspaces`                                    | Listam e criam espaços do usuário                                  |
| `PATCH/DELETE /workspaces/:id`                            | Renomeiam e excluem com autorização                                |
| `GET /workspaces/:id/members`                             | Lista apenas id e nome dos participantes                           |
| `GET/POST /workspaces/:id/boards`                         | Listam e criam quadros                                             |
| `GET/PATCH/DELETE /boards/:id`                            | Consultam, renomeiam e excluem quadro                              |
| `GET/POST /boards/:id/tasks`                              | Listam e criam tarefas                                             |
| `GET/PATCH/DELETE /tasks/:id`                             | Consultam, editam e excluem tarefa                                 |
| `PATCH /tasks/:id/move`                                   | Move coluna/posição dentro do quadro; devolve sua ordem confirmada |
| `GET /tasks/summary?today=AAAA-MM-DD`                     | Contagens dos workspaces acessíveis                                |
| `GET /dashboard/summary?workspaceId=...&today=AAAA-MM-DD` | Métricas, atenção e progresso do workspace                         |

## Autenticação e segurança

Senhas usam Argon2id. Sessões usam 32 bytes aleatórios, token no cookie `HttpOnly`, `SameSite=Lax`, `Secure` em produção, e somente SHA-256 no banco. Sessões expiram no servidor; logout invalida imediatamente a sessão atual. Respostas privadas têm `Cache-Control: no-store`.

Guards exigem sessão por padrão, verificam `Origin` em operações mutáveis e validam o segredo do proxy quando configurado. Login e cadastro têm limites por IP e e-mail normalizado. O IP encaminhado só é aceito com proxy autenticado. DTOs validam tipos, limites, datas civis e rejeitam propriedades extras. Erros Prisma retornam mensagens seguras, sem SQL ou credenciais.

Associações isolam workspaces. OWNER e ADMIN gerenciam quadros; apenas OWNER exclui workspace. Todos os participantes podem criar, editar e mover tarefas. MEMBER só exclui tarefas que criou. Responsáveis precisam participar do workspace. O backend revalida permissões independentemente da interface; IDs inacessíveis retornam 404.

## Ordenação e concorrência

`PATCH /tasks/:id/move` recebe a coluna e a posição dentro do quadro atual. O backend verifica a participação do usuário, a coluna e os limites da posição. A resposta contém as tarefas do quadro com a ordem confirmada.

Criação, exclusão e movimentação adquirem `FOR UPDATE` na linha do quadro durante a transação. A mudança de coluna e a compactação da ordem são atômicas. Falhas revertem toda a operação, preservando as tarefas e evitando posições duplicadas entre operações concorrentes.

## Indicadores

`ColumnStatus` define TODO, IN_PROGRESS e DONE independentemente do nome da coluna. As métricas são agregadas no banco em snapshot `RepeatableRead`; atraso compara a data civil recebida com `dueAt`, excluindo concluídas. O progresso é arredondado de concluídas/total; vazio retorna null. A atenção limita a cinco tarefas, priorizando atraso, prazo entre hoje e sete dias à frente e depois alta/urgente. Datas de prazo são armazenadas em UTC à meia-noite e exibidas como datas civis, sem deslocamento pelo fuso.

## Validar

```bash
npm run lint
npm test
npm run build
npx prisma validate --config prisma7.config.ts
npx prisma migrate status --config prisma7.config.ts
npm audit
```

As suítes com banco exigem um **PostgreSQL de teste separado**, com nome `taskflow_etapa07_test*`. Configure `DATABASE_URL` somente para ele:

```bash
npx prisma migrate deploy --config prisma7.config.ts
RUN_DATABASE_TESTS=true NODE_ENV=test npm run test:e2e
```

Vitest executa suites HTTP + PostgreSQL sequencialmente porque algumas simulam falhas com triggers temporários. Os fixtures e triggers próprios são removidos ao terminar; nunca execute contra dados que devem ser preservados. O teste histórico `test/column-status-migration.mjs` exige outro banco novo e vazio `taskflow_etapa06_migration_test*`; ele verifica a migração anterior, não uma migração nova desta etapa.

Os overrides de Undici e tmp corrigem dependências transitivas do tooling, sem downgrade do Nest ou alteração da API de runtime. Os limites de autenticação são locais à instância e sessões expiradas continuam armazenadas. Recuperação de senha, confirmação de e-mail e gestão de convites não fazem parte desta etapa.

Resultados e evidências executados: [relatório da etapa 07](../../docs/ETAPA_07.md).
