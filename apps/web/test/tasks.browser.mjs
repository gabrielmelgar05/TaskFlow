import { selectOption } from "./browser-select.mjs";
// Roteiro integrado opcional: exportação estática + proxy + API + PostgreSQL.
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
  !/^taskflow_etapa0[567]_test/.test(
    new URL(connectionString).pathname.slice(1),
  )
)
  throw new Error(
    "Use somente um banco isolado taskflow_etapa05_test* ou taskflow_etapa06_test* ou taskflow_etapa07_test*.",
  );
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
  viewport: { width: 1440, height: 1000 },
  timezoneId: "America/Porto_Velho",
  reducedMotion: "reduce",
  hasTouch: true,
});
const page = await context.newPage();
page.setDefaultTimeout(15000);
const prefix = `browser05-${randomUUID()}`;
const email = `${prefix}@example.invalid`;
const password = "Uma frase longa de tarefas no navegador 2026!";
const users = [];
const workspaces = [];
const errors = [];
let moveRequests = 0;
page.on("pageerror", (error) => errors.push(error.message));
page.on("request", (request) => {
  if (
    request.method() === "PATCH" &&
    /\/tasks\/[^/]+\/move$/.test(new URL(request.url()).pathname)
  )
    moveRequests++;
});
const visible = (locator) => locator.waitFor({ state: "visible" });
const report = (message) => console.log(`PASS ${message}`);
const card = (title, target = page) =>
  target.locator("[data-task-id]").filter({
    has: target.getByRole("button", {
      name: `Abrir tarefa ${title}`,
      exact: true,
    }),
  });
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
async function taskMenu(title, action, target = page, touch = false) {
  const trigger = target.getByLabel(`Ações da tarefa ${title}`, {
    exact: true,
  });
  if (touch) await trigger.tap();
  else await trigger.click();
  const button = target.getByRole("button", { name: action, exact: true });
  if (touch) await button.tap();
  else await button.click();
}
async function createTask(title, target = page) {
  await target
    .getByRole("button", { name: "Criar tarefa em A fazer", exact: true })
    .click();
  const dialog = target.getByRole("dialog", {
    name: "Criar tarefa",
    exact: true,
  });
  await dialog.getByLabel("Título", { exact: true }).fill(title);
  await dialog
    .getByRole("button", { name: "Criar tarefa", exact: true })
    .click();
  await dialog.waitFor({ state: "detached" });
  await visible(card(title, target));
}
async function expectOrder(boardId, columnId, titles) {
  await page.waitForFunction(
    ({ columnId, titles }) => {
      const section = document.querySelector(`[data-column-id="${columnId}"]`);
      return (
        JSON.stringify(
          [...section.querySelectorAll(".task-title")].map(
            (element) => element.textContent,
          ),
        ) === JSON.stringify(titles)
      );
    },
    { columnId, titles },
  );
  await page
    .getByText("Salvando movimentação…", { exact: true })
    .waitFor({ state: "hidden" });
  const tasks = await api("GET", `/boards/${boardId}/tasks`);
  assert.deepEqual(
    tasks
      .filter((task) => task.columnId === columnId)
      .sort((a, b) => a.position - b.position)
      .map((task) => task.title),
    titles,
  );
}
async function dragTo(title, destination, cancel = false) {
  const handle = page.getByRole("button", {
    name: `Arrastar tarefa ${title}`,
    exact: true,
  });
  await handle.scrollIntoViewIfNeeded();
  const from = await handle.boundingBox();
  const to = await destination.boundingBox();
  assert.ok(from && to);
  const before = moveRequests;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    from.x + from.width / 2 + 10,
    from.y + from.height / 2,
    { steps: 3 },
  );
  await page.mouse.move(
    to.x + to.width / 2,
    to.y + Math.min(to.height / 2, 180),
    { steps: 18 },
  );
  assert.equal(
    moveRequests,
    before,
    "não deve salvar enquanto o cursor está se movendo",
  );
  if (cancel) await page.keyboard.press("Escape");
  await page.mouse.up();
  return before;
}
async function fits(width) {
  await page.setViewportSize({ width, height: 950 });
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  await page.waitForFunction(
    () => document.documentElement.scrollWidth <= innerWidth,
    undefined,
    { timeout: 5000 },
  );
}
let boardId;
try {
  await page.goto("/cadastro/");
  await page
    .getByLabel("Nome completo", { exact: true })
    .fill("Pessoa das Tarefas");
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByLabel("Confirmar senha", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Criar minha conta", exact: true })
    .click();
  await page.waitForURL(baseURL + "/");
  const owner = (await api("GET", "/auth/me")).user;
  users.push(owner.id);
  const workspace = await api("POST", "/workspaces", {
    name: "Workspace de tarefas",
  });
  workspaces.push(workspace.id);
  const board = await api("POST", `/workspaces/${workspace.id}/boards`, {
    name: "Kanban funcional",
  });
  boardId = board.id;
  const details = await api("GET", `/boards/${boardId}`);
  const [todo, doing, done] = details.columns;
  let firstLoad = true;
  await page.route(`**/api/boards/${boardId}/tasks`, async (route) => {
    if (route.request().method() === "GET" && firstLoad) {
      firstLoad = false;
      await new Promise((resolve) => setTimeout(resolve, 700));
    }
    await route.continue();
  });
  await page.goto(`/quadros/detalhes/?id=${boardId}`);
  await visible(page.getByText("Carregando tarefas…", { exact: true }));
  await visible(
    page.getByRole("button", { name: "Criar tarefa em A fazer", exact: true }),
  );
  await page.unroute(`**/api/boards/${boardId}/tasks`);
  assert.equal(
    await page.getByText("Nenhuma tarefa", { exact: true }).count(),
    3,
  );
  report("cadastro, sessão, quadro real e carregamento das tarefas");

  await page
    .getByRole("button", { name: "Criar tarefa em A fazer", exact: true })
    .click();
  let dialog = page.getByRole("dialog", { name: "Criar tarefa", exact: true });
  await dialog
    .getByRole("button", { name: "Criar tarefa", exact: true })
    .click();
  await visible(dialog.getByRole("alert"));
  assert.equal(
    await dialog
      .getByLabel("Título", { exact: true })
      .evaluate((element) => element === document.activeElement),
    true,
  );
  await dialog.getByLabel("Título", { exact: true }).fill("Preparar API");
  await dialog
    .getByLabel("Descrição", { exact: false })
    .fill("Descrição completa\npara estudar a integração.");
  await selectOption(
    dialog.getByLabel("Prioridade", { exact: true }),
    "URGENT",
  );
  await dialog.getByLabel("Prazo", { exact: false }).fill("2026-11-20");
  await visible(
    dialog.getByText("Só você participa deste workspace.", { exact: false }),
  );
  await selectOption(
    dialog.getByLabel("Responsável", { exact: false }),
    owner.id,
  );
  await dialog
    .getByRole("button", { name: "Criar tarefa", exact: true })
    .click();
  await dialog.waitFor({ state: "detached" });
  await visible(card("Preparar API"));
  await visible(card("Preparar API").getByText("Urgente", { exact: true }));
  await visible(card("Preparar API").getByText("20/11/2026", { exact: true }));
  assert.equal(
    await card("Preparar API")
      .getByText("Descrição completa", { exact: false })
      .count(),
    0,
  );
  const persisted = (await api("GET", `/boards/${boardId}/tasks`))[0];
  assert.equal(persisted.dueAt, "2026-11-20T00:00:00.000Z");
  report(
    "criação completa, validação, prioridade, responsável e data no fuso local",
  );

  await createTask("Revisar interface");
  await createTask("Escrever testes");
  await expectOrder(boardId, todo.id, [
    "Preparar API",
    "Revisar interface",
    "Escrever testes",
  ]);
  const beforeSecondaryClick = await api("GET", `/boards/${boardId}/tasks`);
  const beforeSecondaryRequests = moveRequests;
  await page.evaluate(() => {
    window.taskContextMenus = [];
    document.addEventListener("contextmenu", (event) => {
      queueMicrotask(() =>
        window.taskContextMenus.push(event.defaultPrevented),
      );
    });
  });
  for (const target of [
    card("Preparar API").locator(".task-title"),
    page.getByRole("button", {
      name: "Arrastar tarefa Preparar API",
      exact: true,
    }),
  ]) {
    const rect = await target.boundingBox();
    const destination = await page
      .locator(`[data-column-id="${doing.id}"]`)
      .boundingBox();
    await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
    await page.mouse.down({ button: "right" });
    await page.mouse.move(
      rect.x + rect.width / 2 + 20,
      rect.y + rect.height / 2,
      { steps: 4 },
    );
    assert.equal(
      await page
        .locator(".task-drag-preview, .column-drag-preview, .transfer-targets")
        .count(),
      0,
    );
    await page.mouse.move(
      destination.x + destination.width / 2,
      destination.y + 120,
      { steps: 12 },
    );
    await page.mouse.up({ button: "right" });
    await page.keyboard.press("Escape");
  }
  const contextMenus = await page.evaluate(() => window.taskContextMenus);
  assert.ok(
    contextMenus.length >= 2,
    "cliques secundários emitiram o menu de contexto",
  );
  assert.ok(
    contextMenus.every((prevented) => prevented === false),
    "menu nativo não é bloqueado",
  );
  assert.equal(moveRequests, beforeSecondaryRequests);
  assert.deepEqual(
    await api("GET", `/boards/${boardId}/tasks`),
    beforeSecondaryClick,
  );
  assert.equal(await page.getByRole("dialog").count(), 0);
  await page
    .getByLabel("Ações da tarefa Preparar API", { exact: true })
    .click();
  assert.equal(
    await page
      .getByRole("button", { name: "Mover para outro quadro", exact: true })
      .count(),
    0,
  );
  for (const action of ["Editar tarefa", "Mover tarefa", "Excluir tarefa"])
    await visible(page.getByRole("button", { name: action, exact: true }));
  await page.keyboard.press("Escape");
  report(
    "botão secundário no cartão e na alça mantém o menu nativo, sem arraste, prévia, painel ou gravação; ações preservadas",
  );
  await page
    .getByRole("button", { name: "Abrir tarefa Preparar API", exact: true })
    .click();
  dialog = page.getByRole("dialog", { name: "Editar tarefa", exact: true });
  assert.equal(
    await dialog.getByLabel("Descrição", { exact: false }).inputValue(),
    "Descrição completa\npara estudar a integração.",
  );
  await dialog.getByLabel("Título", { exact: true }).fill("API revisada");
  await selectOption(dialog.getByLabel("Prioridade", { exact: true }), "HIGH");
  await dialog.getByLabel("Prazo", { exact: false }).fill("");
  await selectOption(dialog.getByLabel("Responsável", { exact: false }), "");
  await dialog
    .getByRole("button", { name: "Salvar alterações", exact: true })
    .click();
  await dialog.waitFor({ state: "detached" });
  const edited = (await api("GET", `/boards/${boardId}/tasks`)).find(
    (task) => task.id === persisted.id,
  );
  assert.equal(edited.dueAt, null);
  assert.equal(edited.assignee, null);
  assert.equal(edited.priority, "HIGH");
  await page
    .getByRole("button", { name: "Abrir tarefa API revisada", exact: true })
    .click();
  dialog = page.getByRole("dialog", { name: "Editar tarefa", exact: true });
  await dialog.getByLabel("Prazo", { exact: false }).fill("2026-01-01");
  await selectOption(
    dialog.getByLabel("Responsável", { exact: false }),
    owner.id,
  );
  await dialog
    .getByRole("button", { name: "Salvar alterações", exact: true })
    .click();
  await dialog.waitFor({ state: "detached" });
  await visible(card("API revisada").getByText("Em atraso", { exact: true }));
  report(
    "edição, remoção/redefinição de prazo e responsável, indicação de atraso",
  );

  await page.route(`**/api/boards/${boardId}/tasks`, (route) =>
    route.request().method() === "POST"
      ? route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            message: "Serviço temporariamente indisponível.",
          }),
        })
      : route.continue(),
  );
  await page
    .getByRole("button", { name: "Criar tarefa em A fazer", exact: true })
    .click();
  dialog = page.getByRole("dialog", { name: "Criar tarefa", exact: true });
  await dialog.getByLabel("Título", { exact: true }).fill("Tarefa temporária");
  await dialog
    .getByRole("button", { name: "Criar tarefa", exact: true })
    .click();
  await visible(dialog.getByRole("alert"));
  assert.equal(
    await dialog.getByLabel("Título", { exact: true }).inputValue(),
    "Tarefa temporária",
  );
  await page.unroute(`**/api/boards/${boardId}/tasks`);
  await dialog
    .getByRole("button", { name: "Criar tarefa", exact: true })
    .click();
  await dialog.waitFor({ state: "detached" });
  await visible(card("Tarefa temporária"));
  await taskMenu("Tarefa temporária", "Excluir tarefa");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancelar", exact: true })
    .click();
  await visible(card("Tarefa temporária"));
  await taskMenu("Tarefa temporária", "Excluir tarefa");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Excluir tarefa", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "detached" });
  assert.equal((await api("GET", `/boards/${boardId}/tasks`)).length, 3);
  report(
    "falha preserva formulário; nova tentativa, confirmação e exclusão reais",
  );

  let before = await dragTo("Escrever testes", card("API revisada"));
  await visible(page.getByText("Tarefa movida com sucesso.", { exact: true }));
  assert.equal(moveRequests, before + 1);
  await expectOrder(boardId, todo.id, [
    "Escrever testes",
    "API revisada",
    "Revisar interface",
  ]);
  report("arrasto na mesma coluna persiste uma única requisição ao soltar");

  before = await dragTo(
    "Escrever testes",
    page.locator(`[data-column-id="${doing.id}"]`),
  );
  await expectOrder(boardId, doing.id, ["Escrever testes"]);
  assert.equal(moveRequests, before + 1);
  await dragTo(
    "Escrever testes",
    page.locator(`[data-column-id="${done.id}"]`),
  );
  await expectOrder(boardId, done.id, ["Escrever testes"]);
  report("arrasto entre colunas e destino vazio persistidos");

  before = await dragTo(
    "API revisada",
    page.locator(`[data-column-id="${doing.id}"]`),
    true,
  );
  await visible(page.getByText("Movimentação cancelada.", { exact: true }));
  assert.equal(moveRequests, before);
  await expectOrder(boardId, todo.id, ["API revisada", "Revisar interface"]);
  report("Escape cancela arrasto sem enviar movimentação");

  const snapshot = await api("GET", `/boards/${boardId}/tasks`);
  await page.route("**/api/tasks/*/move", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 350));
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        message: "Movimentação temporariamente indisponível.",
      }),
    });
  });
  await dragTo(
    "Revisar interface",
    page.locator(`[data-column-id="${doing.id}"]`),
  );
  await visible(
    page
      .getByRole("alert")
      .filter({ hasText: "Movimentação temporariamente indisponível." }),
  );
  await expectOrder(boardId, todo.id, ["API revisada", "Revisar interface"]);
  assert.deepEqual(await api("GET", `/boards/${boardId}/tasks`), snapshot);
  await page.unroute("**/api/tasks/*/move");
  await taskMenu("Revisar interface", "Mover tarefa");
  dialog = page.getByRole("dialog", { name: "Mover tarefa", exact: true });
  await selectOption(
    dialog.getByLabel("Coluna de destino", { exact: true }),
    doing.id,
  );
  await dialog
    .getByRole("button", { name: "Mover tarefa", exact: true })
    .click();
  await dialog.waitFor({ state: "detached" });
  await expectOrder(boardId, doing.id, ["Revisar interface"]);
  report(
    "falha de movimentação faz rollback visual; ação alternativa permite tentar novamente",
  );

  await fits(375);
  const region = page.getByRole("region", { name: "Colunas do quadro" });
  assert.equal(
    await region.evaluate(
      (element) => element.scrollWidth > element.clientWidth,
    ),
    true,
  );
  await taskMenu("API revisada", "Mover tarefa", page, true);
  dialog = page.getByRole("dialog", { name: "Mover tarefa", exact: true });
  await selectOption(
    dialog.getByLabel("Coluna de destino", { exact: true }),
    doing.id,
  );
  await selectOption(
    dialog.getByLabel("Posição na coluna", { exact: true }),
    "1",
  );
  await dialog.getByRole("button", { name: "Mover tarefa", exact: true }).tap();
  await dialog.waitFor({ state: "detached" });
  await expectOrder(boardId, doing.id, ["Revisar interface", "API revisada"]);
  await fits(320);
  await fits(768);
  await fits(1440);
  report(
    "mobile sem overflow da página, rolagem interna e movimentação alternativa por touch",
  );

  const handle = page.getByRole("button", {
    name: "Arrastar tarefa API revisada",
    exact: true,
  });
  await handle.focus();
  await page.keyboard.press("Space");
  await visible(page.locator(".task-drag-preview"));
  await page.evaluate(() => new Promise(requestAnimationFrame));
  await page.keyboard.press("ArrowUp");
  await page.evaluate(() => new Promise(requestAnimationFrame));
  await page.keyboard.press("Space");
  await page.locator(".task-drag-preview").waitFor({ state: "detached" });
  await expectOrder(boardId, doing.id, ["API revisada", "Revisar interface"]);
  report("arrasto por teclado e reordenação persistidos");

  await page.reload();
  await visible(card("API revisada"));
  await expectOrder(boardId, doing.id, ["API revisada", "Revisar interface"]);
  await expectOrder(boardId, done.id, ["Escrever testes"]);
  for (const column of details.columns) {
    const count = (await api("GET", `/boards/${boardId}/tasks`)).filter(
      (task) => task.columnId === column.id,
    ).length;
    assert.equal(
      await page
        .locator(`[data-column-id="${column.id}"] .task-count`)
        .textContent(),
      String(count),
    );
  }
  await mkdir("/tmp/taskflow-etapa05", { recursive: true });
  await page.screenshot({
    path: "/tmp/taskflow-etapa05/kanban-desktop.png",
    fullPage: true,
  });
  await fits(375);
  await page
    .getByRole("region", { name: "Colunas do quadro" })
    .evaluate((element) => {
      element.scrollLeft = 310;
    });
  await page.screenshot({
    path: "/tmp/taskflow-etapa05/kanban-mobile.png",
    fullPage: true,
  });
  await fits(1440);
  report("recarga preserva cartões, dados, ordem e contagens reais");

  const ownerRow = await prisma.user.findUniqueOrThrow({ where: { email } });
  const member = await prisma.user.create({
    data: {
      name: "Membro de teste",
      email: `${prefix}-member@example.invalid`,
      passwordHash: ownerRow.passwordHash,
      memberships: { create: { workspaceId: workspace.id, role: "MEMBER" } },
    },
  });
  users.push(member.id);
  const memberContext = await browser.newContext({
    baseURL,
    viewport: { width: 1440, height: 1000 },
    timezoneId: "America/Porto_Velho",
    reducedMotion: "reduce",
  });
  try {
    const response = await memberContext.request.post("/api/auth/login", {
      headers: { Origin: baseURL },
      data: { email: member.email, password },
    });
    assert.equal(response.status(), 200);
    const memberPage = await memberContext.newPage();
    memberPage.setDefaultTimeout(15000);
    memberPage.on("pageerror", (error) => errors.push(error.message));
    await memberPage.goto(`/quadros/detalhes/?id=${boardId}`);
    await visible(card("API revisada", memberPage));
    await memberPage
      .getByLabel("Ações da tarefa API revisada", { exact: true })
      .click();
    assert.equal(
      await memberPage
        .getByRole("button", { name: "Excluir tarefa", exact: true })
        .count(),
      0,
    );
    await memberPage
      .getByRole("button", { name: "Editar tarefa", exact: true })
      .click();
    await visible(
      memberPage.getByRole("dialog", { name: "Editar tarefa", exact: true }),
    );
    await memberPage
      .getByRole("dialog")
      .getByLabel("Responsável", { exact: false })
      .click();
    await memberPage
      .getByRole("option", { name: "Membro de teste", exact: true })
      .waitFor({ state: "attached" });
    assert.equal(
      await memberPage.getByRole("dialog").getByRole("option").count(),
      3,
    );
    await memberPage.keyboard.press("Escape");
    await memberPage.keyboard.press("Escape");
    await createTask("Criada pelo membro", memberPage);
    await taskMenu("Criada pelo membro", "Excluir tarefa", memberPage);
    await memberPage
      .getByRole("dialog")
      .getByRole("button", { name: "Excluir tarefa", exact: true })
      .click();
    await memberPage.getByRole("dialog").waitFor({ state: "detached" });
    const forbidden = await memberContext.request.delete(
      `/api/tasks/${persisted.id}`,
      { headers: { Origin: baseURL } },
    );
    assert.equal(forbidden.status(), 403);
  } finally {
    await memberContext.close();
  }
  report(
    "MEMBER cria e edita tarefas, mas exclui apenas as próprias; lista real de responsáveis",
  );

  await page.route(`**/api/boards/${boardId}/tasks`, (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        message: "Tarefas temporariamente indisponíveis.",
      }),
    }),
  );
  await page.reload();
  await visible(
    page
      .getByRole("alert")
      .filter({ hasText: "Tarefas temporariamente indisponíveis." }),
  );
  assert.equal(new URL(page.url()).pathname, "/quadros/detalhes/");
  await page.unroute(`**/api/boards/${boardId}/tasks`);
  await page
    .getByRole("button", { name: "Tentar novamente", exact: true })
    .click();
  await visible(card("API revisada"));
  report(
    "falha na consulta de tarefas permite recuperação sem confundir com sessão inválida",
  );

  await page.getByLabel("Conta de Pessoa das Tarefas", { exact: true }).click();
  await page
    .getByRole("button", { name: "Sair da conta", exact: true })
    .click();
  await page.waitForURL(baseURL + "/login/");
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL(baseURL + "/");
  const summary = page.getByLabel("Resumo de tarefas do workspace");
  await visible(summary.locator("dd").first());
  assert.deepEqual(await summary.locator("dd").allTextContents(), [
    "3",
    "2",
    "1",
    "1",
  ]);
  report("login/logout preservados e resumo usa contagens reais do PostgreSQL");
  assert.deepEqual(errors, []);
  report("nenhum erro JavaScript no console durante o roteiro final");
} catch (error) {
  await mkdir("/tmp/taskflow-etapa05", { recursive: true });
  await page
    .screenshot({ path: "/tmp/taskflow-etapa05/failure.png", fullPage: true })
    .catch(() => {});
  console.error("URL no momento da falha:", page.url());
  throw error;
} finally {
  const own = await prisma.user.findUnique({ where: { email } });
  if (own && !users.includes(own.id)) users.push(own.id);
  await prisma.workspace.deleteMany({ where: { id: { in: workspaces } } });
  await prisma.user.deleteMany({ where: { id: { in: users } } });
  await context.close();
  await browser.close();
  await prisma.$disconnect();
}
