# TaskFlow — Web (Etapa 05)

Next.js com **exportação estática**, React, TypeScript e Tailwind CSS. A Etapa 05 transforma o Kanban em gerenciamento real de tarefas, com formulários, responsáveis, prazos, arrasto e ordenação persistente. A identidade visual, autenticação e proxy Cloudflare foram preservados. A seção **Etapa 05** descreve a entrega atual; as seções anteriores registram o histórico.

## Executar localmente

Use Node.js 24 LTS e npm. Com o PostgreSQL e a API em execução, na raiz:

```bash
npm --prefix apps/web run dev
```

Acesse `http://localhost:3000`. O arquivo privado `apps/web/.env.local` existente permanece com:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

Se o Next.js abrir em `http://localhost:3002`, a base da API continua sendo `http://localhost:3001/api`. Inclua `http://localhost:3002` em `CORS_ORIGIN` no `.env` do backend e reinicie a API após alterar essa variável. O exemplo de ambiente já inclui 3000, 3002 e 8788. No HTTP local, `COOKIE_SECURE=false`; mantenha `localhost` tanto no frontend quanto na URL da API. Cookies não são separados por porta, mas CORS e a verificação de Origin são.

A árvore de contexto deve permanecer única: `RootLayout → AuthProvider → layout privado → AuthGate → AppShell → ProfileMenu`. Login e cadastro também ficam sob o mesmo AuthProvider, sem AppShell. Não monte AppShell fora do provider no layout raiz e não adicione um segundo provider no menu ou no layout privado.

Em um checkout novo, execute `npm ci` dentro de cada aplicação e copie `.env.example` para `.env.local` somente se ele ainda não existir. O endereço inclui `/api`, não `/auth` nem `/health`. Reinicie o desenvolvimento/refaça o build ao alterar a variável. Nunca coloque a URL do PostgreSQL ou segredos em variáveis `NEXT_PUBLIC_*`.

Veja [o README do backend](../server/README.md) para migração, banco, variáveis da API, endpoints e explicações para entrevistas.

## Páginas e uso

| Rota | Comportamento |
| --- | --- |
| `/login/` | E-mail, senha, mostrar/ocultar senha, feedback de erro e link para cadastro. |
| `/cadastro/` | Nome, e-mail, senha, confirmação e validação abaixo dos campos. Cadastro autentica e encaminha à Visão geral. |
| `/` | Visão geral, agora exigindo sessão. Conteúdo da Etapa 02 preservado. |
| `/quadros/` | Seleção e CRUD de workspaces e quadros, conforme permissões. |
| `/quadros/detalhes/?id=IDENTIFICADOR` | Página estática; consulta quadro/colunas e gerencia tarefas autenticadas no cliente. |

O formulário usa labels, autocomplete, foco visível, indicação acessível de erros e estado de envio. Ao falhar a validação local, o foco vai ao primeiro campo inválido. Uma referência de envio e o botão desabilitado evitam submissões duplicadas. Senhas de cadastro aceitam de **15 a 128 caracteres**, inclusive espaços e frases longas. O backend faz sua própria validação; validação do navegador não é uma barreira de segurança.

O cabeçalho da área privada contém o nome real e um menu de conta com nome, e-mail e **Sair da conta**. O menu fecha por Escape ou clique fora. Não existia um menu de perfil funcional na Etapa 02; o novo componente ocupa o espaço do indicador anterior e reaproveita o cabeçalho e o design system existentes.

## Estado da sessão e proteção

```text
Abrir/recarregar a página
  → AuthProvider chama GET /api/auth/me
  → verificando: apenas tela de carregamento
  → 200: usuário público em memória, área privada liberada
  → 401: login
  → falha de rede/serviço: aviso de conexão + Tentar novamente
```

`AuthGate` não renderiza os filhos privados durante a verificação inicial. A sessão também é revalidada quando a janela recebe foco. Respostas antigas de uma verificação não sobrescrevem um login/logout mais recente.

O `AuthProvider` não lê o token. O navegador envia o cookie via `credentials: "include"`. Não há armazenamento de token em localStorage ou sessionStorage. Login e cadastro recebem somente os dados públicos no JSON; logout só limpa o estado local depois que o servidor confirma a invalidação, ou quando ele já responde 401. Se o logout falhar por conexão, a interface informa o erro e permite tentar novamente.

A proteção visual não torna arquivos estáticos secretos. Os recursos compilados continuam sendo arquivos públicos; os dados privados precisam vir de endpoints protegidos. O `AuthGuard` global já implementado no NestJS protege as rotas da API por padrão. A autorização dos workspaces e quadros é verificada no backend por associação e papel, em todas as operações.

## Cliente HTTP

`src/lib/api.ts` reutiliza o cliente da Etapa 02, agora com:

