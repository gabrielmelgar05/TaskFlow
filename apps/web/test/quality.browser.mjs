import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { PrismaClient } from "../../server/dist/generated/prisma/client.js";
const requireServer = createRequire(
  new URL("../../server/package.json", import.meta.url),
);
const requireWeb = createRequire(new URL("../package.json", import.meta.url));
const { PrismaPg } = requireServer("@prisma/adapter-pg");
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ?? "playwright"
);
const connectionString = process.env.DATABASE_URL ?? "";
if (!/^taskflow_etapa07_test/.test(new URL(connectionString).pathname.slice(1)))
  throw new Error("Use somente um banco isolado taskflow_etapa07_test*.");
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
page.setDefaultTimeout(10000);
const email = `quality07-${randomUUID()}@example.invalid`;
const password = "Uma frase longa de qualidade e testes 2026!";
const dir = "/tmp/taskflow-etapa07";
const userIds = [],
  workspaceIds = [],
  errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const visible = (locator) => locator.waitFor({ state: "visible" });
const report = (message) => console.log(`PASS ${message}`);
async function api(method, path, data) {
  const response = await context.request.fetch("/api" + path, {
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
async function capture(name, widths = [320, 375, 768, 1024, 1440, 1920]) {
  for (const width of widths) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `overflow: ${name}/${width}`,
    );
    await page.screenshot({
      path: `${dir}/${name}-${width}.png`,
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
}
async function audit(name) {
  await page.addScriptTag({ path: requireWeb.resolve("axe-core/axe.min.js") });
  const violations = await page.evaluate(async () =>
    (
      await window.axe.run(document, {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
      })
    ).violations.map(({ id, nodes }) => ({
      id,
      elements: nodes.map((node) => node.target),
    })),
  );
  assert.deepEqual(violations, [], `acessibilidade: ${name}`);
}
async function go(boardId) {
  await page.goto(`/quadros/detalhes/?id=${boardId}`);
  await visible(
    page.getByRole("button", { name: "Criar tarefa em A fazer", exact: true }),
  );
}
try {
  await mkdir(dir, { recursive: true });
  await page.goto("/quadros/");
  await page.waitForURL(baseURL + "/login/");
  await capture("login");
  await audit("login");
  await page.goto("/cadastro/");
  await capture("cadastro");
  await audit("cadastro");
  await page
    .getByLabel("Nome completo", { exact: true })
    .fill("Pessoa da Qualidade");
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByLabel("Confirmar senha", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Criar minha conta", exact: true })
    .click();
  await page.waitForURL(baseURL + "/");
  const user = (await api("GET", "/auth/me")).user;
  userIds.push(user.id);
  await page
    .getByRole("button", { name: "Criar workspace", exact: true })
    .click();
  await page
    .getByLabel("Nome do workspace", { exact: true })
    .fill("Workspace da Qualidade");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Criar workspace", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "detached" });
  const workspace = (await api("GET", "/workspaces"))[0];
  workspaceIds.push(workspace.id);
  await page.goto("/quadros/");
  await page
    .getByRole("button", { name: "Criar quadro", exact: true })
    .first()
    .click();
  await page
    .getByLabel("Nome do quadro", { exact: true })
    .fill("Quadro de origem");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Criar quadro", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "detached" });
  const source = (await api("GET", `/workspaces/${workspace.id}/boards`))[0];
  const sourceDetail = await api("GET", `/boards/${source.id}`);
  await api("POST", `/boards/${source.id}/tasks`, {
    title: "Verificar detalhes da tarefa",
    description: "Descrição completa para preservar.",
    columnId: sourceDetail.columns[0].id,
    priority: "HIGH",
    dueAt: "2026-01-01",
    assigneeId: user.id,
  });
  await page.reload();
  await visible(
    page.getByRole("link", { name: "Quadro de origem", exact: true }),
  );
  await capture("quadros");
  await audit("quadros");
  await go(source.id);
  await capture("kanban");
  await audit("kanban");
  await page
    .getByRole("button", {
      name: "Abrir tarefa Verificar detalhes da tarefa",
      exact: true,
    })
    .click();
  await capture("modal-editar");
  await audit("modal-editar");
  const priority = page
    .locator("dialog")
    .getByLabel("Prioridade", { exact: true });
  await priority.focus();
  await page.keyboard.press("Space");
  await visible(page.getByRole("listbox"));
  await page.keyboard.press("Home");
  await page.waitForFunction(() =>
    document.activeElement?.textContent.includes("Baixa"),
  );
  await page.keyboard.press("Enter");
  assert.match(await priority.textContent(), /Baixa/);
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    await priority.click();
    await visible(page.getByRole("listbox"));
    await page.screenshot({
      path: `${dir}/select-prioridade-${width}.png`,
      fullPage: false,
    });
    await audit(`select aberto/${width}`);
    await page.keyboard.press("Escape");
    await page.getByRole("listbox").waitFor({ state: "detached" });
  }
  await priority.click();
  const outside = await page
    .locator("dialog")
    .getByLabel("Título", { exact: true })
    .boundingBox();
  await page.mouse.click(outside.x + 12, outside.y + 12);
  assert.equal(
    await page.getByRole("listbox").count(),
    0,
    "clique fora fecha select",
  );
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "detached" });
  report(
    "cadastro, rotas privadas, criação de workspace/quadro, selects com teclado e clique fora",
  );

  await page.goto("/");
  await visible(
    page.getByLabel("Resumo de tarefas do workspace").locator("dd").first(),
  );
  assert.deepEqual(
    await page
      .getByLabel("Resumo de tarefas do workspace")
      .locator("dd")
      .allTextContents(),
    ["1", "0", "0", "1"],
  );
  await capture("dashboard");
  await audit("dashboard");
  await page
    .getByLabel("Conta de Pessoa da Qualidade", { exact: true })
    .click();
  await capture("perfil");
  await audit("perfil");
  await page.keyboard.press("Escape");
  assert.equal(await page.locator(".profile-menu").getAttribute("open"), null);
  await page
    .getByLabel("Conta de Pessoa da Qualidade", { exact: true })
    .click();
  await page.route("**/api/auth/logout", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ message: "Saída temporariamente indisponível." }),
    }),
  );
  await page
    .getByRole("button", { name: "Sair da conta", exact: true })
    .click();
  await visible(page.locator(".profile-menu").getByRole("alert"));
  assert.equal(await page.locator(".profile-menu").getAttribute("open"), "");
  await page.unroute("**/api/auth/logout");
  await page
    .getByRole("button", { name: "Sair da conta", exact: true })
    .click();
  await page.waitForURL(baseURL + "/login/");
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL(baseURL + "/");
  await prisma.session.updateMany({
    where: { userId: user.id },
    data: { expiresAt: new Date(0) },
  });
  await page.reload();
  await page.waitForURL(baseURL + "/login/");
  assert.deepEqual(errors, []);
  report(
    "indicadores corretos, seis larguras sem overflow, axe WCAG AA, perfil, logout, login e expiração real",
  );
} catch (error) {
  await page
    .screenshot({ path: `${dir}/quality-failure.png`, fullPage: true })
    .catch(() => {});
  console.error("URL da falha:", page.url());
  throw error;
} finally {
  const user = await prisma.user.findUnique({ where: { email } });
  if (user && !userIds.includes(user.id)) userIds.push(user.id);
  const owned = await prisma.workspace.findMany({
    where: { members: { some: { userId: { in: userIds }, role: "OWNER" } } },
    select: { id: true },
  });
  workspaceIds.push(...owned.map((item) => item.id));
  await prisma.workspace.deleteMany({ where: { id: { in: workspaceIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await context.close();
  await browser.close();
  await prisma.$disconnect();
}
