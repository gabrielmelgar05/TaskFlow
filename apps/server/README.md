# TaskFlow — API (Etapa 06)

NestJS 12 + TypeScript/ESM + Prisma 7/PrismaPg + PostgreSQL. A Etapa 06 acrescenta dashboard por workspace e um status explícito de coluna, preservando autenticação, permissões e Kanban. A seção **Etapa 06** contém o funcionamento atual e a migração incremental; os resultados das etapas anteriores ficam como histórico.

## Executar localmente

Use Node.js 24 LTS e npm. Na raiz do repositório:

```bash
docker compose up -d db
```

O Prisma resolve a configuração a partir do diretório atual. Para gerar o client e aplicar as migrações, execute em **apps/server**:

```bash
npm exec -- prisma generate --config prisma7.config.ts
npm exec -- prisma migrate deploy --config prisma7.config.ts
npm run start:dev
```

A API usa `http://localhost:3001/api`. Em outro terminal, na raiz, execute `npm --prefix apps/web run dev` e abra `http://localhost:3000`. As dependências desta entrega já estão instaladas. Em um checkout novo, execute `npm ci` em cada aplicação.

O `ConfigModule` carrega `apps/server/.env`, que permanece privado. Em um checkout novo, copie `.env.example` apenas se `.env` ainda não existir e configure seu banco. O Compose existente publica PostgreSQL na porta `5433`.

| Variável | Desenvolvimento | Produção |
| --- | --- | --- |
| `DATABASE_URL` | URL privada do PostgreSQL local | URL PostgreSQL/SSL fornecida pela Neon, somente no backend |
| `PORT` | `3001` por padrão | Porta fornecida pelo Render |
| `CORS_ORIGIN` | `http://localhost:3000` | Origem HTTPS exata do site, por exemplo `https://seu-projeto.pages.dev` |
| `NODE_ENV` | `development` | `production` |
| `COOKIE_SECURE` | `false` para HTTP local | `true`, obrigatório |
| `SESSION_TTL_DAYS` | `7` por padrão; inteiro entre 1 e 30 | Mesmo limite, conforme a política desejada |
| `API_PROXY_SECRET` | Opcional; deixe ausente no acesso local direto | Obrigatório, aleatório e com pelo menos 32 caracteres; mesmo valor na Pages Function |

`CORS_ORIGIN` aceita uma lista explícita separada por vírgulas, sem caminho nem barra final. `localhost`, `127.0.0.1`, portas distintas e HTTP/HTTPS são origens diferentes. Para testar Wrangler, adicione `http://localhost:8788` e/ou `http://127.0.0.1:8788` à lista. A API usa CORS com credenciais e não permite `*`.

## Endpoints

| Método | Caminho | Acesso e resposta |
| --- | --- | --- |
| GET | `/api/health` | Público, inclusive diretamente no Render. Consulta PostgreSQL; 200 ou 503. |
| POST | `/api/auth/register` | Público, com Origin permitido e rate limiting. Recebe `name`, `email`, `password`; responde 201, dados públicos e cookie. |
| POST | `/api/auth/login` | Público, com Origin permitido e rate limiting. Recebe `email`, `password`; responde 200, dados públicos e cookie. |
| GET | `/api/auth/me` | Sessão válida obrigatória; responde 200 e usuário público. |
| POST | `/api/auth/logout` | Sessão válida e Origin permitido; invalida a sessão atual, remove o cookie e responde 204. |

Uma resposta autenticada contém somente:

```json
{ "user": { "id": "identificador", "name": "Seu nome", "email": "voce@exemplo.com" } }
```

Falhas: **400** para campos inválidos; **401** para credenciais ou sessão inválidas; **403** para Origin/proxy não permitido; **409** para e-mail duplicado; **429** para limite de tentativas, com `Retry-After`; **503** para falha no acesso ao banco. Senhas, hashes e tokens nunca entram no JSON público nem nas mensagens de erro.

## Como funciona a autenticação

1. O DTO valida o nome, normaliza o e-mail com `trim` e minúsculas e valida a senha. O nome pode ter até 100 caracteres; o e-mail, até 254. Campos extras são rejeitados.
2. No cadastro, a senha precisa ter entre **15 e 128 caracteres**. Espaços e frases longas são aceitos; não há exigências artificiais de símbolos, maiúsculas ou números. A senha não é aparada nem transformada.
3. O `PasswordService` usa **Argon2id**, com salt e parâmetros do pacote. A senha original nunca é persistida.
4. O cadastro cria usuário e sessão na mesma operação aninhada do Prisma. A unicidade do PostgreSQL resolve a corrida entre cadastros concorrentes.
5. No login, a busca usa igualdade pelo e-mail já normalizado. `%` e `_` não funcionam como curingas. Credenciais erradas e conta inexistente recebem a mesma mensagem. Uma verificação Argon2 também ocorre quando a conta não existe, para reduzir diferenças de tempo.
6. A sessão usa **32 bytes aleatórios** de `node:crypto`, codificados em base64url. Somente o **SHA-256 do token** vai para o banco. Diferentemente de uma senha escolhida por uma pessoa, esse token já tem alta entropia, por isso não precisa de Argon2.
7. O navegador recebe `taskflow_session` com `HttpOnly`, `SameSite=Lax`, `Path=/`, expiração persistente e `Secure` em produção/HTTPS. Não existe atributo `Domain`.
8. A cada requisição privada, o `AuthGuard` lê o cookie, calcula seu hash, consulta a sessão, valida a expiração no servidor e obtém apenas os dados públicos do usuário.
9. O logout marca a sessão atual como expirada e remove o cookie com os mesmos atributos. O token antigo deixa de funcionar imediatamente; outras sessões do usuário continuam válidas.

O `AuthGuard` é global: novas rotas exigem sessão por padrão. Somente rotas marcadas com `@Public()` dispensam a sessão. Os módulos de workspaces e quadros complementam esse guard: verificam a associação e o papel do usuário antes de permitir a operação.

## CSRF, proxy confiável e limite de tentativas

O `OriginGuard` global exige um `Origin` exato permitido em operações mutáveis, inclusive cadastro, login e logout. Ausência de Origin, `null` e origens externas são rejeitados. `HttpOnly` impede leitura do cookie por JavaScript, mas não substitui a proteção contra CSRF.

Em produção, a Pages Function envia um segredo compartilhado no cabeçalho `X-Taskflow-Proxy-Secret`. O backend compara esse valor sem comparar conteúdo em tempo variável. A API de autenticação não aceita chamadas diretas sem esse segredo; `/api/health` permanece acessível. O segredo existe somente nos ambientes do servidor.

O IP original encaminhado em `X-Taskflow-Client-IP` só é usado depois da verificação do segredo; a Pages Function o obtém do `CF-Connecting-IP` fornecido pela Cloudflare. Não habilitamos confiança genérica em `X-Forwarded-For`. Em desenvolvimento direto, o IP vem da conexão HTTP.

`@nestjs/throttler` aplica, separadamente por endpoint:

- Login: **20 requisições/minuto por IP** e **10 requisições/15 minutos por conta**.
- Cadastro: **5 requisições/minuto por IP** e **3 requisições/15 minutos por conta**.
- Contas são comparadas pelo e-mail normalizado. O Throttler armazena chaves com hash, sem guardar o e-mail na chave em texto.

