# Etapa 07 — relatório de implementação e auditoria

Data: 14/11/2026. Escopo concluído localmente, sem deploy, commit, push ou alteração da stack.

## Acabamento visual

A paleta clara com sidebar escura foi preservada. A escala operacional passou para 15–16 px, com auxiliares de 13–14 px, títulos de seção de 20–22 px e números de métricas de 48 px no desktop. A sidebar usa 244 px, ou 230 px no breakpoint intermediário, e a área principal pode chegar a 1600 px.

Foram removidos o ponto redundante da navegação ativa, o card “Menos ruído. Mais fluxo.” e as setas decorativas de botões. O sistema continua com somente Visão geral e Quadros. Botões têm quatro variantes, altura mínima de 44 px, hover, foco, estados de indisponibilidade e feedback de processamento. Inputs, labels, perfil, badges, cards, colunas e modais receberam ajustes de dimensão, contraste e espaçamento.

Os seletores existentes usam o mesmo Radix Select, com menu personalizado, opções de 44 px, teclado, touch, foco e fechamento externo. O portal de um select em modal permanece dentro do diálogo nativo.

Os estilos foram separados por responsabilidade em `src/styles`; tokens de cor, fonte e controles ficam em `globals.css`. Não foram adicionados temas ou animações.

O anexo fornecido nesta sessão continha somente o texto do pedido. As capturas originais mencionadas nele não estavam disponíveis. Os problemas descritos foram conferidos no código e no navegador; capturas anteriores da exportação existente foram produzidas antes do novo build para comparação.

## Kanban e persistência

A alça com dnd-kit organiza as tarefas entre as colunas do quadro, incluindo suporte a teclado. A ação **Mover tarefa** permite escolher coluna e posição com mouse, teclado e touch. A interface antecipa a movimentação, reverte em falha e reconcilia a ordem com a API.

`PATCH /api/tasks/:id/move` valida a sessão, as permissões, a coluna do quadro atual e a posição. Criação, exclusão e movimentação usam um lock no quadro para serializar escritas. A mudança de coluna e a compactação da ordem ocorrem na mesma transação, preservando os demais campos da tarefa.

**Banco:** nenhum modelo ou migration alterado. A persistência continua usando os campos `columnId` e `position` existentes. A validação utiliza banco de teste separado, sem migrações ou alteração de dados de uso.

## Segurança e confiabilidade

A auditoria confirmou Argon2id, tokens aleatórios com hash no banco, expiração no servidor, cookie HttpOnly/SameSite e Secure obrigatório em produção, CSRF por Origin, proxy autenticado, limites de login/cadastro e validação de DTOs. Os testes exercitaram IDOR, papéis, dados de terceiros, campos extras, erros seguros e rollback. Os arquivos privados rastreados foram conferidos: somente exemplos de ambiente estão no Git. `.dev.vars` e `.wrangler` agora têm proteção explícita no `.gitignore` raiz.

A suíte histórica de autenticação também passou a exigir banco isolado e limpar as próprias contas, corrigindo o resíduo de dois fixtures por execução. O erro de logout permanece visível no menu após uma falha, com nova tentativa, sem invalidar a sessão local prematuramente.

A auditoria npm inicial encontrou 7 alertas moderados no tooling do frontend e 5 no tooling do backend, incluindo 2 altos. Atualizações automáticas compatíveis não os resolveram. Overrides restritos corrigiram `minimatch` para 11.0.8 na cadeia de `@typescript-eslint/typescript-estree`, `undici` para 6.29.1 em `@nestjs/mau` e `tmp` para 0.2.7 em `external-editor`. O smoke test de criação/limpeza de arquivo temporário do tooling passou. Não foi executado o comando de deploy.

O `npm audit` final dos dois aplicativos retornou **zero alertas conhecidos**, resultado pontual que não equivale a ausência de vulnerabilidades.

## Verificações realmente executadas

| Verificação                                                | Resultado                                                                            |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Frontend: `npm run lint`                                   | Passou                                                                               |
| Backend: `npm run lint`                                    | Passou                                                                               |
| Frontend: `npm test`                                       | 6 arquivos passaram                                                                  |
| Backend: `npm test`                                        | 25 testes passaram                                                                   |
| Backend: `RUN_DATABASE_TESTS=true npm run test:e2e`        | 91 testes em 5 suítes passaram, sem skips                                            |
| Frontend: `NEXT_PUBLIC_API_URL=/api npm run build`         | Passou, com TypeScript e exportação `out`                                            |
| Backend: `npm run build`                                   | Passou                                                                               |
| `prisma validate --config prisma7.config.ts`               | Schema válido                                                                        |
| `prisma migrate status --config prisma7.config.ts`         | 3 migrações; atualizado no banco isolado e no local configurado                      |
| `test/column-status-migration.mjs`                         | Preservou 3 tarefas e todos os registros anteriores; status preenchido corretamente  |
| `test/boards.browser.mjs`                                  | Passou: CRUD, papéis, exclusões, seleção, sessão e recuperação                       |
| `test/tasks.browser.mjs`                                   | Passou: formulários, datas, drag esquerdo, teclado/touch, rollback e persistência    |
| `test/dashboard.browser.mjs`                               | Passou: métricas reais após edição, conclusão, criação/exclusão, isolamento e perfil |
| `test/quality.browser.mjs`                                 | Passou: formulários, indicadores, perfil, logout/login e expiração                   |
| Axe WCAG 2 A/AA e 2.1 AA nas telas auditadas               | Sem violações detectadas, incluindo select aberto em 320 e 1440 px                   |
| Capturas e overflow em 320, 375, 768, 1024, 1440 e 1920 px | Passaram nas telas cobertas; Kanban com rolagem interna                              |
| `npm audit` frontend e backend                             | Zero alertas conhecidos em ambos                                                     |
| `git diff --check`                                         | Passou                                                                               |

