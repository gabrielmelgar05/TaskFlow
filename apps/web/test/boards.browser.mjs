// Verificação opcional com Playwright já instalado, sem dependência de produção.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { PrismaClient } from "../../server/dist/generated/prisma/client.js";
const requireServer = createRequire(
  new URL("../../server/package.json", import.meta.url),
);
const { PrismaPg } = requireServer("@prisma/adapter-pg");
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ?? "playwright"
);
const databaseUrl = process.env.DATABASE_URL ?? "";
if (!/^taskflow_etapa0[456]_test/.test(new URL(databaseUrl).pathname.slice(1)))
  throw new Error(
    "Use somente um banco isolado taskflow_etapa04_test*, taskflow_etapa05_test* ou taskflow_etapa06_test*.",
  );
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});
const baseURL = process.env.BROWSER_BASE_URL ?? "http://localhost:3100";
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH }
    : {}),
});
const context = await browser.newContext({
  baseURL,
  viewport: { width: 1440, height: 1000 },
  reducedMotion: "reduce",
});
const page = await context.newPage();
page.setDefaultTimeout(15000);
const prefix = `browser04-${randomUUID()}`;
const email = `${prefix}@example.invalid`;
const password = "Uma frase longa de navegador 2026!";
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const report = (message) => console.log(`PASS ${message}`);
const visible = async (locator) => {
  await locator.waitFor({ state: "visible" });
};
const absent = async (locator) => assert.equal(await locator.count(), 0);
async function dialogSubmit(title, label, value) {
  const dialog = page.getByRole("dialog", { name: title, exact: true });
  await visible(dialog);
  const field = dialog.getByLabel(label, { exact: true });
  assert.equal(
    await field.evaluate((element) => document.activeElement === element),
    true,
  );
  await field.fill(value);
  await dialog.getByRole("button", { name: title, exact: true }).click();
  await dialog.waitFor({ state: "detached" });
}
async function manageWorkspace(action) {
  await page.getByLabel(/^Gerenciar workspace /).click();
  await page.getByRole("button", { name: action, exact: true }).click();
}
async function manageBoard(action) {
  await page
    .getByLabel(/^Ações do quadro /)
    .first()
    .click();
  await page.getByRole("button", { name: action, exact: true }).click();
}
async function assertFits(width) {
  await page.setViewportSize({ width, height: 950 });
  await page.waitForFunction(
    () => document.documentElement.scrollWidth <= window.innerWidth,
    undefined,
    { timeout: 5000 },
  );
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
    `overflow em ${width}px`,
  );
}
try {
  await page.goto("/cadastro/");
  await page
    .getByLabel("Nome completo", { exact: true })
    .fill("Pessoa Navegadora");
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByLabel("Confirmar senha", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Criar minha conta", exact: true })
    .click();
  await page.waitForURL(baseURL + "/");
  await page
    .getByRole("navigation", { name: "Navegação principal" })
    .getByRole("link", { name: "Quadros", exact: true })
    .click();
  await visible(
    page.getByRole("heading", {
      name: "Organize seus projetos em um só lugar",
    }),
  );
  assert.equal(
    await page
      .getByRole("navigation", { name: "Navegação principal" })
      .getByRole("link")
      .count(),
    2,
  );
  report("sessão real, primeiro acesso e somente duas opções na navegação");

  await page
    .getByRole("button", { name: "Criar workspace", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await visible(dialog);
  await dialog
    .getByRole("button", { name: "Criar workspace", exact: true })
    .click();
  await visible(dialog.getByRole("alert"));
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "detached" });
  assert.equal(
    await page
      .getByRole("button", { name: "Criar workspace", exact: true })
      .evaluate((element) => element === document.activeElement),
    true,
  );
  report("validação, Escape e restauração do foco");

  await page
    .getByRole("button", { name: "Criar workspace", exact: true })
    .click();
  await dialogSubmit(
    "Criar workspace",
    "Nome do workspace",
    "Meu primeiro workspace",
  );
  await visible(page.getByRole("heading", { name: "Nenhum quadro por aqui" }));
  assert.equal(
    await page.getByLabel("Workspace atual").inputValue(),
    (
      await prisma.workspace.findFirstOrThrow({
        where: { members: { some: { user: { email } } } },
      })
    ).id,
  );
  report(
    "criação e seleção automática do primeiro workspace; vazio sem quadros",
  );

  await page
    .getByRole("button", { name: "Criar quadro", exact: true })
    .first()
    .click();
  await dialogSubmit("Criar quadro", "Nome do quadro", "Projeto de portfólio");
  await visible(page.getByRole("heading", { name: "Projeto de portfólio" }));
  await page.getByRole("link", { name: "Abrir quadro", exact: true }).click();
  await page.waitForURL(/\/quadros\/detalhes\/\?id=/);
  for (const name of ["A fazer", "Em andamento", "Concluído"])
    await visible(page.getByRole("heading", { name, exact: true }));
  assert.equal(
    await page.getByText("Nenhuma tarefa", { exact: true }).count(),
    3,
  );
  await absent(page.getByRole("button", { name: /Adicionar tarefa/ }));
  await page.reload();
  await visible(page.getByRole("heading", { name: "Projeto de portfólio" }));
  await assertFits(1440);
  await assertFits(375);
  await mkdir("/tmp/taskflow-etapa04", { recursive: true });
  await page.screenshot({
    path: "/tmp/taskflow-etapa04/kanban-mobile.png",
    fullPage: true,
  });
  await assertFits(1440);
  await page.screenshot({
    path: "/tmp/taskflow-etapa04/kanban-desktop.png",
    fullPage: true,
  });
  report(
    "criação, rota estática, colunas da API, recarga e Kanban em mobile/desktop",
  );

  await page.getByRole("link", { name: "← Voltar aos quadros" }).click();
  await page.waitForURL(baseURL + "/quadros/");
  await manageBoard("Renomear quadro");
  await dialogSubmit("Renomear quadro", "Nome do quadro", "Projeto renomeado");
  await visible(page.getByRole("heading", { name: "Projeto renomeado" }));
  await manageWorkspace("Renomear workspace");
  await dialogSubmit(
    "Renomear workspace",
    "Nome do workspace",
    "Workspace renomeado",
  );
  await page
    .getByRole("option", { name: "Workspace renomeado" })
    .waitFor({ state: "attached" });
  await page.reload();
  await visible(page.getByRole("heading", { name: "Projeto renomeado" }));
  report("renomeação de quadro e workspace persistida após recarga");

  await page
    .getByRole("button", { name: "Criar workspace", exact: true })
    .click();
  await dialogSubmit(
    "Criar workspace",
    "Nome do workspace",
    "Segundo workspace",
  );
  await visible(page.getByRole("heading", { name: "Nenhum quadro por aqui" }));
  await page
    .getByLabel("Workspace atual")
    .selectOption({ label: "Workspace renomeado" });
  await visible(page.getByRole("heading", { name: "Projeto renomeado" }));
  await page.getByRole("link", { name: "Abrir quadro", exact: true }).click();
  await page.getByRole("link", { name: "← Voltar aos quadros" }).click();
  await page.waitForURL(baseURL + "/quadros/");
  await visible(page.getByRole("heading", { name: "Projeto renomeado" }));
  await page.reload();
  await visible(page.getByRole("heading", { name: "Projeto renomeado" }));
  report("alternância e seleção preservada ao navegar e recarregar");

  await manageBoard("Excluir quadro");
  await visible(page.getByRole("dialog", { name: "Excluir quadro" }));
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await visible(page.getByRole("heading", { name: "Projeto renomeado" }));
  await manageBoard("Excluir quadro");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Excluir quadro", exact: true })
    .click();
  await visible(page.getByRole("heading", { name: "Nenhum quadro por aqui" }));
  report("cancelamento e confirmação explícita da exclusão de quadro");

  await page.route("**/api/workspaces", (route) => route.abort());
  await page.reload();
  await visible(
    page.getByRole("alert").filter({ hasText: "Não foi possível conectar" }),
  );
  assert.equal(new URL(page.url()).pathname, "/quadros/");
  await page.unroute("**/api/workspaces");
  await page
    .getByRole("button", { name: "Tentar novamente", exact: true })
    .click();
  await visible(page.getByRole("heading", { name: "Nenhum quadro por aqui" }));
  report("falha de conexão com nova tentativa, sem perder sessão");

  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const workspaceId = await page.getByLabel("Workspace atual").inputValue();
  const membership = { userId_workspaceId: { userId: user.id, workspaceId } };
  await prisma.workspaceMember.update({
    where: membership,
    data: { role: "MEMBER" },
  });
  await page.reload();
  await visible(page.getByText("Membro", { exact: true }));
  await absent(page.getByRole("button", { name: "Criar quadro", exact: true }));
  await absent(page.getByLabel(/^Gerenciar workspace /));
  const forbidden = await context.request.post(
    `/api/workspaces/${workspaceId}/boards`,
    { headers: { Origin: baseURL }, data: { name: "Proibido" } },
  );
  assert.equal(forbidden.status(), 403);
  await prisma.workspaceMember.update({
    where: membership,
    data: { role: "ADMIN" },
  });
  await page.reload();
  await visible(page.getByText("Administrador", { exact: true }));
  await visible(
    page.getByRole("button", { name: "Criar quadro", exact: true }).first(),
  );
  await page.getByLabel(/^Gerenciar workspace /).click();
  await visible(
    page.getByRole("button", { name: "Renomear workspace", exact: true }),
  );
  await absent(
    page.getByRole("button", { name: "Excluir workspace", exact: true }),
  );
  await page.keyboard.press("Escape");
  await prisma.workspaceMember.update({
    where: membership,
    data: { role: "OWNER" },
  });
  await page.reload();
  await visible(page.getByText("Proprietário", { exact: true }));
  report(
    "permissões MEMBER/ADMIN na interface e autorização repetida no backend",
  );

  await page
    .getByRole("button", { name: "Criar quadro", exact: true })
    .first()
    .click();
  await dialogSubmit(
    "Criar quadro",
    "Nome do quadro",
    "Quadro removido em cascata",
  );
  await visible(
    page.getByRole("heading", { name: "Quadro removido em cascata" }),
  );
  const removedBoard = await prisma.board.findFirstOrThrow({
    where: { workspaceId },
  });
  await manageWorkspace("Excluir workspace");
  await visible(page.getByText(/também excluirá todos os seus quadros/));
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await visible(
    page.getByRole("heading", { name: "Quadro removido em cascata" }),
  );
  await manageWorkspace("Excluir workspace");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Excluir workspace", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "detached" });
  await page
    .getByRole("option", { name: "Segundo workspace" })
    .waitFor({ state: "attached" });
  assert.equal(await prisma.board.count({ where: { id: removedBoard.id } }), 0);
  assert.equal(
    await prisma.boardColumn.count({ where: { boardId: removedBoard.id } }),
    0,
  );
  await assertFits(320);
  await assertFits(375);
  await assertFits(768);
  await assertFits(1440);
  report(
    "exclusão de workspace com confirmação, cascata e seleção válida; sem overflow",
  );

  await page
    .getByRole("button", { name: "Criar quadro", exact: true })
    .first()
    .focus();
  await page.keyboard.press("Enter");
  const focusDialog = page.getByRole("dialog");
  await visible(focusDialog);
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Tab");
    assert.equal(
      await focusDialog.evaluate((element) =>
        element.contains(document.activeElement),
      ),
      true,
    );
  }
  await page.keyboard.press("Escape");
  await focusDialog.waitFor({ state: "detached" });
  report("abertura por teclado, foco contido e fechamento por Escape");

  const selection = await page.getByLabel("Workspace atual").inputValue();
  await page.route("**/api/workspaces", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ message: "Sua sessão expirou. Entre novamente." }),
    }),
  );
  await page.reload();
  await page.waitForURL(/\/login\//);
  await page.unroute("**/api/workspaces");
  report("401 durante consulta privada encaminha para login");
  assert.ok(selection);
  assert.deepEqual(errors, []);
  report("nenhum erro JavaScript no navegador");
} catch (error) {
  await mkdir("/tmp/taskflow-etapa04", { recursive: true });
  console.error("URL no momento da falha:", page.url());
  console.error(
    await page
      .locator("#conteudo")
      .innerText()
      .catch(() => "Conteúdo privado indisponível."),
  );
  await page
    .screenshot({ path: "/tmp/taskflow-etapa04/failure.png", fullPage: true })
    .catch(() => {});
  throw error;
} finally {
  // Limpa somente a conta e os workspaces que este roteiro criou.
  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId: user.id },
    });
    await prisma.workspace.deleteMany({
      where: { id: { in: memberships.map((item) => item.workspaceId) } },
    });
    await prisma.user.delete({ where: { id: user.id } });
  }
  await context.close();
  await browser.close();
  await prisma.$disconnect();
}
