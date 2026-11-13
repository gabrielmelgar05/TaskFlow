# TaskFlow — API (Etapa 03)

NestJS 12 + TypeScript/ESM + Prisma 7/PrismaPg + PostgreSQL. A Etapa 02 permanece disponível; a Etapa 03 acrescenta cadastro, login, sessão persistente, logout e proteção da API. Workspaces, quadros e tarefas continuam fora do escopo.

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

O `AuthGuard` é global: novas rotas exigem sessão por padrão. Somente rotas marcadas com `@Public()` dispensam a sessão. Isso não implementa autorização de futuros quadros/tarefas; essa autorização deverá verificar o dono ou membro permitido ao buscar dados.

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
RUN_DATABASE_TESTS=true npm --prefix apps/server run test:e2e
```

O último comando habilita os testes com PostgreSQL real. Execute em banco local/de testes: são criadas contas únicas `auth-e2e-*`/`auth-test-*` com domínio `example.invalid`. Nenhuma conta anterior é alterada ou removida. Os testes mantêm esses registros isolados; não há comando de limpeza de dados. Sem a variável, os testes de banco ficam explicitamente ignorados, enquanto saúde com mock e rate limiting continuam executando.

Os testes cobrem cadastro válido, DTOs, e-mail duplicado, unicidade no banco, concorrência, senha inválida, login correto/incorreto, e-mail exato, sessão válida/inválida/expirada, logout e reuso do token, atributos do cookie, CORS, CSRF, proxy confiável, rate limiting, proteção padrão e ausência de dados privados no JSON.

A validação completa também passou pelo Chrome + Wrangler/workerd: o navegador usou `/api`, que encaminhou as requisições ao NestJS e ao PostgreSQL real. A instância temporária da API foi encerrada para verificar 502 seguro no proxy e mensagem de conexão no frontend, sem redirecionamento indevido para login. O processo já existente na porta 3001 não foi interrompido; os testes de navegador usaram uma instância isolada na porta 3101.

### Resultado final desta entrega

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
2. **Autorização:** verifica o que essa pessoa pode acessar ou alterar. Estar autenticado não permitirá, por si só, acessar os quadros de outra pessoa. Essa regra será implementada junto aos recursos futuros.
3. **Senhas não são salvas diretamente:** um vazamento de texto puro entregaria imediatamente todas as senhas. O banco guarda somente o resultado do hash.
4. **Hash de senha:** transformação de mão única, com salt e custo de processamento/memória. Argon2id verifica se a senha recebida corresponde ao resultado armazenado; não precisamos recuperar a senha original.
5. **Sessão:** registro no servidor que liga um token aleatório a um usuário e a uma data de expiração. Ela permite reconhecer requisições seguintes e encerrar o acesso no logout.
6. **Cookie HTTP-only:** o navegador guarda e envia o cookie, mas o JavaScript da página não consegue ler seu conteúdo. `Secure` restringe seu envio a HTTPS; `SameSite` ajuda a limitar requisições entre sites. A validação de Origin complementa essa proteção.
7. **AuthGuard:** guard do NestJS executado antes do controller. Ele rejeita sessões ausentes/inválidas/expiradas e anexa o usuário público à requisição quando a sessão é válida.
8. **Como React sabe da sessão:** chama `/api/auth/me` com `credentials: "include"`. O `AuthProvider` guarda somente o estado e os dados públicos em memória. Ao atualizar a página, essa consulta é feita novamente usando o cookie persistido pelo navegador.
9. **Como Prisma recupera o usuário:** no login, faz busca exata pelo e-mail normalizado. Nas requisições privadas, busca `Session` pelo hash do token e segue a relação `session.user`, selecionando apenas `id`, `name` e `email`.
10. **Quando a sessão expira:** o backend retorna 401 mesmo que alguém ainda tenha o token. O frontend deixa de exibir a área privada e encaminha para login. Uma falha de rede ou do banco recebe outro tratamento: mensagem de conexão e nova tentativa, sem concluir que a sessão é inválida.
