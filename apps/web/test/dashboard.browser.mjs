// Dashboard integrado: dados reais em PostgreSQL isolado, sem dados demonstrativos na aplicação.
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
const connectionString = process.env.DATABASE_URL ?? "";
if (
  !new URL(connectionString).pathname
    .slice(1)
    .startsWith("taskflow_etapa06_test")
)
  throw new Error("Use somente um banco isolado taskflow_etapa06_test*.");
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH }
    : {}),
});
const baseURL = process.env.BROWSER_BASE_URL ?? "http://localhost:3100";
const context = await browser.newContext({
  baseURL,
  viewport: { width: 1440, height: 1050 },
  timezoneId: "America/Porto_Velho",
  reducedMotion: "reduce",
  hasTouch: true,
});
const page = await context.newPage();
page.setDefaultTimeout(15000);
const email = `browser06-${randomUUID()}@example.invalid`;
const password = "Uma frase longa para o dashboard 2026!";
const errors = [],
  calls = [],
  workspaces = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("request", (request) => {
  if (new URL(request.url()).pathname.startsWith("/api/"))
    calls.push(new URL(request.url()).pathname);
});
const visible = (locator) => locator.waitFor({ state: "visible" });
const report = (message) => console.log(`PASS ${message}`);
const metrics = () =>
  page.getByRole("region", { name: "Resumo de tarefas do workspace" });
