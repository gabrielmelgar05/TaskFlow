# TaskFlow — Web (Etapa 02)

Estrutura visual inicial em Next.js, React, TypeScript e Tailwind CSS, inspirada na referência fornecida: fundo creme, navegação escura, detalhes rosa, azul e amarelo, cantos suaves e uma hierarquia simples.

## Executar localmente

Com o PostgreSQL e a API iniciados, abra outro terminal na raiz:

```bash
npm --prefix apps/web run dev
```

Acesse `http://localhost:3000`. O arquivo `apps/web/.env.local` existente contém:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

Em um novo checkout, copie `.env.example` para `.env.local` apenas se ele ainda não existir. A URL inclui `/api`, mas não `/health`. Ela é pública: nunca coloque senha ou URL do PostgreSQL nessa variável. Reinicie o desenvolvimento ou refaça o build após alterá-la.

## Páginas e comportamento

- `/`: visão geral, apresentação do espaço e estado vazio para os futuros quadros.
- `/quadros/`: estado vazio da área de quadros e indicação explícita de que a criação estará disponível em outra etapa.
- Os links da sidebar, da apresentação e de retorno navegam entre páginas reais. Não há ações simuladas nem métricas de projetos.
- A navegação fica no topo em telas pequenas; a página também permite pular para o conteúdo usando teclado.
- Quando a API ou o banco falham, um aviso curto permite tentar novamente. Durante a nova consulta, o botão fica desabilitado e mostra o progresso. A navegação continua disponível.
- Uma consulta bem-sucedida não insere informações técnicas na interface. A checagem acontece ao abrir o aplicativo e quando o usuário tenta novamente; não existe monitoramento contínuo.

O frontend ainda não busca listas de quadros. Os estados vazios comunicam o escopo desta etapa e não representam uma consulta aos registros existentes no banco.

## Organização dos arquivos

| Arquivo | Responsabilidade |
| --- | --- |
| `src/app/layout.tsx` | Define idioma, metadados e layout compartilhado. |
| `src/app/page.tsx` | Conteúdo da visão geral. Os números 01–03 indicam passos de apresentação, não métricas. |
| `src/app/quadros/page.tsx` | Página real de quadros com estado vazio e retorno à visão geral. |
| `src/app/globals.css` | Paleta Tailwind, estilos do layout, breakpoints, foco e preferência por movimento reduzido. |
| `src/app/icon.svg` | Ícone da marca TaskFlow para o navegador. |
| `src/components/layout/app-shell.tsx` | Marca, sidebar, link ativo, cabeçalho, conteúdo e rodapé responsivos. |
| `src/components/layout/connection-notice.tsx` | Consulta a API, trata erro, permite nova tentativa e cancela a requisição ao desmontar. |
| `src/components/ui/button.tsx` | Botão de ação e link com aparência de botão. Mantém a semântica de cada elemento. |
| `src/components/ui/icon.tsx` | Pequeno conjunto de ícones SVG usados nesta etapa. |
| `src/components/ui/section-card.tsx` | Card reutilizável com título, descrição opcional e ação opcional. |
| `src/components/ui/empty-state.tsx` | Estado vazio reutilizável, com ilustração decorativa e texto. |
| `src/components/overview/flow-illustration.tsx` | Ilustração decorativa feita em SVG, sem conteúdo de projetos reais. |
| `src/lib/api.ts` | Comunicação HTTP tipada, timeout de 8 segundos e validação da resposta de saúde. |
| `next.config.ts` | Exportação estática com barra final nas rotas. |
| `package.json` | Scripts existentes de desenvolvimento/lint e build com Webpack. |
| `.gitignore` | Mantém arquivos privados ignorados e permite versionar os exemplos públicos de ambiente. |
| `.env.example` | Exemplo público do endereço da API. |

As fontes usam a pilha local do sistema. O build não precisa baixar fontes. Não foram adicionadas bibliotecas. GSAP continua instalado, mas esta etapa não exige animações além de transições discretas em CSS; `prefers-reduced-motion` reduz essas transições.

## Integração e exportação estática

```text
ConnectionNotice → getHealth() → GET /api/health
→ NestJS → PrismaPg → PostgreSQL
→ resposta validada → aviso somente em caso de falha
```

A consulta acontece em um efeito React no navegador, sem API Route, Server Action ou dependência do banco durante o build. O NestJS continua sendo uma aplicação separada. Veja [a documentação da API](../server/README.md) para configuração e fluxo completo.

```bash
npm --prefix apps/web run lint
npm --prefix apps/web run build
```

O build gera `apps/web/out/`, com `index.html`, `quadros/index.html` e os recursos estáticos. Esse diretório é a base para futura hospedagem no Cloudflare Pages. `NEXT_PUBLIC_API_URL` precisa apontar para a API pública no momento desse build; essa API também precisará permitir a origem do site em `CORS_ORIGIN`.

O script de build usa `next build --webpack`, uma opção do próprio Next.js. O Turbopack encontrou um bloqueio ao abrir a porta interna do compilador neste ambiente; Webpack permitiu executar e validar a exportação normalmente. O antigo script `next start` foi removido porque depende de um servidor Next.js e não serve `output: "export"`. Para desenvolver, use `npm run dev`; para hospedagem estática, utilize `out/`.

## Validação realizada

- Lint e build estático passaram, incluindo a verificação TypeScript do Next.js.
- Chrome/Playwright já disponíveis no ambiente foram usados sem instalar dependências.
- Navegação pelas duas rotas, link ativo e ausência de rolagem horizontal verificados em **1440, 1024, 768, 390 e 320 px**.
- Acesso direto e recarga de `/quadros/` verificados na exportação estática.
- Link de pular para o conteúdo por teclado e `prefers-reduced-motion` verificados.
- Comunicação real do navegador com NestJS, PrismaPg e PostgreSQL verificada, sem erros JavaScript na navegação normal.
- Falha HTTP 503 e falha de rede simuladas no navegador: aviso exibido e navegação preservada. A nova tentativa recuperou a conexão real após remover a falha simulada.

A verificação de navegador foi executada em um script temporário usando as ferramentas já instaladas; ela não foi adicionada como dependência ou suíte de testes do frontend.

## Próxima etapa

Criação e listagem persistidas de quadros, tarefas, autenticação e Kanban ficaram pendentes. Nenhuma dessas funcionalidades foi antecipada nesta entrega. Não houve publicação, commit, push ou alteração de schema/migrações.
