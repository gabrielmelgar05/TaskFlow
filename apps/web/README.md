# TaskFlow — Web (Etapa 03)

Next.js com **exportação estática**, React, TypeScript e Tailwind CSS. A identidade da Etapa 02 foi preservada. A Etapa 03 acrescenta telas de acesso, sessão persistente, proteção das páginas e um proxy isolado em Cloudflare Pages Functions; não acrescenta SSR, Server Actions, autenticação social ou gerenciamento de projetos.

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
| `/quadros/` | Estado vazio, agora exigindo sessão. Continua sem CRUD ou Kanban. |

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

A proteção visual não torna arquivos estáticos secretos. Os recursos compilados continuam sendo arquivos públicos; os dados privados precisam vir de endpoints protegidos. O `AuthGuard` global já implementado no NestJS protege as rotas da API por padrão. A autorização dos futuros quadros/tarefas ainda precisará ser implementada no backend.

## Cliente HTTP

`src/lib/api.ts` reutiliza o cliente da Etapa 02, agora com:

- Métodos GET/POST, JSON, cookies e timeout de 15 segundos.
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

### Resultado final desta entrega

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

Não foram implementados OAuth, confirmação de e-mail, recuperação de senha, edição de perfil, workspaces, quadros persistidos, tarefas ou Kanban. Não houve deploy, git add, commit, push ou remoção de dados. Sessões expiradas permanecem no banco e os contadores de tentativas são locais à instância da API. Um backend com inicialização demorada pode exigir uma nova tentativa após o timeout; a interface distingue essa falha de uma sessão inválida.

A auditoria npm do frontend encontrou **7 alertas moderados em dependências transitivas das ferramentas de lint** (cadeia typescript-eslint/minimatch), sem alertas altos/críticos. A atualização dessa cadeia existente ficou registrada para manutenção, sem alterações fora do escopo da autenticação.

Referências: [Next.js estático no Pages](https://developers.cloudflare.com/pages/framework-guides/nextjs/deploy-a-static-nextjs-site/), [Pages Functions localmente](https://developers.cloudflare.com/pages/functions/local-development/), [bindings/variáveis de ambiente](https://developers.cloudflare.com/pages/functions/bindings/), [roteamento das Functions](https://developers.cloudflare.com/pages/functions/routing/).