Os contadores ficam na memória de uma instância da API e reiniciam com o processo. Compartilhamento entre várias réplicas exigirá um storage apropriado em outra etapa. O endpoint de saúde não entra nesses limites.

## Prisma e migração

O modelo `User` original foi reutilizado. A única relação adicionada ao schema foi `User.sessions`, acompanhada do modelo `Session`:

```text
Session: id, userId, tokenHash único, createdAt, expiresAt
User 1 ─── N Session
```

A migração **`20261110060000_add_auth_sessions`** cria a tabela e seus índices/FK. Também cria o índice funcional único `User_email_lower_key` em `lower(email)`, necessário para impedir duplicação por caixa inclusive em gravações concorrentes ou fora do DTO. Esse índice é SQL, pois não é representado como um campo extra no schema Prisma.

A migração usa transação e não remove dados ou tabelas. A migração inicial e os demais modelos foram preservados. Antes de aplicá-la, foi feita inspeção de contagem/duplicidade: o banco local estava sem usuários e sem e-mails duplicados. Nenhum dado existente precisou ser alterado.

Sessões expiradas são rejeitadas em toda consulta. Esta etapa mantém os registros expirados, inclusive após logout; uma política de limpeza futura poderá reduzir o tamanho da tabela sem mudar a validade das sessões.

## Arquivos criados e modificados

Criados:

| Arquivo | Responsabilidade |
| --- | --- |
| `src/auth/auth.module.ts` | Reúne Prisma, Throttler, serviços, controller e guards globais. |
| `src/auth/auth.controller.ts` | Endpoints HTTP e criação/remoção do cookie. |
| `src/auth/auth.service.ts` | Cadastro atômico, login, criação, consulta e invalidação de sessões. |
| `src/auth/auth.types.ts` | Tipos do usuário público e da requisição autenticada; seleção segura do Prisma. |
| `src/auth/password.service.ts` | Hash/verificação Argon2id e hash de comparação para conta inexistente. |
| `src/auth/session-cookie.ts` | Nome e atributos compartilhados do cookie. |
| `src/auth/public.decorator.ts` | Marcação explícita das rotas públicas. |
| `src/auth/dto/register.dto.ts` e `login.dto.ts` | Validação/normalização com class-validator e class-transformer. |
| `src/auth/guards/auth.guard.ts` | Verificação do proxy e da sessão; proteção da API por padrão. |
| `src/auth/guards/origin.guard.ts` | Proteção contra CSRF em operações mutáveis. |
| `src/auth/guards/auth-throttler.guard.ts` | Limites por IP confiável e conta; resposta 429 com Retry-After. |
| `src/config/validation.ts` | ValidationPipe explícito para cada DTO, sem expor valores inválidos. |
| `test/auth.e2e-spec.ts` | Testes HTTP e integração real, incluindo sessão, segurança e concorrência. |
| `prisma/migrations/20261110060000_add_auth_sessions/migration.sql` | Migração aditiva de sessões e unicidade de e-mail. |

Modificados: `src/app.module.ts` registra AuthModule; `src/configure-app.ts` permite POST e CORS com credenciais; `src/config/environment.ts` e seu teste validam as opções de sessão/produção; `src/health/health.controller.ts` mantém saúde explicitamente pública; `prisma/schema.prisma` adiciona sessões; `.env.example` documenta as opções; `package.json` e `package-lock.json` registram as dependências; este README documenta a etapa.

Dependências adicionadas: **`argon2` 0.45.2**, para hash de senha; **`@nestjs/throttler` 6.7.1**, exigido para limites de tentativas; **`cookie` 1.1.1**, para interpretar cookies sem parser improvisado. Não foram adicionados JWT, Passport ou outra camada de autenticação: a sessão solicitada é verificada diretamente no banco.

## Testar manualmente

Pelo navegador, crie uma conta em `/cadastro/`, recarregue a Visão geral, navegue para Quadros, abra o perfil e saia. Depois, tente abrir `/quadros/` sem sessão e faça login novamente.

Pela API, com e-mail de teste único e uma senha de exemplo, em um terminal:

```bash
curl -i -c /tmp/taskflow-cookies.txt http://localhost:3001/api/auth/register \
  -H 'Origin: http://localhost:3000' -H 'Content-Type: application/json' \
  --data '{"name":"Pessoa Teste","email":"seu-teste-unico@example.invalid","password":"Uma frase bem longa de teste!"}'

curl -i -b /tmp/taskflow-cookies.txt http://localhost:3001/api/auth/me

curl -i -b /tmp/taskflow-cookies.txt -c /tmp/taskflow-cookies.txt \
  -H 'Origin: http://localhost:3000' -X POST http://localhost:3001/api/auth/logout

curl -i -c /tmp/taskflow-cookies.txt http://localhost:3001/api/auth/login \
  -H 'Origin: http://localhost:3000' -H 'Content-Type: application/json' \
  --data '{"email":"seu-teste-unico@example.invalid","password":"Uma frase bem longa de teste!"}'
```

O cookie jar é apenas uma ferramenta de teste do curl. A aplicação não persiste tokens em localStorage/sessionStorage. Se repetir o cadastro com o mesmo e-mail, a resposta será 409. Esses exemplos supõem desenvolvimento direto sem `API_PROXY_SECRET`.

## Testes e verificações

Na raiz:

```bash
npm --prefix apps/server run build
npm --prefix apps/server run lint
npm --prefix apps/server test
npm --prefix apps/server run test:e2e
DATABASE_URL='postgresql://taskflow:taskflow_dev_123@localhost:5433/taskflow_etapa04_test_20261112?schema=public' RUN_DATABASE_TESTS=true npm --prefix apps/server run test:e2e
```

O último comando habilita os testes com PostgreSQL real. Prepare antes o banco isolado conforme a seção Etapa 04; a nova suíte rejeita nomes de banco fora de `taskflow_etapa04_test*`. Nos testes anteriores de autenticação: são criadas contas únicas `auth-e2e-*`/`auth-test-*` com domínio `example.invalid`. Nenhuma conta anterior é alterada ou removida. Os testes mantêm esses registros isolados; não há comando de limpeza de dados. Sem a variável, os testes de banco ficam explicitamente ignorados, enquanto saúde com mock e rate limiting continuam executando.

Os testes cobrem cadastro válido, DTOs, e-mail duplicado, unicidade no banco, concorrência, senha inválida, login correto/incorreto, e-mail exato, sessão válida/inválida/expirada, logout e reuso do token, atributos do cookie, CORS, CSRF, proxy confiável, rate limiting, proteção padrão e ausência de dados privados no JSON.

A validação completa também passou pelo Chrome + Wrangler/workerd: o navegador usou `/api`, que encaminhou as requisições ao NestJS e ao PostgreSQL real. A instância temporária da API foi encerrada para verificar 502 seguro no proxy e mensagem de conexão no frontend, sem redirecionamento indevido para login. O processo já existente na porta 3001 não foi interrompido; os testes de navegador usaram uma instância isolada na porta 3101.

### Resultado histórico da Etapa 03