Os testes HTTP cobrem autorização, colunas válidas, ordenação, criação concorrente, rollback e persistência das tarefas.

Login, cadastro, dashboard, quadros, Kanban, perfil e edição foram capturados nas seis larguras. As capturas de extremos e componentes foram inspecionadas visualmente. Contrastes calculados de exemplos: texto secundário/fundo 5,86:1; prioridades 4,91:1 a 5,71:1; foco/fundo 5,88:1; borda de controle/fundo 3,03:1.

A exportação contém `index.html`, `login/index.html`, `cadastro/index.html`, `quadros/index.html`, `quadros/detalhes/index.html` e `_routes.json`. Não foram adicionadas dependências de servidor Next.

## Evidências locais

Diretório: `/tmp/taskflow-etapa07`.

- Comparação com os mesmos dados: `baseline-dashboard-1440.png` / `after-dashboard-1440.png`, e equivalentes de `boards` e `kanban`.
- Telas finais: `login`, `cadastro`, `dashboard`, `quadros`, `kanban`, `modal-editar` e `perfil`, com sufixos das seis larguras.
- Popups abertos: `select-prioridade-320.png` e `select-prioridade-1440.png`.

Os screenshots usam somente fixtures persistidos nos bancos isolados. Os roteiros removem os próprios registros ao encerrar. Os bancos de teste permanecem criados com seus schemas; nenhum banco existente foi removido.

## Limites e pendências

- Axe e inspeção visual cobrem as telas e estados exercitados, sem constituir certificação integral de acessibilidade.
- Rate limiting continua em memória por instância. Sessões expiradas permanecem no banco; ambos são limites preexistentes documentados.
- Os overrides corrigem versões transitivas enquanto os pacotes superiores ainda as exigem. Devem ser revistos ao atualizar essas ferramentas.
- O build informa um lockfile fora deste repositório em `/home/gabriel-melgar`; ele é ignorado e não impede a exportação.
- Os processos temporários locais foram encerrados após os testes. Nenhum deploy foi realizado nesta etapa.

## Referências técnicas consultadas

[Radix Select](https://www.radix-ui.com/primitives/docs/components/select). As orientações da versão instalada do Next.js sobre CSS e exportação estática foram lidas em `apps/web/node_modules/next/dist/docs`.

## Arquivos

Nenhum arquivo versionado foi removido. A extração dos estilos preserva os seletores, com os refinamentos descritos acima. Os READMEs dos aplicativos foram consolidados para remover instruções históricas contraditórias.

### Criados

- `README.md`
- `apps/web/src/components/ui/select.tsx`
- `apps/web/src/styles/boards.css`
- `apps/web/src/styles/controls.css`
- `apps/web/src/styles/dashboard.css`
- `apps/web/src/styles/forms.css`
- `apps/web/src/styles/layout.css`
- `apps/web/src/styles/tasks.css`
- `apps/web/test/browser-select.mjs`
- `apps/web/test/quality.browser.mjs`
- `docs/ETAPA_07.md`

### Alterados

- `.gitignore`
- `apps/server/README.md`
- `apps/server/package-lock.json`
- `apps/server/package.json`
- `apps/server/src/tasks/tasks.controller.ts`
- `apps/server/src/tasks/tasks.service.ts`
- `apps/server/test/auth.e2e-spec.ts`
- `apps/server/test/dashboard.e2e-spec.ts`
- `apps/server/test/tasks.e2e-spec.ts`
- `apps/server/test/workspaces-boards.e2e-spec.ts`
- `apps/web/README.md`
- `apps/web/eslint.config.mjs`
- `apps/web/package-lock.json`
- `apps/web/package.json`
- `apps/web/src/app/globals.css`
- `apps/web/src/components/auth/auth-form.tsx`
- `apps/web/src/components/layout/app-shell.tsx`
- `apps/web/src/components/layout/connection-notice.tsx`
- `apps/web/src/components/layout/profile-menu.tsx`
- `apps/web/src/components/ui/action-menu.tsx`
- `apps/web/src/components/ui/button.tsx`
- `apps/web/src/components/ui/dialog.tsx`
- `apps/web/src/components/ui/section-card.tsx`
- `apps/web/src/features/boards/board-screen.tsx`
- `apps/web/src/features/boards/boards-screen.tsx`
- `apps/web/src/features/dashboard/dashboard-screen.tsx`
- `apps/web/src/features/tasks/components/task-board.tsx`
- `apps/web/src/features/tasks/components/task-card.tsx`
- `apps/web/src/features/tasks/components/task-column.tsx`
- `apps/web/src/features/tasks/components/task-form.tsx`
- `apps/web/src/features/tasks/components/task-move-dialog.tsx`
- `apps/web/src/features/workspaces/workspace-toolbar.tsx`
- `apps/web/test/boards.browser.mjs`
- `apps/web/test/dashboard.browser.mjs`
- `apps/web/test/tasks.browser.mjs`