- Métodos GET/POST/PATCH/DELETE, JSON, cookies e timeout de 15 segundos.
- Base configurada por `NEXT_PUBLIC_API_URL`; fallback `/api`.
- `ApiError` com status HTTP, erros de campos e `Retry-After`.
- Tratamento de 204 sem tentar interpretar JSON.
- Distinção entre 401, 429 e falha de conexão, sem espalhar `fetch` pelos componentes.
- A função de saúde anterior preservada e com validação da resposta.

Mensagens técnicas de diagnóstico não entram no layout. 400/409 mostram erros do formulário, 401 no login mostra a mensagem genérica de credenciais, 429 informa o limite de tentativas e falhas de conexão permitem nova tentativa.

## Proxy da Cloudflare

Em produção, o navegador usará **`/api` na mesma origem do frontend**:

```text
Navegador → https://seu-projeto.pages.dev/api/auth/login
  → Pages Function → https://sua-api.onrender.com/api/auth/login
  → NestJS → PrismaPg → PostgreSQL/Neon
  ← Set-Cookie sem Domain
  ← cookie associado ao host pages.dev visto pelo navegador
```

Isso evita depender de cookies de terceiros entre `pages.dev` e `onrender.com`. Não exige domínio próprio e não transforma o Next.js em aplicação SSR.

`functions/api/[[path]].ts` encaminha exclusivamente `/api/*`. A origem vem de **`API_ORIGIN` do servidor**, nunca de parâmetros do usuário. O proxy preserva método, corpo, query string, Cookie, Origin e cada cabeçalho Set-Cookie separadamente. Filtra cabeçalhos hop-by-hop e não encaminha credenciais desnecessárias. Não segue redirecionamentos do backend. Respostas usam `Cache-Control: no-store`. Falhas retornam 502; configuração inválida retorna 503, sem expor origem ou segredos.

A origem precisa ser HTTPS; HTTP é aceito somente para loopback no desenvolvimento. `public/_routes.json`, copiado para `out/`, limita a execução das Functions a `/api/*`, sem interferir nas páginas estáticas.

### Variáveis

| Variável | Onde existe | Valor/finalidade |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | Build do navegador | `http://localhost:3001/api` no Next dev; `/api` no Pages/Wrangler. |
| `API_ORIGIN` | Apenas Pages Function | Origem fixa da API, sem `/api`, caminho, query ou credenciais; exemplo `https://sua-api.onrender.com`. |
| `API_PROXY_SECRET` | Pages Function e NestJS | Mesmo segredo aleatório em ambos; obrigatório no backend em produção. Nunca recebe prefixo NEXT_PUBLIC. |

O proxy sobrescreve os cabeçalhos internos de autenticação; o navegador não escolhe o segredo. Em produção, o IP original vem do cabeçalho da Cloudflare e só é aceito pela API quando o segredo do proxy confere. Detalhes em [segurança do backend](../server/README.md).

### Testar localmente com Wrangler

Wrangler foi adicionado como **devDependency**, para executar a Pages Function no runtime local da Cloudflare. Não foi necessário instalar bibliotecas de autenticação ou de formulário no frontend.

1. Na API, inclua `http://localhost:8788` em `CORS_ORIGIN`. Para o teste sem alterar `.env`, inicie outro terminal na raiz:

```bash
CORS_ORIGIN=http://localhost:3000,http://localhost:8788 npm --prefix apps/server run start:dev
```

2. Se `apps/web/.dev.vars` ainda não existir, copie `.dev.vars.example` e mantenha `API_ORIGIN=http://localhost:3001`. Esse arquivo é ignorado pelo Git. Deixe o segredo ausente no desenvolvimento direto, ou configure o mesmo valor nos dois servidores para testar o modo de proxy confiável.

3. Na raiz, compile usando base relativa e inicie Wrangler:

```bash
NEXT_PUBLIC_API_URL=/api npm --prefix apps/web run build
npm --prefix apps/web run preview:pages
```

Abra `http://localhost:8788`. Alternativamente, sem criar `.dev.vars`, informe somente a origem pública local na linha de comando:

```bash
npm --prefix apps/web run preview:pages -- --binding API_ORIGIN=http://localhost:3001
```

Se usar `127.0.0.1` no navegador, inclua a origem correspondente no CORS e mantenha o host de navegação consistente. Não teste uma cópia antiga de `out/` compilada com a URL direta quando a intenção for validar o proxy. Não foi executado deploy nem login na Cloudflare.

### Futura configuração no Cloudflare Pages

- Diretório raiz: `apps/web`; comando de build: `npm run build`; saída: `out`.
- Defina `NEXT_PUBLIC_API_URL=/api` no ambiente de build.
- Defina `API_ORIGIN` e `API_PROXY_SECRET` como bindings/segredos da Function, nos ambientes pertinentes de produção e preview.
- No Render, configure o mesmo segredo, a origem HTTPS exata do Pages, `NODE_ENV=production`, `COOKIE_SECURE=true` e a conexão privada da Neon.
- Não publique somente `out/` por um mecanismo que descarte `functions/`. O fluxo futuro deve compilar/incluir as Pages Functions a partir do diretório do projeto.
- Não adicione cookies com `Domain=onrender.com`: o cookie precisa continuar sem Domain para ser associado ao host do frontend.