| Verificação executada | Resultado |
| --- | --- |
| Build do NestJS | Passou |
| Lint do backend | Passou, sem avisos |
| Testes de configuração | **25 passaram** |
| Testes HTTP com `RUN_DATABASE_TESTS=true` | **29 passaram**, incluindo integração real |
| `prisma validate` | Schema válido |
| `prisma migrate status` | Duas migrações aplicadas; banco atualizado |
| Fluxo real pelo navegador e Wrangler | Passou; inclui sessão persistente, expiração, logout e API indisponível |

## Futuro deploy: Render + Neon + Cloudflare Pages

Não foi feito deploy nesta etapa. No Render, a raiz da API será `apps/server`; gere o Prisma Client, execute o build e use `npm run start:prod`. A porta é fornecida pelo ambiente. Configure a URL privada da Neon, `NODE_ENV=production`, `COOKIE_SECURE=true`, a origem HTTPS do Pages e o segredo compartilhado. A migração deve ser aplicada com `prisma migrate deploy`, sem reset.

Em uma instalação de build com `NODE_ENV=production`, inclua as dependências de desenvolvimento necessárias para compilar (`npm ci --include=dev`). O backend não precisa compartilhar domínio com o Pages: quem conversa com ele é a Pages Function. O navegador usa o host `pages.dev` para `/api` e para o cookie. Veja [o README do frontend](../web/README.md) para comandos Wrangler e configuração das Functions.

Auditoria executada: **nenhuma vulnerabilidade nas dependências de produção da API** (`npm audit --omit=dev`). A auditoria completa encontrou 5 alertas em ferramentas de desenvolvimento, na cadeia existente de `@nestjs/mau` (2 altos, 1 moderado e 2 baixos). Não foi aplicado `audit fix --force`, que propôs mudança incompatível nessa ferramenta de deploy fora do escopo da etapa. Esses alertas precisam de revisão de manutenção antes de utilizar essa ferramenta.