async function expectMetrics(values) {
  await page.waitForFunction(
    (values) =>
      JSON.stringify(
        [...document.querySelectorAll(".dashboard-metric dd")].map(
          (element) => element.textContent,
        ),
      ) === JSON.stringify(values.map(String)),
    values,
  );
}
async function api(method, path, data) {
  const response = await context.request.fetch(`/api${path}`, {
    method,
    headers: { Origin: baseURL },
    data,
  });
  assert.ok(
    response.ok(),
    `${method} ${path}: ${response.status()} ${await response.text()}`,
  );
  return response.status() === 204 ? undefined : response.json();
}
async function overview() {
  calls.length = 0;
  await page
    .getByRole("navigation", { name: "Navegação principal" })
    .getByRole("link", { name: "Visão geral", exact: true })
    .click();
  await page.waitForURL(baseURL + "/");
  await visible(metrics());
}
async function openBoard(id) {
  await page.goto(`/quadros/detalhes/?id=${id}`);
  await visible(
    page.getByRole("button", { name: "Criar tarefa em A fazer", exact: true }),
  );
}
async function taskMenu(title, action) {
  await page.getByLabel(`Ações da tarefa ${title}`, { exact: true }).click();
  await page.getByRole("button", { name: action, exact: true }).click();
}
async function fits(width) {
  await page.setViewportSize({ width, height: 950 });
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
    `overflow em ${width}px`,
  );
}
try {
  await page.goto("/cadastro/");
  await page
    .getByLabel("Nome completo", { exact: true })
    .fill("Pessoa do Dashboard");
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByLabel("Confirmar senha", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Criar minha conta", exact: true })
    .click();
  await page.waitForURL(baseURL + "/");
  await visible(
    page.getByRole("heading", {
      name: "Organize seus projetos em um só lugar",
    }),
  );
  assert.equal(await metrics().count(), 0);
  await page
    .getByRole("button", { name: "Criar workspace", exact: true })
    .click();
  let dialog = page.getByRole("dialog", {
    name: "Criar workspace",
    exact: true,
  });
  await dialog
    .getByLabel("Nome do workspace", { exact: true })
    .fill("Workspace de produto");
  await dialog
    .getByRole("button", { name: "Criar workspace", exact: true })
    .click();
  await dialog.waitFor({ state: "detached" });
  await expectMetrics([0, 0, 0, 0]);
  await visible(
    page.getByRole("heading", { name: "Um workspace, muitas possibilidades" }),
  );
  const workspaceA = await page
    .getByLabel("Workspace atual", { exact: true })
    .inputValue();
  workspaces.push(workspaceA);
  report(
    "primeiro acesso, criação de workspace pelo dashboard e zeros reais sem quadros",
  );

  await page
    .getByRole("navigation", { name: "Navegação principal" })
    .getByRole("link", { name: "Quadros", exact: true })
    .click();
  await page.waitForURL(baseURL + "/quadros/");
  await page
    .getByRole("button", { name: "Criar quadro", exact: true })
    .first()
    .click();
  dialog = page.getByRole("dialog", { name: "Criar quadro", exact: true });
  await dialog
    .getByLabel("Nome do quadro", { exact: true })
    .fill("Produto web");
  await dialog
    .getByRole("button", { name: "Criar quadro", exact: true })
    .click();
  await dialog.waitFor({ state: "detached" });
  await visible(
    page.getByRole("heading", { name: "Produto web", exact: true }),
  );
  const board = (await api("GET", `/workspaces/${workspaceA}/boards`))[0];
  const details = await api("GET", `/boards/${board.id}`);
  await overview();
  await expectMetrics([0, 0, 0, 0]);
  await visible(
    page.getByRole("heading", { name: "Tudo começa com uma tarefa" }),
  );
  await visible(page.getByText("Sem tarefas", { exact: true }));
  assert.equal(await page.getByRole("progressbar").count(), 0);
  report(
    "workspace com quadro sem tarefas tem estado vazio e nenhum percentual inventado",
  );

  const today = await page.evaluate(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  });
  function dateOffset(days) {
    const value = new Date(`${today}T00:00:00Z`);
    value.setUTCDate(value.getUTCDate() + days);
    return value.toISOString().slice(0, 10);
  }
  async function newTask(title, status, extra = {}) {
    return api("POST", `/boards/${board.id}/tasks`, {
      title,
      columnId: details.columns.find((column) => column.status === status).id,
      ...extra,
    });
  }
  const late = await newTask("Corrigir acesso", "TODO", {
    dueAt: dateOffset(-1),
  });
  await newTask("Revisar entrega", "IN_PROGRESS", {
    dueAt: today,
    priority: "HIGH",
  });
  await newTask("Entrega anterior", "DONE", {
    dueAt: dateOffset(-2),
    priority: "URGENT",
  });
  await newTask("Planejar sprint", "TODO", { priority: "HIGH" });
  await api("POST", `/workspaces/${workspaceA}/boards`, {
    name: "Documentação",
  });
  await page.goto("/quadros/");
  await overview();
  await expectMetrics([4, 1, 1, 1]);
  assert.deepEqual(
    await page.locator(".attention-task-link").allTextContents(),
    ["Corrigir acesso↗", "Revisar entrega↗", "Planejar sprint↗"],
  );
  assert.equal(
    await page
      .getByRole("progressbar", { name: "Progresso de Produto web" })
      .getAttribute("value"),
    "25",
  );
  assert.equal(
    calls.filter((path) => path === "/api/dashboard/summary").length,
    1,
  );
  assert.equal(
    calls.filter(
      (path) =>
        path === "/api/tasks/summary" || /\/boards\/[^/]+\/tasks$/.test(path),
    ).length,
    0,
  );
  assert.equal(
    await page.locator(".sidebar-workspace [title]").getAttribute("title"),
    "Workspace de produto",
  );
  report(
    "indicadores, atenção e progresso usam dados reais em uma consulta por visita",
  );

  const attention = page.getByRole("link", {
    name: "Corrigir acesso",
    exact: false,
  });
  await attention.focus();
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/quadros\/detalhes\/\?id=.*&task=/);
  dialog = page.getByRole("dialog", { name: "Editar tarefa", exact: true });
  await visible(dialog);
  assert.equal(
    await dialog.getByLabel("Título", { exact: true }).inputValue(),
    late.title,
  );
  assert.equal(
    await dialog
      .getByLabel("Título", { exact: true })
      .evaluate((element) => element === document.activeElement),
    true,
  );
  await dialog.getByLabel("Título", { exact: true }).fill("Acesso revisado");
  await dialog.getByLabel("Prioridade", { exact: true }).selectOption("LOW");
  await dialog.getByLabel("Prazo", { exact: false }).fill(dateOffset(10));
  await dialog
    .getByRole("button", { name: "Salvar alterações", exact: true })
    .click();
  await dialog.waitFor({ state: "detached" });
  assert.equal(await page.getByRole("dialog").count(), 0);
  await overview();
  await expectMetrics([4, 1, 1, 0]);
  assert.equal(
    await page
      .locator(".attention-task-link")
      .filter({ hasText: "Acesso revisado" })
      .count(),
    0,
  );
  report(
    "link acessível abre o editor existente e edição atualiza o dashboard ao voltar",
  );

  await openBoard(board.id);
  await taskMenu("Revisar entrega", "Mover tarefa");
  dialog = page.getByRole("dialog", { name: "Mover tarefa", exact: true });
  await dialog
    .getByLabel("Coluna de destino", { exact: true })
    .selectOption(
      details.columns.find((column) => column.status === "DONE").id,
    );
  await dialog
    .getByRole("button", { name: "Mover tarefa", exact: true })
    .click();
  await dialog.waitFor({ state: "detached" });
  await overview();
  await expectMetrics([4, 0, 2, 0]);
  assert.equal(
    await page
      .getByRole("progressbar", { name: "Progresso de Produto web" })
      .getAttribute("value"),
    "50",
  );
  await openBoard(board.id);
  await taskMenu("Planejar sprint", "Excluir tarefa");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Excluir tarefa", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "detached" });
  await overview();
  await expectMetrics([3, 0, 2, 0]);
  await visible(page.getByRole("heading", { name: "Tudo em dia por aqui" }));
  report(
    "conclusão e exclusão no Kanban atualizam contagens, progresso e atenção sem reiniciar",
  );

  await openBoard(board.id);
  await page
    .getByRole("button", { name: "Criar tarefa em A fazer", exact: true })
    .click();
  dialog = page.getByRole("dialog", { name: "Criar tarefa", exact: true });
  await dialog.getByLabel("Título", { exact: true }).fill("Validar dashboard");
  await dialog.getByLabel("Prioridade", { exact: true }).selectOption("HIGH");
  await dialog
    .getByRole("button", { name: "Criar tarefa", exact: true })
    .click();
  await dialog.waitFor({ state: "detached" });
  await overview();
  await expectMetrics([4, 0, 2, 0]);
  await visible(
    page.getByRole("link", { name: "Validar dashboard", exact: false }),
  );
  report("criação pelo formulário do Kanban aparece no dashboard revisitado");

  const longName =
    "Workspace secundário com nome extenso para conferir o layout e o isolamento de dados";
  const workspaceB = await api("POST", "/workspaces", { name: longName });
  workspaces.push(workspaceB.id);
  const boardB = await api("POST", `/workspaces/${workspaceB.id}/boards`, {
    name: "Projeto secundário",
  });
  const detailsB = await api("GET", `/boards/${boardB.id}`);
  await api("POST", `/boards/${boardB.id}/tasks`, {
    title: "Tarefa do segundo workspace",
    columnId: detailsB.columns[0].id,
    dueAt: dateOffset(-1),
    priority: "URGENT",
  });
  await page.reload();
  await expectMetrics([4, 0, 2, 0]);
  await page
    .getByLabel("Workspace atual", { exact: true })
    .selectOption(workspaceB.id);
  await expectMetrics([1, 0, 0, 1]);
  assert.equal(
    await page.getByRole("link", { name: "Produto web", exact: false }).count(),
    0,
  );
  assert.equal(
    await page.locator(".sidebar-workspace [title]").getAttribute("title"),
    longName,
  );
  await page.reload();
  await expectMetrics([1, 0, 0, 1]);
  assert.equal(
    await page.getByLabel("Workspace atual", { exact: true }).inputValue(),
    workspaceB.id,
  );
  report(
    "seleção compartilhada, nome real e isolamento entre workspaces persistem após recarga",
  );

  await page.route("**/api/dashboard/summary?*", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ message: "Resumo temporariamente indisponível." }),
    });
  });
  await page.reload();
  await visible(page.getByText("Carregando a visão geral…", { exact: true }));
  assert.equal(await metrics().count(), 0);
  await visible(
    page
      .getByRole("alert")
      .filter({ hasText: "Resumo temporariamente indisponível." }),
  );
  assert.equal(await metrics().count(), 0);
  assert.equal(new URL(page.url()).pathname, "/");
  await page.unroute("**/api/dashboard/summary?*");
  await page
    .getByRole("button", { name: "Tentar novamente", exact: true })
    .click();
  await expectMetrics([1, 0, 0, 1]);
  report(
    "loading e erro não apresentam números falsos; nova tentativa preserva a sessão",
  );

  await mkdir("/tmp/taskflow-etapa06", { recursive: true });
  for (const width of [320, 375, 768, 1024, 1440]) await fits(width);
  await page.screenshot({
    path: "/tmp/taskflow-etapa06/dashboard-desktop.png",
    fullPage: true,
  });
  await fits(375);
  await page.screenshot({
    path: "/tmp/taskflow-etapa06/dashboard-mobile.png",
    fullPage: true,
  });
  await page
    .getByLabel("Conta de Pessoa do Dashboard", { exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await visible(
    page.getByRole("button", { name: "Sair da conta", exact: true }),
  );
  const bounds = await page.locator(".profile-popover").boundingBox();
  assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 375);
  await page.keyboard.press("Escape");
  assert.equal(
    await page
      .getByLabel("Conta de Pessoa do Dashboard", { exact: true })
      .evaluate((element) => element === document.activeElement),
    true,
  );
  report(
    "dashboard entre 320 e 1440 px e menu de perfil por teclado dentro da tela",
  );

  await page
    .getByRole("link", { name: "Tarefa do segundo workspace", exact: false })
    .click();
  dialog = page.getByRole("dialog", { name: "Editar tarefa", exact: true });
  await visible(dialog);
  await fits(320);
  const dialogBounds = await dialog.boundingBox();
  assert.ok(
    dialogBounds.x >= 0 &&
      dialogBounds.x + dialogBounds.width <= 320 &&
      dialogBounds.y >= 0 &&
      dialogBounds.y + dialogBounds.height <= 950,
  );
  for (let index = 0; index < 10; index++) {
    await page.keyboard.press("Tab");
    assert.equal(
      await dialog.evaluate((element) =>
        element.contains(document.activeElement),
      ),
      true,
    );
  }
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "detached" });
  await page
    .getByRole("button", {
      name: "Abrir tarefa Tarefa do segundo workspace",
      exact: true,
    })
    .click();
  await visible(
    page.getByRole("dialog", { name: "Editar tarefa", exact: true }),
  );
  await page.keyboard.press("Escape");
  report(
    "editor em 320 px, foco contido e fechamento de link direto sem reabrir sozinho",
  );

  const anonymous = await browser.newContext({
    baseURL,
    viewport: { width: 320, height: 950 },
  });
  try {
    const login = await anonymous.newPage();
    login.setDefaultTimeout(15000);
    await login.goto("/login/");
    await login.getByRole("button", { name: "Entrar", exact: true }).click();
    await visible(login.getByRole("alert").first());
    assert.equal(
      await login
        .getByLabel("E-mail", { exact: true })
        .evaluate((element) => element === document.activeElement),
      true,
    );
    assert.equal(
      await login.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await login.goto("/cadastro/");
    assert.equal(
      await login.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await login.goto("/");
    await login.waitForURL(baseURL + "/login/");
  } finally {
    await anonymous.close();
  }
  report(
    "login/cadastro em 320 px, erros anunciados, foco no campo inválido e rota privada protegida",
  );
  assert.deepEqual(errors, []);
  report("nenhum erro JavaScript no roteiro final do dashboard");
} catch (error) {
  await mkdir("/tmp/taskflow-etapa06", { recursive: true });
  await page
    .screenshot({ path: "/tmp/taskflow-etapa06/failure.png", fullPage: true })
    .catch(() => {});
  console.error("URL no momento da falha:", page.url());
  throw error;
} finally {
  const user = await prisma.user.findUnique({ where: { email } });
  await prisma.workspace.deleteMany({ where: { id: { in: workspaces } } });
  if (user) await prisma.user.delete({ where: { id: user.id } });
  await context.close();
  await browser.close();
  await prisma.$disconnect();
}