## Arquivos criados, movidos e modificados

Criados:

| Arquivo | Responsabilidade |
| --- | --- |
| `src/app/login/page.tsx` e `cadastro/page.tsx` | Rotas e metadados públicos de autenticação. |
| `src/app/(private)/layout.tsx` | Combina AuthGate e AppShell para as páginas privadas. |
| `src/components/auth/auth-provider.tsx` | Estado da sessão, consulta inicial, revalidação e ações de login/cadastro/logout. |
| `src/components/auth/auth-gate.tsx` | Decide carregamento, redirecionamento, falha de conexão ou conteúdo. |
| `src/components/auth/session-screen.tsx` | Estados de verificação/indisponibilidade, com nova tentativa. |
| `src/components/auth/auth-form.tsx` | Formulários, inputs acessíveis, senhas, erros e envio. |
| `src/components/layout/profile-menu.tsx` | Perfil com dados públicos e logout. |
| `src/components/ui/brand.tsx` | Marca compartilhada entre autenticação e layout existente. |
| `src/lib/auth-validation.ts` | Regras locais de formulário, testáveis sem biblioteca extra. |
| `functions/api/[[path]].ts` | Proxy isolado de API. |
| `public/_routes.json` | Restringe as Functions a `/api/*`. |
| `wrangler.jsonc` | Configuração local de Pages e diretório de arquivos estáticos. |
| `.dev.vars.example` | Exemplo público do ambiente exclusivo da Function. |
| `test/api.test.mjs`, `auth-validation.test.mjs`, `proxy.test.mjs` | Testes com o runner nativo do Node. |

Movidos, preservando conteúdo: `src/app/page.tsx` → `src/app/(private)/page.tsx`; `src/app/quadros/page.tsx` → `src/app/(private)/quadros/page.tsx`. O grupo `(private)` organiza o layout sem alterar as URLs públicas.

Modificados: `src/app/layout.tsx` fornece AuthProvider; `src/components/layout/app-shell.tsx` reutiliza a marca e adiciona o perfil; `src/lib/api.ts` evolui o cliente HTTP existente; `src/app/globals.css` acrescenta estilos consistentes de autenticação/perfil; `.env.example` explica a base local/produção; `.gitignore` protege `.dev.vars` e `.wrangler`; `package.json`/lock adicionam Wrangler, testes nativos e preview; este README documenta o fluxo. A tipografia local e a preferência por movimento reduzido permanecem preservadas.

## Testes e validação

Na raiz:

```bash
npm --prefix apps/web run lint
npm --prefix apps/web test
npm --prefix apps/web run build
```

Os testes nativos requerem Node.js 24 e verificam HTTP, formulários e proxy. Não foi adicionada outra biblioteca de testes. Para builds destinados ao Wrangler/produção, use `NEXT_PUBLIC_API_URL=/api`.

Verificações de navegador realizadas com Chrome/Playwright já instalados, usando uma conta única `browser-* @example.invalid` (sem espaço no endereço real):

- Páginas privadas bloqueadas antes da resposta de sessão, sem flash de conteúdo.
- Cadastro real, erros por campo, mostrar/ocultar senha e uma única requisição ao tentar enviar duas vezes.
- Login incorreto/correto, normalização de e-mail, perfil com nome/e-mail reais, logout e bloqueio posterior.
- Sessão persistida após atualizar Quadros; token HTTP-only não disponível em document.cookie, localStorage ou sessionStorage.
- Expiração real somente da sessão da conta de teste no PostgreSQL e redirecionamento após recarregar.
- HTTP 503/falha de rede com mensagem de conexão; nova tentativa recupera a sessão, sem tratar o erro como 401.
- Fluxo real completo passando por Wrangler/workerd e Pages Function, com cookies de cadastro/login/logout preservados.
- Com a API temporária realmente encerrada: proxy 502, mensagem segura e área privada bloqueada sem redirecionamento incorreto.
- Login, cadastro e área privada entre **320 e 1440 px**, sem rolagem horizontal; perfil dentro da tela, foco visível e navegação por teclado.
- Sem erros JavaScript durante o fluxo normal. As capturas de desktop/mobile foram inspecionadas.

Os scripts de navegador foram temporários e não fazem parte da suíte npm; não é necessário instalar Playwright para executar os testes nativos do projeto.

### Resultado histórico da Etapa 03

| Verificação executada | Resultado |
| --- | --- |
| Build estático do Next.js/Webpack | Passou, incluindo TypeScript |
| Lint do frontend | Passou |
| Testes nativos de HTTP, formulários e proxy | **16 passaram** |
| Exportação | `out/index.html`, `login/index.html`, `cadastro/index.html`, `quadros/index.html` e `_routes.json` gerados |
| Wrangler/workerd + navegador + PostgreSQL real | Passou |
| Layout e navegação | Passaram entre 320 e 1440 px |
| API realmente desligada atrás do proxy | 502 seguro e aviso de conexão; sem acesso privado ou redirecionamento incorreto |