Referências: [NestJS rate limiting](https://docs.nestjs.com/security/rate-limiting), [node-argon2](https://github.com/ranisalt/node-argon2), [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [deploy de serviços no Render](https://render.com/docs/deploys).

## Explicação para entrevistas

1. **Autenticação:** verifica quem está usando o sistema. Aqui, a senha comprova a identidade no login; a sessão comprova a identidade nas próximas requisições.
2. **Autorização:** verifica o que essa pessoa pode acessar ou alterar. Estar autenticado não permitirá, por si só, acessar os quadros de outra pessoa. Essa regra é aplicada nos services de workspaces e quadros, usando WorkspaceMember.
3. **Senhas não são salvas diretamente:** um vazamento de texto puro entregaria imediatamente todas as senhas. O banco guarda somente o resultado do hash.
4. **Hash de senha:** transformação de mão única, com salt e custo de processamento/memória. Argon2id verifica se a senha recebida corresponde ao resultado armazenado; não precisamos recuperar a senha original.
5. **Sessão:** registro no servidor que liga um token aleatório a um usuário e a uma data de expiração. Ela permite reconhecer requisições seguintes e encerrar o acesso no logout.
6. **Cookie HTTP-only:** o navegador guarda e envia o cookie, mas o JavaScript da página não consegue ler seu conteúdo. `Secure` restringe seu envio a HTTPS; `SameSite` ajuda a limitar requisições entre sites. A validação de Origin complementa essa proteção.
7. **AuthGuard:** guard do NestJS executado antes do controller. Ele rejeita sessões ausentes/inválidas/expiradas e anexa o usuário público à requisição quando a sessão é válida.
8. **Como React sabe da sessão:** chama `/api/auth/me` com `credentials: "include"`. O `AuthProvider` guarda somente o estado e os dados públicos em memória. Ao atualizar a página, essa consulta é feita novamente usando o cookie persistido pelo navegador.
9. **Como Prisma recupera o usuário:** no login, faz busca exata pelo e-mail normalizado. Nas requisições privadas, busca `Session` pelo hash do token e segue a relação `session.user`, selecionando apenas `id`, `name` e `email`.
10. **Quando a sessão expira:** o backend retorna 401 mesmo que alguém ainda tenha o token. O frontend deixa de exibir a área privada e encaminha para login. Uma falha de rede ou do banco recebe outro tratamento: mensagem de conexão e nova tentativa, sem concluir que a sessão é inválida.


## Etapa 04 — workspaces e quadros

### Endpoints e permissões

Todos exigem a sessão HTTP-only existente. POST/PATCH/DELETE também exigem um `Origin` permitido. O usuário vem de `request.auth.user.id`; o JSON de entrada aceita somente `{ "name": "Nome" }`. Campos como `userId`, `role` ou `workspaceId` no corpo são rejeitados.

| Método | Endpoint | Permissão | Resposta |
| --- | --- | --- | --- |
| GET | `/api/workspaces` | Qualquer usuário autenticado; somente suas associações | Array de `{ id, name, role }` |
| POST | `/api/workspaces` | Qualquer usuário autenticado | 201, workspace com papel OWNER |
| GET | `/api/workspaces/:id` | OWNER, ADMIN, MEMBER | `{ id, name, role }` |
| PATCH | `/api/workspaces/:id` | OWNER, ADMIN | Workspace renomeado |
| DELETE | `/api/workspaces/:id` | OWNER | 204; cascata dos descendentes |
| GET | `/api/workspaces/:workspaceId/boards` | OWNER, ADMIN, MEMBER | Array de quadros do workspace |
| POST | `/api/workspaces/:workspaceId/boards` | OWNER, ADMIN | 201, quadro e três colunas persistidos |
| GET | `/api/boards/:id` | OWNER, ADMIN, MEMBER | Quadro, workspace com papel do usuário e colunas ordenadas |
| PATCH | `/api/boards/:id` | OWNER, ADMIN | Quadro renomeado |
| DELETE | `/api/boards/:id` | OWNER, ADMIN | 204; cascata das colunas |

Nomes têm de 1 a 100 caracteres, recebem trim e normalização de espaços repetidos. Aceitam letras Unicode, acentos, números e pontuação simples; rejeitam controles, quebras de linha e marcação HTML. A mesma regra aparece no frontend para dar feedback antecipado. Nome repetido é permitido: a identidade é o ID.

Recursos inexistentes e recursos de terceiros recebem **404**. Um membro conhecido sem o papel exigido recebe **403**. DTO inválido recebe **400**; sessão inválida, **401**; falha Prisma, **503**, sem detalhes internos. O filtro dos novos módulos trata falhas do banco sem convertê-las em sessão expirada. As respostas de sucesso têm `Cache-Control: no-store`. O CORS foi ampliado para PATCH e DELETE; os limites de login/cadastro existentes foram preservados.

A listagem de workspaces usa criação crescente e ID como desempate; a de quadros usa a mesma ordem. Colunas usam `position` crescente, depois ID. A consulta de detalhes apenas lê; não cria colunas.

### Arquivos da etapa

```text
src/
  workspaces/
    workspaces.module.ts       # registra e exporta o service
    workspaces.controller.ts   # cinco endpoints HTTP
    workspaces.service.ts      # associação, papéis e consultas Prisma
    dto/create-workspace.dto.ts
    dto/update-workspace.dto.ts
  boards/
    boards.module.ts           # importa WorkspacesModule e PrismaModule
    boards.controller.ts      # endpoints de quadros
    boards.service.ts         # autorização e criação aninhada das colunas
    dto/create-board.dto.ts
    dto/update-board.dto.ts
  common/
    dto/resource-name.dto.ts   # validação compartilhada dos quatro DTOs
    resource-errors.filter.ts # resposta segura para erros Prisma
  app.module.ts               # registra os dois módulos novos
  configure-app.ts            # CORS com PATCH/DELETE
test/workspaces-boards.e2e-spec.ts
```

Não há dependências novas nem alterações em User, Session, Task, schema ou migrações. Workspace, WorkspaceMember, Board e BoardColumn já existiam. As duas migrações anteriores foram reaplicadas **somente em um banco de teste novo**, sem reset.

### Relações, atomicidade e isolamento

```text
User 1 ── N WorkspaceMember N ── 1 Workspace
                   role                  1
                                         │
                                         N Board
                                         1
                                         │
                                         N BoardColumn
                                         1
                                         │
                                         N Task (sem endpoints nesta etapa)
```

`WorkspaceMember` tem unicidade de `(userId, workspaceId)`: uma pessoa tem um papel por workspace. Excluir Workspace remove suas associações e quadros; excluir Board remove suas colunas; a política já existente também remove tarefas descendentes. Nenhum outro workspace entra no filtro de exclusão.

A criação aninhada `workspace.create({ data: { name, members: { create: ... } } })` confirma o workspace e seu OWNER juntos. `board.create` cria o quadro e as três colunas **A fazer (0)**, **Em andamento (1)** e **Concluído (2)** juntos. Se uma inserção falhar, o banco reverte o conjunto. As escritas incluem novamente a associação e os papéis no filtro Prisma, além da verificação do service.

### Executar os testes com banco isolado

Use Node.js 24 e npm; PostgreSQL do Compose deve estar ativo. Na raiz, crie um banco separado uma vez (se já existir, reutilize-o):

```bash
docker compose exec -T db createdb -U taskflow taskflow_etapa04_test_20261112
```

Em **apps/server**, sem modificar `.env`:

```bash
export DATABASE_URL='postgresql://taskflow:taskflow_dev_123@localhost:5433/taskflow_etapa04_test_20261112?schema=public'
npm exec -- prisma generate --config prisma7.config.ts
npm exec -- prisma validate --config prisma7.config.ts
npm exec -- prisma migrate deploy --config prisma7.config.ts
npm exec -- prisma migrate status --config prisma7.config.ts
npm run lint
npm run build
npm test
RUN_DATABASE_TESTS=true npm run test:e2e
```

A suíte da Etapa 04 cria quatro contas e seus próprios workspaces; limpa somente esses registros ao terminar. Para verificar a atomicidade de quadros, instala um trigger temporário que provoca falha na terceira coluna e depois o remove. Por isso, essa suíte exige um nome de banco `taskflow_etapa04_test*`. Não execute com o banco da aplicação. A suíte anterior de autenticação preserva suas contas isoladas de teste no mesmo banco separado. Sem `RUN_DATABASE_TESTS=true`, os testes de banco ficam explicitamente ignorados.

### Resultados da Etapa 04 — 12/11/2026

| Verificação executada | Resultado |
| --- | --- |
| Build NestJS e lint | Passaram |
| Testes de configuração | 25 passaram |
| Suíte HTTP completa com PostgreSQL | 45 passaram: 29 existentes + 16 novos |
| Prisma validate | Schema válido |
| Migrate deploy/status no banco isolado | Duas migrações aplicadas; atualizado |
| Reversão de workspace e quadro incompleto | Verificada com falha real de FK e trigger PostgreSQL |
| IDOR, MEMBER, ADMIN, OWNER, CSRF, CORS e sessão | Verificados via HTTP real |
| Persistência | Dados e sessão consultados por outra instância NestJS |
| Frontend integrado | 19 testes unitários e 13 verificações de navegador aprovados; detalhes no README web |

O banco original da aplicação não foi migrado nem limpo nesta validação. Não houve reset, deploy, git add, commit, push ou merge. O aviso de build do Next.js sobre um package-lock fora do repositório é do ambiente e não impede a exportação. Detalhes do roteiro de navegador estão no [README web](../web/README.md#etapa-04--experiência-de-quadros).

### Explicação da Etapa 04 para entrevistas

1. **Workspace:** espaço que agrupa projetos. Exemplo: “Meu portfólio” contém vários quadros. Cada workspace tem suas próprias associações e permissões.
2. **Quadro Kanban:** visão de um projeto separada por etapas. “TaskFlow” começa com A fazer, Em andamento e Concluído. Nesta etapa só gerenciamos o quadro e lemos suas colunas.
3. **CRUD:** Create, Read, Update, Delete: criar, consultar, renomear e excluir workspaces/quadros. Cada ação corresponde a um método HTTP.
4. **Controller:** recebe a chamada HTTP, aplica o DTO e entrega usuário/entrada ao service. Exemplo: `POST /workspaces` chama `workspaces.create` com o ID da sessão.
5. **Service:** concentra as regras. Antes de renomear um workspace, verifica se o usuário é OWNER ou ADMIN e só depois pede a alteração ao Prisma.
6. **DTO:** define a entrada aceita. Aqui, o nome deve ser uma string válida com até 100 caracteres; `userId` arbitrário é rejeitado antes de chegar ao service.
7. **Relação entre tabelas:** uma chave estrangeira liga registros. `Board.workspaceId` aponta para `Workspace.id`, permitindo buscar os quadros de um workspace e aplicar sua cascata de exclusão.
8. **WorkspaceMember:** tabela que liga usuários e workspaces e guarda o papel OWNER/ADMIN/MEMBER. Uma pessoa pode pertencer a vários espaços e um espaço pode ter várias pessoas. Não há gestão dessas associações pela interface nesta etapa.
9. **Transação:** garante tudo ou nada. Se falhar a criação da terceira coluna, nenhum quadro incompleto fica salvo. As criações aninhadas do Prisma executam esse conjunto atomicamente.
10. **Impedir acesso a dados alheios:** autenticar a sessão e filtrar a consulta pela associação do usuário. Saber o ID de um quadro não dá acesso; sem associação a API responde 404. A UI esconder botões é apenas conveniência.
11. **Como React recebe a API:** `useApiResource` chama o cliente HTTP com cookies, recebe JSON e atualiza o estado. Respostas atrasadas são descartadas ao trocar de workspace. O estado exibe o resultado do banco; não substitui sua persistência.
12. **Como PostgreSQL salva:** formulário → cliente HTTP → controller/DTO → service com autorização → Prisma → PostgreSQL. Só após sucesso a interface confirma a operação e consulta novamente a lista. Recarregar executa novas consultas ao mesmo banco.

Referências da implementação: [validação NestJS](https://docs.nestjs.com/techniques/validation) e [Prisma 7: nested writes](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries#nested-writes). A documentação atual do Prisma pode apresentar APIs de versões posteriores; este projeto mantém o Prisma 7 instalado.

Na entrega da Etapa 04, tarefas e movimentação ficaram pendentes. Elas são implementadas na Etapa 05 abaixo. Convites e gestão de membros continuam fora do escopo.


## Etapa 05 — gerenciamento de tarefas

### Módulo, arquivos e responsabilidades

```text
src/tasks/
  tasks.module.ts          # registra PrismaService, controller e service
  tasks.controller.ts      # rotas, DTOs, sessão e Cache-Control: no-store
  tasks.service.ts         # autorização, responsáveis e transações de ordenação
  dto/
    create-task.dto.ts     # título e coluna obrigatórios
    update-task.dto.ts     # altera apenas informações da tarefa
    move-task.dto.ts       # destino e posição inteira
    task-fields.dto.ts     # descrição, prioridade, prazo e responsável
    task-summary.dto.ts    # data civil usada nas contagens de atraso
```

Modificados: `src/app.module.ts` registra TasksModule; `workspaces.controller.ts` e `workspaces.service.ts` acrescentam somente a consulta de membros para o seletor de responsáveis. `test/tasks.e2e-spec.ts` testa a API com PostgreSQL real. `vitest.config.e2e.ts` executa arquivos em sequência porque os testes de rollback usam triggers temporários; a concorrência das requisições continua sendo testada dentro da suíte. A proteção do teste da Etapa 04 passou a aceitar também o prefixo de banco isolado da Etapa 05. Não há dependência nova no backend.

### Endpoints

Todas as rotas abaixo exigem sessão. Escritas também passam pelo OriginGuard/CSRF existente. O AuthGuard e o rate limiting de autenticação não foram substituídos.

| Método | Endpoint | Entrada e resposta |
| --- | --- | --- |
| GET | `/api/boards/:boardId/tasks` | Lista plana das tarefas autorizadas do quadro |
| POST | `/api/boards/:boardId/tasks` | Cria no final da coluna; responde 201 com a tarefa |
| GET | `/api/tasks/:id` | Detalhes da tarefa |
| PATCH | `/api/tasks/:id` | Atualiza informações; responde com a tarefa |
| DELETE | `/api/tasks/:id` | Exclui e compacta a coluna; responde 204 |
| PATCH | `/api/tasks/:id/move` | Recebe `{ columnId, position }`; devolve todas as tarefas do quadro na ordem confirmada |
| GET | `/api/workspaces/:id/members` | Somente `{ id, name }` dos membros; não altera associações |
| GET | `/api/tasks/summary?today=2026-11-13` | Contagens de tarefas acessíveis no dia civil informado |

Exemplo de criação, sem `creatorId`:

```json
{
  "title": "Preparar apresentação do TaskFlow",
  "description": "Explicar a autenticação e demonstrar o Kanban.",
  "priority": "HIGH",
  "dueAt": "2026-11-20",
  "assigneeId": null,
  "columnId": "ID_DA_COLUNA"
}
```

O título é obrigatório, de 1 a 200 caracteres, em uma linha. A descrição é texto simples opcional com até 5000 caracteres e pode ter parágrafos. A prioridade aceita LOW, MEDIUM, HIGH e URGENT; omitida na criação, usa MEDIUM. O prazo aceita exclusivamente uma data real `AAAA-MM-DD`. `assigneeId` é opcional e precisa pertencer ao workspace do quadro. `description`, `dueAt` e `assigneeId` podem receber `null` para limpar o campo na edição. Título e prioridade não aceitam `null`. Uma edição sem campos é rejeitada.

`columnId`, `position`, `creatorId` e outros campos extras são rejeitados no PATCH de edição. Coluna/posição são alteradas apenas por `/move`. O criador vem exclusivamente da sessão. A listagem seleciona somente id, título, descrição, prioridade, prazo, coluna, posição, datas e `{ id, name }` de criador/responsável. Não retorna e-mail, senha, hashes ou sessões. A ordem usa coluna, posição, criação e ID como desempate.

### Permissões e isolamento

| Operação em tarefas | OWNER | ADMIN | MEMBER |
| --- | --- | --- | --- |
| Criar, consultar, editar e mover | Sim | Sim | Sim |
| Excluir qualquer tarefa do workspace | Sim | Sim | Não |
| Excluir tarefa que criou | Sim | Sim | Sim |

As permissões administrativas de workspaces/quadros da Etapa 04 continuam iguais. Ser MEMBER agora permite trabalhar nos cartões, sem administrar o quadro. A API confirma a associação ao workspace tanto na busca quanto dentro da transação de escrita. Coluna de outro quadro, mesmo no mesmo workspace, é rejeitada. Responsável de outro workspace é rejeitado. Conhecer um ID não dá acesso.

Erros: **400** para DTO inválido, responsável/coluna inválidos e posição fora dos limites; **401** para sessão inválida; **403** para exclusão de tarefa alheia por MEMBER ou Origin inválido; **404** para recurso inexistente ou inacessível; **503** para falha Prisma, preservando o filtro seguro existente. A UI ocultar uma ação não substitui essa autorização.

### Persistência, ordenação e concorrência

O modelo Task e todas as relações/índices existentes foram reutilizados. Não houve alteração de schema, tabela ou migração. `Task.columnId` referencia BoardColumn; `creatorId` e `assigneeId` referenciam User. A política de cascata existente continua válida ao excluir quadros/workspaces.

As posições de uma coluna são inteiros consecutivos a partir de zero. Exemplo: A(0), B(1), C(2). Mover C para posição 0 resulta em C(0), A(1), B(2). Mover A para outra coluna remove A da origem, compacta a origem e insere A no índice validado do destino. Excluir B também compacta a coluna. Na criação, a posição é o tamanho atual da coluna, após normalização de eventuais lacunas.

Cada escrita executa uma transação Prisma curta. Antes de ler/alterar posições, ela obtém um **lock na linha do Board** com `SELECT ... FOR UPDATE OF b`. O SQL é parametrizado por Prisma, incluindo o usuário autenticado; não há interpolação de texto SQL arbitrário. As demais consultas são feitas pelo Prisma tipado. Todos os registros afetados são salvos na mesma transação; se uma atualização falhar, nenhuma posição parcial é confirmada. Apenas registros cuja posição/coluna muda precisam ser atualizados.

Duas escritas no mesmo quadro aguardam o mesmo lock, inclusive em processos diferentes da API. A segunda calcula a ordem a partir do estado já confirmado pela primeira. Quadros distintos continuam independentes. O resultado final segue a ordem de obtenção do lock; a última movimentação confirmada define o destino final daquele cartão. Não há garantia de colaboração em tempo real nem controle por versão. Uma posição que ficou inválida após outra operação recebe 400, permitindo atualizar e tentar novamente. Repetir o mesmo movimento absoluto não cria outra tarefa e mantém o destino consistente.

O timeout limita a espera/transação; uma falha devolve erro seguro e rollback. Isso evita introduzir Redis, WebSockets, filas ou outra infraestrutura nesta etapa. Para um portfólio com quadros pequenos, reindexar apenas as colunas afetadas é simples de estudar. Grandes quadros poderão exigir paginação e uma estratégia de posições mais espaçadas em evolução futura.

### Datas e indicadores reais

O formulário envia a data civil, por exemplo `2026-11-20`. A API grava `2026-11-20T00:00:00.000Z` no campo DateTime existente. A interface lê o dia UTC para mostrar o mesmo dia escolhido, sem conversão involuntária para a véspera. O prazo representa um **dia**, sem horário exato de entrega.

Atraso significa prazo anterior ao dia local atual e tarefa fora de Concluído. O frontend envia seu dia local em `today` para que o resumo use a mesma regra, mesmo que o servidor esteja em outro fuso. As contagens incluem somente tarefas de workspaces acessíveis. `summary` executa quatro COUNTs no PostgreSQL em uma transação de leitura RepeatableRead, sem transferir todos os cartões ao React. Em andamento e Concluído correspondem às posições 1 e 2 das três colunas fixas existentes.

### Executar e testar

Os comandos locais anteriores permanecem válidos: PostgreSQL via `docker compose up -d db`, API via `npm --prefix apps/server run start:dev`, frontend via `npm --prefix apps/web run dev`. Use Node.js 24 e npm. Nenhuma nova migração precisa ser aplicada ao banco da aplicação.

Para testes isolados, crie uma vez na raiz:

```bash
docker compose exec -T db createdb -U taskflow taskflow_etapa05_test_20261113
```

Em `apps/server`, sem editar o `.env` privado:

```bash
export DATABASE_URL='postgresql://taskflow:taskflow_dev_123@localhost:5433/taskflow_etapa05_test_20261113?schema=public'
npm exec -- prisma generate --config prisma7.config.ts
npm exec -- prisma validate --config prisma7.config.ts
npm exec -- prisma migrate deploy --config prisma7.config.ts
npm exec -- prisma migrate status --config prisma7.config.ts
npm run lint
npm run build
npm test
RUN_DATABASE_TESTS=true npm run test:e2e
```

O banco isolado recebe apenas as duas migrações existentes. A nova suíte cria cinco usuários, workspaces e quadros próprios, testa concorrência com requisições reais e limpa somente seus registros. O teste de falha instala um trigger temporário que rejeita a troca de coluna depois de outras posições já terem sido atualizadas, confirma o rollback integral e remove o trigger. Nunca execute esses testes no banco real da aplicação. Os testes históricos de autenticação mantêm suas contas de teste somente no banco isolado. Sem `RUN_DATABASE_TESTS=true`, os testes de banco são explicitamente ignorados.

### Resultados da Etapa 05

Validação executada em **13/11/2026**, usando PostgreSQL separado `taskflow_etapa05_test_20261113`:

| Verificação | Resultado real |
| --- | --- |
| Lint backend e frontend | Passaram, sem avisos |
| Build NestJS | Passou |
| Build estático Next.js/Webpack + TypeScript | Passou; `out/quadros/detalhes/index.html` e `_routes.json` presentes |
| Testes unitários de configuração | 25 passaram |
| Testes unitários frontend | 26 passaram em 5 arquivos |
| HTTP + PostgreSQL | 75 passaram: 45 anteriores + 30 da suíte de tarefas |
| Concorrência | 12 criações paralelas, 8 movimentos paralelos e 6 movimentos duplicados preservaram IDs e posições consecutivas |
| Rollback real | Trigger PostgreSQL provocou erro após reindexar a origem; todas as alterações e timestamps foram revertidos |
| Schema Prisma | Válido, sem alteração |
| Migrate deploy/status no banco isolado | Duas migrações existentes aplicadas; banco atualizado |
| Navegador — tarefas | 15 verificações completas passaram |
| Navegador — regressão Etapa 04 | 13 verificações completas passaram |
| Responsividade e console | Sem overflow da página entre 320 e 1440 px e sem erros JavaScript; capturas inspecionadas |

Os testes HTTP cobrem criação/validação/atribuição, edição e limpeza dos opcionais, permissões de todos os papéis, IDOR, CSRF, exclusão, movimentos, coluna vazia, persistência, resumo e as proteções anteriores. O roteiro de tarefas percorreu cadastro/login/logout reais, formulários, arrasto com mouse e teclado, cancelamento, alternativa por touch, falha com rollback, recarga e contagens. Respostas HTTP de falha foram injetadas no navegador para verificar os estados da UI; o rollback transacional foi testado com falha real no PostgreSQL.

Problema encontrado e corrigido: uma edição `{}` era aceita porque o DTO materializa campos opcionais com valor `undefined`. O service agora exige ao menos um valor definido. A integração do hook de drag-and-drop usa desestruturação explícita dos callbacks de ref para compatibilidade com a regra de lint React. Na falha de movimentação, além do snapshot, uma leitura curta reconcilia o estado caso a resposta se perca após o commit.

O único aviso restante do build é o package-lock fora do repositório, no diretório pessoal, já existente no ambiente. O npm install manteve os 7 alertas moderados de ferramentas já registrados no frontend; não foi aplicado audit fix fora do escopo. Nenhum dado do banco da aplicação foi removido, nenhuma migração antiga foi modificada e não houve reset, deploy ou operação Git de escrita. Os servidores temporários de teste foram encerrados ao concluir.

### Explicação para entrevistas — tarefas

1. **Tarefa no banco:** uma linha da tabela Task com identidade, conteúdo e relações. “Preparar entrevista” guarda título, prioridade e a coluna atual; não depende de uma aba do navegador aberta.
2. **TaskService:** no projeto se chama `TasksService`. Ele valida acesso e regras, verifica o responsável e organiza as transações; o controller apenas recebe a requisição e chama o método adequado.
3. **Chave estrangeira:** referência a uma linha de outra tabela. `Task.columnId` precisa apontar para uma coluna existente; o PostgreSQL impede uma tarefa ligada a uma coluna inexistente.
4. **Prisma e colunas:** `Task.column` e `BoardColumn.tasks` descrevem os dois lados da relação. A API pode seguir tarefa → coluna → quadro → workspace para verificar a associação do usuário.
5. **CRUD:** criar pelo POST, consultar pelo GET, editar pelo PATCH e excluir pelo DELETE. Mover usa outro PATCH com regras específicas de ordenação.
6. **React após salvar:** recebe a tarefa retornada pela API e atualiza a lista em memória. Na recarga, busca novamente o PostgreSQL. A memória mostra o resultado; não é o banco.
7. **Drag-and-drop:** arrastar e soltar um cartão sobre outra posição. dnd-kit detecta o gesto; TaskFlow transforma o destino em `columnId` e índice e só envia a requisição ao soltar.
8. **Mudar de coluna:** a API verifica se o destino pertence ao mesmo quadro, altera `columnId` e reorganiza as duas listas dentro de uma transação.
9. **Salvar posição:** só guardar a coluna não informa a ordem. `position` permite que “Escrever testes” continue acima de “Preparar apresentação” após fechar ou atualizar a página.
10. **Transação:** agrupa alterações para confirmar tudo de uma vez. Mover uma tarefa e ajustar suas vizinhas é uma única operação de negócio, mesmo que exija vários UPDATEs.
11. **Rollback:** desfazer o conjunto quando ocorre erro. No banco, a transação reverte as posições; no React, o snapshot anterior restaura os cartões se a API falhar.
12. **Impedir alteração alheia:** o usuário vem do cookie verificado; as consultas exigem associação ao workspace. Trocar o ID manualmente não passa por esse filtro. MEMBER também precisa ser criador para excluir.
13. **Duas movimentações simultâneas:** o lock do Board faz uma esperar a outra. Cada uma calcula os índices sobre o estado confirmado mais recente, mantendo posições consecutivas. A última operação confirmada define a ordem final; outras telas consultam novamente ao recarregar.
14. **Como testar:** usar contas e banco separados, chamar a API real, comparar os registros e repetir movimentos simultâneos. No navegador, testar formulário, mouse, teclado, toque alternativo, cancelamento, recarga e falha de rede. Os roteiros estão versionados em `test/`.

Referências: [locks de linha no PostgreSQL 17](https://www.postgresql.org/docs/17/explicit-locking.html#LOCKING-ROWS) e [validação NestJS](https://docs.nestjs.com/techniques/validation). A política de ordenação e os limites acima são decisões do TaskFlow, documentadas junto ao código.

Limites desta entrega: não há convites, gestão de membros, notificações, comentários, anexos, WebSockets ou deploy. A consulta de membros serve exclusivamente para escolher responsáveis existentes. Atualizações feitas por outra pessoa aparecem em uma nova consulta, sem sincronização em tempo real.


## Etapa 06 — dashboard e qualidade

### Estado explícito das tarefas e migração

Na Etapa 05, as posições 1 e 2 das colunas determinavam Em andamento e Concluído. Não havia um campo de estado. A Etapa 06 adiciona **`BoardColumn.status`**, enum **`ColumnStatus`** com TODO, IN_PROGRESS e DONE. O estado de uma tarefa é o status da coluna à qual ela pertence; não duplicamos a mesma informação no modelo Task.

A migração **`20261113040000_add_column_status`** adiciona somente o enum e o campo. Em uma transação, preenche as colunas anteriores pela regra que já era usada: posição 1 → IN_PROGRESS; posição 2 → DONE; demais → TODO. Esse mapeamento é usado **apenas na migração**. Novos quadros criam as três colunas com status explícito. Depois disso, nome, ordem e posição não classificam a tarefa.

Nenhuma tabela ou migração anterior foi recriada, e nenhum campo anterior de User, Session, Task ou das outras tabelas foi modificado. O padrão TODO atende colunas criadas diretamente sem status; a criação normal de quadros informa os três valores explicitamente. Não foi adicionada gestão de colunas nem novos estados pela interface.

A migração foi primeiro aplicada em um banco isolado com schema anterior, três tarefas e registros relacionados. O teste comparou todos os campos antigos antes/depois e verificou o preenchimento dos status. Depois foi aplicada ao PostgreSQL local do Compose: **contagens e hashes dos campos antigos permaneceram iguais nas sete tabelas**. O `.env` privado não foi alterado. A API precisa ser reiniciada se uma versão anterior ainda estiver rodando.

### Endpoint e contrato

```text
GET /api/dashboard/summary?workspaceId=IDENTIFICADOR&today=2026-11-13
```

`workspaceId` e uma data civil real `AAAA-MM-DD` são obrigatórios. `today` vem do dia local do navegador, mantendo a convenção de prazo da Etapa 05. O DTO rejeita valores inválidos, listas e campos extras. O ID do usuário vem exclusivamente da sessão autenticada, nunca da query.

Resposta tipada em `dashboard.types.ts`:

```text
workspace: id, name, role
metrics: total, inProgress, completed, overdue
boards: id, name, totalTasks, completedTasks, progress
attention: até 5 tarefas com id, title, priority, dueAt, board e reason
```

Datas são serializadas em ISO; a interface mantém o dia civil, sem convertê-lo para a véspera. O endpoint antigo `/api/tasks/summary` permanece compatível para clientes anteriores, agora também usando o status explícito. O frontend atual não o chama: a Visão geral usa exclusivamente o dashboard do workspace selecionado.

### Cálculos e desempenho

- **Total:** soma das contagens reais das colunas dos quadros do workspace.
- **Em andamento:** contagens das colunas com status IN_PROGRESS.
- **Concluídas:** contagens das colunas com status DONE.
- **Atrasadas:** COUNT no PostgreSQL de tarefas com prazo anterior ao dia informado e status diferente de DONE. Prazo hoje não está vencido; tarefa sem prazo não entra.
- **Progresso por quadro:** `round(concluídas × 100 / total)`. Se não houver tarefas, retorna `null`; a UI mostra “Sem tarefas”.

Prisma seleciona os quadros e as contagens `_count.tasks` das suas colunas. Não carrega os cartões para contar. O service combina essas contagens no backend e retorna somente os totais úteis. As relações são consultadas em lote; não existe uma chamada de banco dentro do loop de quadros. A lista de quadros está em ordem de criação decrescente, com ID como desempate, sem afirmar que representa atividade recente.

A lista **Precisa de atenção** usa três grupos disjuntos, nesta ordem: atrasadas; prazos de hoje até os próximos sete dias; prioridades HIGH/URGENT sem prazo ou com prazo mais distante. Cada consulta tem `take` limitado às vagas restantes, até cinco no total. As consultas seguintes são dispensadas se a lista já estiver completa. Datas, prioridade, criação e ID dão uma ordem estável. Tarefas DONE nunca entram. Não há busca de todas as tarefas para filtrar no React.

As leituras do resumo ficam em uma transação RepeatableRead: indicadores, quadros e atenção correspondem ao mesmo snapshot. É uma chamada HTTP agregada, composta por consultas Prisma; não é uma afirmação de que tudo é um único comando SQL. Não foram adicionados Redis, filas, cache distribuído ou dependências.

### Segurança e arquivos

O AuthGuard global e a sessão HTTP-only são preservados. O service reutiliza `WorkspacesService.requireMember` e também restringe as consultas ao workspace/usuário. OWNER, ADMIN e MEMBER podem ler o dashboard dos seus workspaces. Recurso inexistente ou inacessível recebe 404; sessão inválida, 401; query inválida, 400; falha Prisma, 503 com mensagem segura. Respostas têm `Cache-Control: no-store` e não incluem e-mail, senhas, sessões ou descrições completas.

```text
src/dashboard/
  dashboard.module.ts           # PrismaModule + WorkspacesModule
  dashboard.controller.ts       # GET, sessão e validação da query
  dashboard.service.ts          # agregados e tarefas de atenção
  dashboard.types.ts            # resposta explícita e dados públicos
  dto/dashboard-query.dto.ts    # workspace + data civil
prisma/migrations/20261113040000_add_column_status/migration.sql
test/dashboard.e2e-spec.ts
test/column-status-migration.mjs
```

Modificados: `prisma/schema.prisma` acrescenta ColumnStatus; `src/app.module.ts` registra DashboardModule; `boards.service.ts` grava/retorna o status; `tasks.service.ts` substitui posição por status no resumo anterior. As proteções dos testes anteriores aceitam também o banco isolado da Etapa 06. Nenhum módulo existente foi reestruturado.

### Executar e testar a Etapa 06

Na aplicação local, execute em **apps/server**, antes de iniciar uma API com o client novo:

```bash
npm exec -- prisma generate --config prisma7.config.ts
npm exec -- prisma migrate deploy --config prisma7.config.ts
npm run start:dev
```

O banco local deste checkout já recebeu a migração. Em outro terminal, na raiz, use `npm --prefix apps/web run dev` e abra `http://localhost:3000`. O PostgreSQL continua em `docker compose up -d db`; use Node.js 24 e npm. Não há reset nem necessidade de criar registros demonstrativos no banco da aplicação.

Para a suíte HTTP isolada, crie uma vez na raiz:

```bash
docker compose exec -T db createdb -U taskflow taskflow_etapa06_test_20261113
```

Em `apps/server`:

```bash
export DATABASE_URL='postgresql://taskflow:taskflow_dev_123@localhost:5433/taskflow_etapa06_test_20261113?schema=public'
npm exec -- prisma migrate deploy --config prisma7.config.ts
npm exec -- prisma validate --config prisma7.config.ts
npm run lint
npm run build
npm test
RUN_DATABASE_TESTS=true npm run test:e2e
```

O teste de migração exige **outro banco novo e vazio**, com prefixo `taskflow_etapa06_migration_test`. Ele prepara as duas migrações anteriores, registra essa baseline com Prisma, cria suas próprias fixtures e aplica a terceira migração. Não o execute no banco da aplicação ou no banco já preenchido da suíte:

```bash
# Na raiz, uma vez:
docker compose exec -T db createdb -U taskflow taskflow_etapa06_migration_test_20261113
# Em apps/server, usando esse banco novo:
DATABASE_URL='postgresql://taskflow:taskflow_dev_123@localhost:5433/taskflow_etapa06_migration_test_20261113?schema=public' node test/column-status-migration.mjs
```

Se o banco de migração já tiver tabelas, o roteiro recusa a execução; para repetir, crie outro nome com o mesmo prefixo. Não remova tabelas nem use reset. As suítes limpam somente fixtures próprias; os testes históricos de autenticação preservam suas contas somente no banco separado.

### Resultados da Etapa 06

Validação executada em **13/11/2026**:

| Verificação executada | Resultado real |
| --- | --- |
| Lints frontend/backend | Passaram, sem avisos |
| Builds NestJS e Next.js/Webpack/TypeScript | Passaram |
| Testes de configuração | 25 passaram |
| Testes unitários frontend | 27 passaram em 6 arquivos |
| HTTP + PostgreSQL isolado | 91 passaram: 75 anteriores e 16 novos do dashboard |
| Migração sobre schema anterior com dados | Passou; campos antigos de sete tabelas e três tarefas preservados |
| Migração no Compose local | Aplicada; contagens e hashes dos campos anteriores iguais nas sete tabelas |
| Prisma validate/migrate status | Schema válido; três migrações aplicadas e banco local atualizado |
| Navegador — dashboard | 12 verificações completas passaram |
| Navegador — tarefas | 15 verificações completas passaram |
| Navegador — workspaces/quadros | 13 verificações completas passaram |
| Exportação estática | `apps/web/out/quadros/detalhes/index.html` e `_routes.json` presentes |

A suíte nova verificou workspace vazio, múltiplos quadros, tarefas sem prazo, datas de hoje/ontem, limite de sete dias, prioridade, limite de cinco itens, progresso, papéis e isolamento entre usuários e entre workspaces do mesmo usuário. Renomear e trocar posições de colunas em fixtures não alterou o resultado: o status explícito permaneceu a fonte da classificação. A falha Prisma no endpoint novo foi injetada para verificar 503 seguro; as leituras e demais integrações usaram PostgreSQL real. Os testes antigos também mantêm seus casos de falha transacional real.

No navegador, alterações no Kanban atualizaram o dashboard ao voltar, sem reiniciar a aplicação. Foram testados carregamento, erro/recuperação, editor por link, teclado, foco e larguras de 320 a 1440 px; as capturas foram inspecionadas. O código da Pages Function foi usado em um adaptador HTTP local, sem repetir workerd ou fazer deploy.

A regressão identificou uma espera insuficiente no roteiro de exclusão de workspace: a opção de outro workspace já existia antes de a requisição terminar. O teste agora aguarda o diálogo fechar após a resposta, antes de conferir a cascata no banco. Um preview temporário encerrado durante a primeira tentativa foi reiniciado; a execução final passou. Nenhum problema de persistência permaneceu.

Nenhuma biblioteca foi instalada. O build mantém apenas o aviso ambiental sobre um package-lock no diretório pessoal fora do repositório. Os servidores temporários foram encerrados. Não houve reset, perda de dados, git add, commit, push, merge, criação de branch ou deploy.

### Explicação para entrevistas — dashboard

1. **Como chega ao PostgreSQL:** o React solicita o resumo do workspace pela API. O controller valida a query e o service consulta pelo PrismaService. O PostgreSQL devolve contagens e até cinco tarefas de atenção; a API monta a resposta pública.
2. **Agregação:** calcular um resumo sobre várias linhas, como COUNT. O TaskFlow conta as tarefas de cada coluna no banco, em vez de mandar todos os cartões ao navegador para somá-los.
3. **Por que no backend:** a regra de status e a autorização ficam centralizadas, o payload é menor e qualquer cliente usa o mesmo resultado. A UI apresenta os números, sem inventar estatísticas.
4. **Isolamento:** a API usa o ID da sessão e exige WorkspaceMember para o workspace solicitado. Mudar `workspaceId` para um espaço alheio retorna 404 e não revela indicadores.
5. **Atualização no React:** `useApiResource` carrega o resumo ao visitar a página, cancela consultas anteriores ao trocar de workspace e aplica a resposta em estado. Reabrir a Visão geral depois de editar no Kanban busca os dados atuais; receber foco também permite atualizar o resumo.
6. **Loading, erro e vazio:** carregamento usa um estado de espera, falha oferece nova tentativa sem números falsos e ausência de dados mostra ações úteis. Zero só aparece quando a API confirma zero. Um 503 não é tratado como sessão expirada.
7. **Responsividade:** Tailwind mantém utilitários como `sm:inline-block`, alinhamento e espaçamento; as grades e breakpoints compartilhados de `globals.css` seguem o padrão existente. Os quatro indicadores viram duas colunas e as seções se empilham. O Kanban conserva a rolagem horizontal interna.
8. **Organização:** controller para HTTP, DTO para entrada, service para regras e PrismaService para banco. No frontend, a tela coordena dados e componentes pequenos exibem indicadores, atenção e quadros. O seletor e o editor são reutilizados; não há outra biblioteca de estado.

Referências: [validação NestJS](https://docs.nestjs.com/techniques/validation) e [ALTER TABLE no PostgreSQL 17](https://www.postgresql.org/docs/17/ddl-alter.html). O client do projeto continua sendo Prisma 7; não foi atualizado para a API de versões posteriores apresentada em parte da documentação atual.

Limitações: sem sincronização em tempo real; a lista de atenção é limitada a cinco e os quadros não têm paginação nesta etapa. Não foram iniciados testes finais gerais da Etapa 07, integrações externas ou deploy da Etapa 08.
