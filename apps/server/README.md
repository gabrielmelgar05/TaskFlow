# TaskFlow — API (Etapa 02)

API NestJS 12 em TypeScript/ESM, com Prisma 7, PrismaPg e PostgreSQL. Nesta etapa existe somente `GET /api/health`. O schema e as migrações anteriores foram preservados.

## Executar localmente

Na raiz do repositório:

```bash
docker compose up -d db
npm --prefix apps/server run start:dev
```

O arquivo `apps/server/.env` já existente é carregado pelo `ConfigModule`. Em um checkout novo, copie `.env.example` para `.env` **somente se o arquivo ainda não existir** e substitua os valores de exemplo pelos do seu PostgreSQL local. Não versione esse arquivo.

| Variável | Responsabilidade |
| --- | --- |
| `DATABASE_URL` | Conexão privada com PostgreSQL. O Docker existente publica a porta `5433`. |
| `PORT` | Porta HTTP da API; padrão `3001`. |
| `CORS_ORIGIN` | Origem exata do frontend; padrão `http://localhost:3000`. Aceita outras origens explícitas, separadas por vírgulas. |

Origens não incluem caminho nem barra final. `http://127.0.0.1:3000` é uma origem diferente de `http://localhost:3000`. Adicione-a explicitamente se for utilizá-la.

Depois do build, `npm --prefix apps/server run start:prod` executa o JavaScript compilado. Para regenerar o client em um novo checkout, use, em `apps/server`, `npm exec -- prisma generate --config prisma7.config.ts`. Isso gera código; não altera tabelas nem migrações. Nenhuma dependência nova é necessária nesta etapa.

## Organização dos arquivos

| Arquivo | Responsabilidade |
| --- | --- |
| `src/main.ts` | Inicializa o Nest, aplica a configuração HTTP, lê a porta validada e habilita encerramento gracioso. |
| `src/app.module.ts` | Reúne os módulos de configuração, Prisma e saúde. |
| `src/config/environment.ts` | Valida as variáveis antes de iniciar; erros nunca incluem a URL privada. |
| `src/configure-app.ts` | Define o prefixo `/api` e as origens permitidas por CORS. Também é usado nos testes HTTP. |
| `src/prisma/prisma.module.ts` | Registra e exporta o mesmo `PrismaService` para os módulos consumidores. |
| `src/prisma/prisma.service.ts` | Única instância do Prisma Client gerenciada pelo Nest, com adapter `PrismaPg`, pool de até 10 conexões e limites de 3 segundos para conexão e consulta. Fecha as conexões no encerramento. |
| `src/health/health.module.ts` | Conecta o módulo Prisma ao controller e service de saúde. |
| `src/health/health.controller.ts` | Expõe `GET /api/health`, com `Cache-Control: no-store`. |
| `src/health/health.service.ts` | Executa `SELECT 1` no PostgreSQL e converte falhas em HTTP 503 com mensagem segura. |
| `src/config/environment.spec.ts` | Testa valores padrão, conversão, validação e proteção das mensagens. |
| `test/health.e2e-spec.ts` | Testa respostas HTTP, falhas, CORS, prefixo e, opcionalmente, a conexão real. |
| `.env.example` | Documenta a configuração sem credenciais reais. |

O Prisma abre a conexão na primeira consulta. Não usamos uma conexão obrigatória no início da aplicação: isso permite que o endpoint responda **503**, inclusive quando o banco já estiver fora do ar durante a inicialização. Nenhum client é criado por requisição, e as conexões não são fechadas depois de cada consulta.

## Fluxo da consulta

```text
React no navegador
  → GET http://localhost:3001/api/health
  → HealthController
  → HealthService
  → PrismaService (Prisma Client + PrismaPg)
  → PostgreSQL: SELECT 1
  → JSON + HTTP 200 ou 503
  → React atualiza o aviso de conexão
```

Banco acessível — HTTP **200**:

```json
{ "status": "ok", "database": "up" }
```

Falha de conexão ou consulta — HTTP **503**:

```json
{
  "status": "error",
  "database": "down",
  "message": "O serviço está temporariamente indisponível. Tente novamente em instantes."
}
```

O endpoint verifica conectividade por uma consulta real. Ele não consulta projetos, não comprova migrações e não altera dados. Detalhes da exceção, host, usuário e senha não entram na resposta.

## Verificações

Na raiz:

```bash
npm --prefix apps/server run build
npm --prefix apps/server run lint
npm --prefix apps/server test
npm --prefix apps/server run test:e2e
RUN_DATABASE_TESTS=true npm --prefix apps/server run test:e2e
curl -i http://localhost:3001/api/health
```

O último comando de testes habilita a consulta ao PostgreSQL real definido em `.env`. Sem `RUN_DATABASE_TESTS=true`, esse teste fica explicitamente ignorado; os cinco testes HTTP com banco substituído continuam executando. Os testes HTTP abrem portas locais temporárias.

Validação executada nesta entrega: build e lint passaram, **16 testes de configuração passaram** e **6 testes HTTP passaram com a integração real habilitada**. A API em execução respondeu 200 com o PostgreSQL local. Outra instância temporária, apontando para uma porta inacessível, respondeu 503 sem expor a conexão; o banco existente não foi interrompido.

O PostgreSQL acessado pela porta `5433` identificou-se como **17.11, Alpine**. O socket do Docker negou acesso a `docker compose ps` neste ambiente; por isso, o estado do contêiner não foi inspecionado pelo CLI. A conexão e a consulta reais foram verificadas diretamente pela porta configurada no Compose.

## Limite da etapa

Não foram implementados autenticação, autorização, CRUD, tarefas, quadros persistidos ou Kanban. O banco existente e os dados não foram modificados. CORS controla o acesso pelo navegador e não substitui autenticação de uma futura API.

Referências consultadas: [integração NestJS/Prisma](https://docs.nestjs.com/recipes/prisma), [configuração do NestJS](https://docs.nestjs.com/techniques/configuration) e [conexões no Prisma 7](https://www.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/databases-connections/connection-management).