## Limitações e próxima etapa

Não foram implementados OAuth, confirmação de e-mail, recuperação de senha, edição de perfil, CRUD de tarefas, drag-and-drop, convites ou gestão de membros. Não houve deploy, git add, commit, push ou remoção de dados. Sessões expiradas permanecem no banco e os contadores de tentativas são locais à instância da API. Um backend com inicialização demorada pode exigir uma nova tentativa após o timeout; a interface distingue essa falha de uma sessão inválida.

A auditoria npm do frontend encontrou **7 alertas moderados em dependências transitivas das ferramentas de lint** (cadeia typescript-eslint/minimatch), sem alertas altos/críticos. A atualização dessa cadeia existente ficou registrada para manutenção, sem alterações fora do escopo da autenticação.

Referências: [Next.js estático no Pages](https://developers.cloudflare.com/pages/framework-guides/nextjs/deploy-a-static-nextjs-site/), [Pages Functions localmente](https://developers.cloudflare.com/pages/functions/local-development/), [bindings/variáveis de ambiente](https://developers.cloudflare.com/pages/functions/bindings/), [roteamento das Functions](https://developers.cloudflare.com/pages/functions/routing/).


## Etapa 04 — experiência de Quadros

### Fluxo completo

1. Cadastre-se ou entre na sua conta e abra **Quadros**. A sidebar continua apenas com Visão geral e Quadros.
2. Sem workspace, aparece **Organize seus projetos em um só lugar**. Clique em **Criar workspace**, informe o nome e salve. Ele é selecionado automaticamente.
3. Sem quadros, aparece **Nenhum quadro por aqui**. Clique em **Criar quadro**, informe o nome e salve. O servidor cria também as três colunas de forma atômica.
4. O card mostra nome e data real de criação. **Abrir quadro** leva a `/quadros/detalhes/?id=...`; a API fornece workspace, nome e colunas ordenadas. Não há botão fictício para adicionar tarefas.
5. O seletor **Workspace atual** troca a listagem. **Criar workspace** continua disponível; o menu discreto ao lado permite renomear e, para OWNER, excluir o workspace.
6. O menu de cada quadro permite renomear e excluir para OWNER/ADMIN. Exclusões abrem confirmação com o nome do recurso e o alcance da remoção. Cancelar ou Escape preserva os dados.
7. Atualizar a página consulta o PostgreSQL novamente e preserva uma seleção válida. Excluir o workspace selecionado faz a interface selecionar outro existente ou voltar ao primeiro acesso.
8. A Visão geral mantém o layout e mostra somente a quantidade e até três quadros recentes **do workspace selecionado**, sem estatísticas de tarefas.

### Arquivos criados e alterados

```text
src/features/workspaces/workspaces-provider.tsx  # lista, papel e seleção
src/features/boards/
  boards-screen.tsx       # listagem, seletor e ações
  board-screen.tsx        # detalhe Kanban vindo da API
  boards-summary.tsx      # resumo real na Visão geral
  resource-dialog.tsx     # criar, renomear e confirmar exclusão
  resource-state.tsx      # loading, erro e nova tentativa
  types.ts               # respostas tipadas e URL de detalhes
src/hooks/use-api-resource.ts                  # consulta cancelável e escritas autenticadas
src/lib/resource-validation.ts                # validação antecipada do nome
src/components/ui/dialog.tsx                  # dialog nativo, foco e Escape
src/components/ui/action-menu.tsx             # ações com details/summary
src/app/(private)/quadros/detalhes/page.tsx     # rota estática com Suspense
```

Arquivos modificados: `app/(private)/quadros/page.tsx` troca o placeholder pela experiência real; `app/(private)/page.tsx` usa o resumo; `app/(private)/layout.tsx` monta um WorkspacesProvider dentro do AuthGate; `components/auth/auth-provider.tsx` ganha uma ação estável para encerrar visualmente uma sessão após 401; `lib/api.ts` aceita PATCH/DELETE; `app/globals.css` acrescenta estilos; `test/api.test.mjs` testa os novos métodos. Criados também `test/resource-validation.test.mjs` e `test/boards.browser.mjs`. Nenhuma biblioteca foi adicionada e nenhum arquivo do proxy foi alterado.

### Estado, acessibilidade e autorização

O PostgreSQL é a fonte de verdade. Após cada escrita bem-sucedida a listagem é consultada novamente. O WorkspacesProvider mantém somente a seleção e a resposta da API em memória; `sessionStorage` guarda **apenas o ID da preferência de workspace por usuário**, sem credenciais nem cópia dos registros. Se a preferência não existir mais na listagem autorizada, o primeiro workspace válido é usado. Se o armazenamento estiver bloqueado, a aplicação continua funcionando.

`useApiResource` associa cada resposta ao caminho solicitado e usa AbortController ao trocar de workspace/desmontar. Assim, uma resposta atrasada não substitui os quadros atuais. Erros de conexão/503 mostram mensagem e nova tentativa; **somente 401** marca a sessão como anônima e aciona o AuthGate. Não há segundo AuthProvider.

OWNER/ADMIN veem criação/renomeação/exclusão de quadros e renomeação de workspace. Somente OWNER vê exclusão de workspace. MEMBER vê o seletor, os quadros e o Kanban em modo leitura; pode criar seu próprio workspace. O backend repete todas essas verificações.

Diálogos usam `<dialog>.showModal()`: o navegador torna o restante da página inerte e o componente mantém a circulação por Tab/Shift+Tab entre seus controles. Após abrir, o formulário foca o campo de nome; a exclusão foca Cancelar. Escape fecha e o foco retorna ao acionador, ou ao conteúdo principal se ele foi removido após excluir. Durante uma gravação, fechamento e envio repetido ficam bloqueados até a resposta. Labels, mensagens de campo, regiões de status, menu por teclado e alvos de pelo menos 44px acompanham a identidade anterior.

As colunas se empilham em telas menores. Nomes longos quebram linha; formulários e seletores respeitam a largura disponível. A preferência `prefers-reduced-motion` existente permanece ativa. Não foram adicionadas animações GSAP nesta etapa.

### Exportação estática e execução

Execute o frontend na raiz com `npm --prefix apps/web run dev` e o backend conforme [seu README](../server/README.md#executar-localmente). Acesse `http://localhost:3000`; a API local padrão é `http://localhost:3001/api`.

A página de detalhes usa `useSearchParams` dentro de Suspense e recebe o ID no navegador. Não há `[id]`, SSR ou geração de rotas desconhecidas. `next.config.ts` continua com `output: "export"` e `trailingSlash: true`. Para validar o artefato compatível com Pages:

```bash
npm --prefix apps/web run lint
npm --prefix apps/web test
NEXT_PUBLIC_API_URL=/api npm --prefix apps/web run build
```

O build inclui `out/quadros/detalhes/index.html`. A Pages Function existente encaminha GET/POST/PATCH/DELETE e cookies para a API. A seção Wrangler acima permanece válida; nenhum deploy foi executado.

### Roteiro de navegador reproduzível

`test/boards.browser.mjs` usa Playwright opcional, fora das dependências da aplicação. Não é necessário instalá-lo para os testes nativos. Ele exige:

- Backend compilado (`npm --prefix apps/server run build`), ligado a um banco `taskflow_etapa04_test*`, migrado conforme o README da API.
- Frontend/exportação servida com proxy e cookies; `BROWSER_BASE_URL` aponta para sua origem (padrão `http://localhost:3100`). Inclua essa origem no CORS do backend.
- Playwright e Chromium disponíveis no ambiente. Se Playwright estiver instalado externamente, informe `PLAYWRIGHT_MODULE` com o caminho do módulo `index.mjs`; `CHROMIUM_PATH` pode indicar um Chromium já instalado.
- A variável `DATABASE_URL` de teste: o roteiro consulta o banco para verificar persistência e preparar os papéis de teste, sem criar endpoints de gestão de membros.

Na raiz, com essas variáveis definidas no terminal:

```bash
node apps/web/test/boards.browser.mjs
```

O roteiro cria uma conta única `browser04-*@example.invalid`, exercita a interface e limpa somente a conta/workspaces que criou. Capturas ficam em `/tmp/taskflow-etapa04/`. Na validação desta entrega, o navegador usou a exportação de produção e a **própria função `onRequest` do proxy**, servida por um adaptador HTTP local na porta 3100, com API isolada na 3101. Isso valida o código do proxy e a experiência integrada, mas não equivale a uma execução do runtime workerd nesta etapa. O teste com workerd listado antes é histórico da Etapa 03.

### Resultados da Etapa 04 — 12/11/2026

| Verificação executada | Resultado |
| --- | --- |
| Lint frontend/backend | Passaram, sem avisos |
| Build Next.js/Webpack e TypeScript | Passou; exportação estática com `/quadros/detalhes/` |
| Build NestJS | Passou |
| Testes unitários frontend | 19 passaram (4 arquivos); inclui PATCH/DELETE e nomes |
| Configuração backend | 25 passaram |
| HTTP completo com PostgreSQL real | 45 passaram, incluindo 16 novos da Etapa 04 |
| Roteiro Playwright na exportação de produção | 13 verificações completas passaram |
| Layout | Sem overflow em 320, 375, 768 e 1440 px; capturas mobile/desktop inspecionadas |
| Teclado | Foco inicial, Tab contido, Escape e restauração do foco passaram |
| Sessão e erros | Cadastro real, persistência, falha de rede com recuperação e 401 encaminhando para login passaram |
| Permissões na UI e API | MEMBER somente leitura; ADMIN sem exclusão de workspace; OWNER com CRUD completo |
| Console do navegador | Nenhum erro JavaScript durante o roteiro final |

`npm test` executou os quatro arquivos com sucesso. Para obter também a contagem individual de 19 casos neste ambiente, foi executado `node --test --test-isolation=none --test-reporter=spec apps/web/test/*.test.mjs` a partir da raiz.

O build inicialmente falhou dentro do sandbox ao interpretar a saída do subprocesso TypeScript; executado com permissão para subprocessos, passou sem alteração de configuração ou dependências. O único aviso restante é sobre um package-lock no diretório pessoal fora do repositório. Schema e duas migrações existentes foram validados no banco separado. Os servidores temporários da validação foram encerrados; nenhum deploy foi feito.

Durante a validação, o navegador detectou foco inicial no botão de fechar e saída do foco dos controles ao circular por Tab; o diálogo foi corrigido para focar explicitamente o input ou Cancelar e manter a circulação por teclado. O CORS anterior permitia somente GET/POST e foi ampliado para PATCH/DELETE no backend.

As respostas às 12 perguntas de entrevista, o desenho das relações e os endpoints estão no [README da API](../server/README.md#explicação-da-etapa-04-para-entrevistas).

Na entrega da Etapa 04, as tarefas ainda estavam pendentes. A Etapa 05 abaixo implementa cartões, responsáveis, prazos e movimentação. Comentários, anexos, convites e automações continuam fora do escopo.


## Etapa 05 — tarefas e Kanban funcional

### Como usar

Abra Quadros e entre em um quadro. Cada coluna mostra a quantidade real de cartões e um botão **+** com nome acessível “Criar tarefa em …”. No estado vazio, **Criar tarefa** abre o mesmo formulário. Informe título e, opcionalmente, descrição, prioridade, prazo e responsável. A coluna acionada já vem selecionada; na criação é possível escolher outra coluna do mesmo quadro.

O título do cartão abre a edição. O menu **•••** oferece Editar tarefa, Mover tarefa e, quando permitido, Excluir tarefa. Excluir exige confirmação com o título do registro; Cancelar/Escape preserva a tarefa. A descrição completa fica no formulário, sem sobrecarregar os cartões.

Arraste pela alça **⠿** para ordenar ou mudar de coluna. Uma coluna vazia também aceita o cartão. Escape cancela sem salvar. Com teclado, a alça recebe foco: Espaço inicia, setas deslocam, Espaço solta e Escape cancela. O menu **Mover tarefa** oferece uma alternativa com seleção de coluna e posição, utilizável por teclado ou toque.

No celular, percorra as colunas horizontalmente dentro da região do Kanban. A página inteira mantém sua largura. O formulário continua em diálogo, com foco controlado e campos legíveis. As prioridades usam texto **Baixa/Média/Alta/Urgente**, além da cor. Responsável e prazo só aparecem quando definidos; tarefas vencidas fora de Concluído recebem a indicação textual **Em atraso**.

### Arquivos

```text
src/features/tasks/
  types.ts                        # contratos de tarefa, pessoa, prioridade e resumo
  task-utils.ts                   # validação, datas e reordenação imutável
  components/
    task-board.tsx                # carrega tarefas, DndContext e snapshot/rollback
    task-column.tsx               # área de destino, contagem e lista ordenada
    task-card.tsx                 # useSortable, alça e ações conforme permissão
    task-form.tsx                 # criar/editar e consulta de responsáveis
    task-delete-dialog.tsx        # confirmação e exclusão HTTP
    task-move-dialog.tsx          # movimentação alternativa acessível
    task-summary.tsx              # indicadores reais na Visão geral
test/tasks.test.mjs                # testes de ordem, datas e validação
test/tasks.browser.mjs             # roteiro integrado com Chromium e PostgreSQL
```

Modificados: `features/boards/board-screen.tsx` passa a renderizar TaskBoard; `hooks/use-api-resource.ts` ganha `replace` para aplicar uma resposta confirmada ou um snapshot; `lib/api.ts` preserva erros dos novos campos; `app/(private)/page.tsx` inclui o resumo e atualiza os textos que anunciavam tarefas futuras; `app/globals.css` adiciona cartões/formulários e rolagem interna. `package.json` e `package-lock.json` registram as duas dependências. O roteiro `test/boards.browser.mjs` passou a aceitar também o prefixo de banco isolado da Etapa 05 para executar a regressão. Nenhuma rota dinâmica, sidebar adicional, Server Action, SSR ou alteração no proxy foi introduzida.

### Dependências e drag-and-drop

Foram adicionadas **`@dnd-kit/core` 6.3.1** e **`@dnd-kit/sortable` 10.0.0**, por npm. Suas peer dependencies aceitam a versão React 19 usada neste projeto; a integração também é verificada no build e no navegador. Bibliotecas auxiliares de acessibilidade/utilitários são transitivas. Não foi adicionada outra biblioteca de estado, formulários, datas ou animação.

`DndContext` recebe PointerSensor e KeyboardSensor. A ativação por ponteiro exige deslocamento de 8px para separar clique de arrasto; apenas a alça tem `touch-action: none`, permitindo a leitura/rolagem pelo restante do cartão. Cada coluna usa `useDroppable`, inclusive vazia. Cada lista usa SortableContext e cada cartão usa useSortable. O overlay mostra o cartão durante o gesto. As instruções e anúncios do leitor de tela estão em português.

Não há HTTP durante o movimento do cursor. Ao soltar, o cliente calcula destino/índice, aplica uma cópia imutável da ordem e envia **um PATCH**. Enquanto salva, novas movimentações ficam bloqueadas. A API devolve todas as tarefas do quadro na ordem confirmada; o frontend substitui a previsão visual pela resposta. Se ocorrer erro, restaura o snapshot, mostra a mensagem e tenta uma leitura curta para reconciliar com o banco caso a resposta tenha se perdido após o commit. Se a rede continuar indisponível, mantém o snapshot e permite tentar novamente. Cancelar o gesto não altera a lista nem chama a API. Formulários e exclusões só confirmam sucesso após resposta do servidor.

O menu Mover tarefa usa a mesma função de persistência e rollback, sem duplicar a regra de ordenação. As posições do formulário são apresentadas a partir de 1; o corpo HTTP usa índices a partir de 0. O backend valida os limites e calcula novamente as posições sob lock/transação. Detalhes do algoritmo e da concorrência estão no [README da API](../server/README.md#persistência-ordenação-e-concorrência).

### Formulários, datas e responsáveis

O título aceita de 1 a 200 caracteres e a descrição até 5000. A prioridade padrão é Média. Erros aparecem no campo correspondente; o estado de envio e uma referência impedem submissões duplicadas. Uma falha mantém o diálogo e os valores digitados. Fechar/escapar durante o salvamento fica bloqueado para evitar ambiguidade da operação em andamento. Os diálogos reutilizam foco inicial, contenção por Tab e restauração de foco da Etapa 04.

O seletor de responsáveis consulta `/api/workspaces/:id/members` somente ao abrir o formulário. A resposta contém id/nome dos membros reais, incluindo a própria pessoa; não cria convites nem gestão de equipe. Com um único membro, a interface explica que ele pode assumir a tarefa ou deixá-la sem responsável. Em falha da consulta, há nova tentativa e o formulário é preservado.

Prazo é uma data civil, sem hora. O input envia `AAAA-MM-DD`; a API salva meia-noite UTC e o cartão formata o mesmo dia usando UTC. Isso evita transformar, por exemplo, 20/11 em 19/11 em Porto Velho. Limpar prazo ou responsável envia `null`. Atraso compara o dia do prazo com o dia local do navegador e não marca cartões de Concluído como vencidos.

OWNER e ADMIN têm todas as operações de tarefas. MEMBER pode criar, consultar, editar e mover todas as tarefas do workspace, mas só vê Excluir nas suas próprias tarefas. A API repete a verificação. Essa permissão operacional não muda as restrições administrativas de workspaces/quadros.

### Visão geral e compatibilidade

O layout da Visão geral foi mantido. Um resumo simples mostra total de tarefas acessíveis, Em andamento, Concluídas e Em atraso. Uma única chamada de resumo executa contagens no PostgreSQL, sem carregar todos os cartões para contá-los. A lista de quadros recentes da etapa anterior permanece. Erro de resumo mostra mensagem/nova tentativa, sem números inventados.

`output: "export"`, `/quadros/detalhes/?id=...`, Suspense, cookies HTTP-only e proxy `/api` continuam iguais. O estado em memória reflete os dados da API; tarefas não são gravadas em localStorage/sessionStorage. O único sessionStorage existente continua sendo a preferência de workspace da Etapa 04. Respostas 401 acionam o AuthProvider existente; falhas de rede/503 não são tratadas como sessão expirada.

O CSS de movimento reduzido existente continua ativo. A rolagem do sensor de teclado usa `auto`; não foram adicionadas animações GSAP nem efeitos decorativos.

### Executar e testar

Na raiz, com PostgreSQL e os ambientes privados configurados:

```bash
docker compose up -d db
npm --prefix apps/server run start:dev
# Em outro terminal:
npm --prefix apps/web run dev
```

Abra `http://localhost:3000`. Em um checkout novo, execute `npm ci` em cada aplicação. Gere Prisma Client e aplique as duas migrações existentes conforme o README da API. Nenhuma migração foi acrescentada nesta etapa.

Verificações técnicas na raiz:

```bash
npm --prefix apps/server run lint
npm --prefix apps/server run build
npm --prefix apps/server test
npm --prefix apps/web run lint
npm --prefix apps/web test
NEXT_PUBLIC_API_URL=/api npm --prefix apps/web run build
```

Os testes HTTP precisam do banco isolado descrito no [README da API](../server/README.md#executar-e-testar), com `RUN_DATABASE_TESTS=true`. O build deve continuar gerando `apps/web/out/quadros/detalhes/index.html` e `_routes.json`.

Para o roteiro de navegador, reutilize Playwright/Chromium disponíveis no ambiente. Eles são opcionais e não fazem parte das dependências de produção. Informe `PLAYWRIGHT_MODULE` se o módulo estiver fora do projeto e `CHROMIUM_PATH` para usar um navegador já instalado. Com frontend/proxy e API temporários ligados ao banco de teste, execute:

```bash
export DATABASE_URL='postgresql://taskflow:taskflow_dev_123@localhost:5433/taskflow_etapa05_test_20261113?schema=public'
# BROWSER_BASE_URL é a origem do frontend de teste; padrão http://localhost:3100.
node apps/web/test/tasks.browser.mjs
```

O roteiro cria uma conta real pelo cadastro, seu workspace/quadro e um MEMBER de fixture; limpa somente esses registros ao terminar. Testa formulário, mouse, cancelamento, falha/rollback, touch pela alternativa, teclado, recarga, contagens, permissões e login/logout. Capturas ficam em `/tmp/taskflow-etapa05`. Usa o fuso America/Porto_Velho e movimento reduzido. Durante a validação, a exportação estática é servida com a própria `onRequest` da Pages Function em um adaptador HTTP local e API isolada na porta 3101. Isso valida o código do proxy; não equivale a repetir o runtime workerd.

### Resultados da Etapa 05

Verificação executada em **13/11/2026**, com exportação estática, a própria função do proxy, API e PostgreSQL de teste:

| Verificação | Resultado real |
| --- | --- |
| Lint web/server | Passaram, sem avisos |
| Builds Next.js/TypeScript e NestJS | Passaram |
| Exportação Cloudflare | `apps/web/out` contém a rota estática de detalhes e `_routes.json` |
| Testes unitários frontend | 26 passaram (5 arquivos); HTTP, validação, proxy, datas e ordenação |
| Testes de configuração backend | 25 passaram |
| Testes HTTP + PostgreSQL | 75 passaram, incluindo 30 casos da nova suíte |
| Roteiro de tarefas | 15 verificações completas passaram |
| Roteiro anterior de workspaces/quadros | 13 verificações completas passaram |
| Mouse | Reordenação, troca de coluna, destino vazio, cancelamento e um PATCH por drop passaram |
| Teclado | Arrasto por Espaço/setas e persistência passaram; diálogos mantêm o controle de foco |
| Touch/mobile | Alternativa Mover tarefa por toque passou; rolagem horizontal contida no Kanban |
| Datas | Definição, remoção e preservação do dia no fuso America/Porto_Velho passaram |
| Permissões | MEMBER criou/editou e excluiu somente sua tarefa; API bloqueou exclusão alheia |
| Rede e rollback | Falhas HTTP injetadas preservaram formulário ou reverteram a previsão visual; nova tentativa funcionou |
| Recarga e resumo | Dados, posição, responsáveis/prazos e contagens reais preservados |
| Layout/console | 320, 375, 768 e 1440 px sem overflow da página; zero erros JavaScript no roteiro final |

As capturas `/tmp/taskflow-etapa05/kanban-desktop.png` e `kanban-mobile.png` foram inspecionadas. O arrasto por ponteiro usa mouse/touch; a verificação automatizada de touch nesta entrega exercitou especificamente a alternativa por diálogo, sem afirmar teste de arrasto físico por toque. Não foi repetido workerd: foi validado o código da Pages Function no adaptador local. Nenhum deploy foi executado.

`npm test` aprovou os cinco arquivos. A contagem individual também foi verificada com `node --test --test-isolation=none --test-reporter=spec apps/web/test/*.test.mjs` na raiz. A suíte HTTP foi executada em banco separado com as duas migrações originais; não houve alteração do schema.

Foi corrigida no backend a aceitação indevida de PATCH vazio. Na integração do dnd-kit, os callbacks de ref foram desestruturados para que o lint não confundisse o objeto do hook com uma leitura de ref durante renderização. A movimentação também reconcilia por GET após uma falha, além de restaurar o snapshot. O roteiro aguarda a confirmação da API antes de comparar o banco, distingue carregamento dos responsáveis e espera o layout estabilizar após mudar o viewport — redimensionar durante um gesto cancela o sensor por design da biblioteca.

O build conserva o aviso ambiental sobre um package-lock no diretório pessoal fora do repositório. A instalação com npm reportou os mesmos 7 alertas moderados já documentados em ferramentas do frontend; não foram realizadas atualizações de manutenção fora desta etapa. Os servidores temporários de validação foram encerrados. Não houve git add, commit, push, merge ou alteração de dados reais.

As 14 explicações didáticas sobre tarefas, chaves estrangeiras, Prisma, CRUD, drag-and-drop, posição, transação, rollback e concorrência estão no [README da API](../server/README.md#explicação-para-entrevistas--tarefas).

Limitações: outras pessoas veem atualizações ao consultar novamente, sem WebSockets. Não há convites, gestão de membros, notificações, comentários, anexos, automações ou deploy. O escopo termina na Etapa 05.
