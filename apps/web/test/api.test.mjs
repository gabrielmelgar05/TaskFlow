import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { ApiError, apiRequest, getHealth } from "../src/lib/api.ts";
const originalFetch = globalThis.fetch;
const originalBase = process.env.NEXT_PUBLIC_API_URL;
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalBase === undefined) delete process.env.NEXT_PUBLIC_API_URL;
  else process.env.NEXT_PUBLIC_API_URL = originalBase;
});
test("cliente envia cookies e JSON; usa base relativa sem variável pública", async () => {
  delete process.env.NEXT_PUBLIC_API_URL;
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "/api/auth/login");
    assert.equal(init.credentials, "include");
    assert.equal(init.cache, "no-store");
    assert.deepEqual(JSON.parse(init.body), { email: "a@example.invalid" });
    return Response.json({
      user: { id: "test", name: "Teste", email: "a@example.invalid" },
    });
  };
  const data = await apiRequest("/auth/login", {
    method: "POST",
    body: { email: "a@example.invalid" },
  });
  assert.equal(data.user.id, "test");
});
test("mantém 401 distinto de uma falha de conexão", async () => {
  globalThis.fetch = async () =>
    Response.json({ message: "Credenciais inválidas." }, { status: 401 });
  await assert.rejects(
    apiRequest("/auth/me"),
    (error) => error instanceof ApiError && error.status === 401,
  );
  globalThis.fetch = async () => {
    throw new Error("network");
  };
  await assert.rejects(
    apiRequest("/auth/me"),
    (error) => error instanceof ApiError && error.status === 0,
  );
});
test("preserva 429 e Retry-After para feedback de limite", async () => {
  globalThis.fetch = async () =>
    Response.json(
      { message: "Muitas tentativas." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  await assert.rejects(
    apiRequest("/auth/login"),
    (error) => error.status === 429 && error.retryAfter === 60,
  );
});
test("204 de logout não tenta interpretar JSON", async () => {
  globalThis.fetch = async () => new Response(null, { status: 204 });
  assert.equal(await apiRequest("/auth/logout", { method: "POST" }), undefined);
});
test("rejeita resposta de health inesperada", async () => {
  globalThis.fetch = async () =>
    Response.json({ status: "ok", database: "down" });
  await assert.rejects(getHealth(), ApiError);
});
test("PATCH envia nome com cookies e DELETE trata resposta vazia", async () => {
  delete process.env.NEXT_PUBLIC_API_URL;
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "/api/boards/isolated");
    assert.equal(init.credentials, "include");
    if (init.method === "PATCH") {
      assert.deepEqual(JSON.parse(init.body), { name: "Novo nome" });
      return Response.json({ id: "isolated", name: "Novo nome" });
    }
    assert.equal(init.method, "DELETE");
    assert.equal(init.body, undefined);
    return new Response(null, { status: 204 });
  };
  assert.equal(
    (
      await apiRequest("/boards/isolated", {
        method: "PATCH",
        body: { name: "Novo nome" },
      })
    ).name,
    "Novo nome",
  );
  assert.equal(
    await apiRequest("/boards/isolated", { method: "DELETE" }),
    undefined,
  );
});
