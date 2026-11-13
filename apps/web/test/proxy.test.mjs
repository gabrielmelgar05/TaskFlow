import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { onRequest } from "../functions/api/[[path]].ts";
const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});
const env = {
  API_ORIGIN: "https://fixed-backend.example",
  API_PROXY_SECRET: "server-only-secret",
};

test("preserva método, corpo, query, Origin e cookie para a origem fixa", async () => {
  const request = new Request(
    "https://taskflow.pages.dev/api/auth/login?next=hello&target=https://evil.example",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: "taskflow_session=abc",
        Origin: "https://taskflow.pages.dev",
        "CF-Connecting-IP": "192.0.2.1",
        "X-Taskflow-Proxy-Secret": "spoofed",
        "X-Forwarded-For": "spoofed",
        Connection: "keep-alive",
        Authorization: "not-needed",
      },
      body: '{"email":"teste@example.invalid"}',
    },
  );
  globalThis.fetch = async (url, init) => {
    assert.equal(url.origin, env.API_ORIGIN);
    assert.equal(url.pathname, "/api/auth/login");
    assert.equal(url.search, "?next=hello&target=https://evil.example");
    assert.equal(init.method, "POST");
    assert.equal(
      new TextDecoder().decode(init.body),
      '{"email":"teste@example.invalid"}',
    );
    assert.equal(init.headers.get("cookie"), "taskflow_session=abc");
    assert.equal(init.headers.get("origin"), "https://taskflow.pages.dev");
    assert.equal(
      init.headers.get("x-taskflow-proxy-secret"),
      env.API_PROXY_SECRET,
    );
    assert.equal(init.headers.get("x-taskflow-client-ip"), "192.0.2.1");
    assert.equal(init.headers.has("connection"), false);
    assert.equal(init.headers.has("authorization"), false);
    assert.equal(init.headers.has("x-forwarded-for"), false);
    assert.equal(init.redirect, "manual");
    return Response.json({ ok: true });
  };
  assert.equal((await onRequest({ request, env })).status, 200);
});
test("mantém cada Set-Cookie, inclusive Expires, e remove cabeçalhos hop-by-hop", async () => {
  const cookies = [
    "taskflow_session=one; Expires=Wed, 11 Nov 2026 12:00:00 GMT; HttpOnly; Path=/; SameSite=Lax",
    "other=two; HttpOnly; Path=/",
  ];
  const headers = new Headers({
    Connection: "keep-alive, x-hop",
    "x-hop": "remove",
    "Keep-Alive": "timeout=5",
    "Retry-After": "60",
    "Content-Type": "application/json",
  });
  cookies.forEach((cookie) => headers.append("Set-Cookie", cookie));
  globalThis.fetch = async () => new Response("{}", { status: 429, headers });
  const response = await onRequest({
    request: new Request("https://taskflow.pages.dev/api/auth/login"),
    env,
  });
  assert.equal(response.status, 429);
  assert.deepEqual(response.headers.getSetCookie(), cookies);
  assert.equal(response.headers.get("retry-after"), "60");
  assert.equal(response.headers.has("x-hop"), false);
  assert.equal(response.headers.has("keep-alive"), false);
  assert.equal(response.headers.get("cache-control"), "no-store");
});
test("não interfere em páginas estáticas", async () => {
  globalThis.fetch = async () => {
    throw new Error("Não deveria acessar o backend");
  };
  assert.equal(
    (
      await onRequest({
        request: new Request("https://taskflow.pages.dev/login/"),
        env,
      })
    ).status,
    404,
  );
});
test("rejeita origem ausente, insegura, com credenciais, caminho ou destino circular", async () => {
  for (const origin of [
    undefined,
    "https://user:secret@backend.example",
    "https://backend.example/path",
    "http://remote.example",
    "https://taskflow.pages.dev",
    "https://backend.example?url=evil",
  ]) {
    globalThis.fetch = async () => {
      throw new Error("Destino inválido não deve receber requisição");
    };
    assert.equal(
      (
        await onRequest({
          request: new Request("https://taskflow.pages.dev/api/health"),
          env: { API_ORIGIN: origin },
        })
      ).status,
      503,
    );
  }
});
test("falha de rede retorna 502 sem expor endereço ou segredo", async () => {
  globalThis.fetch = async () => {
    throw new Error("secret backend connection failed");
  };
  const response = await onRequest({
    request: new Request("https://taskflow.pages.dev/api/health"),
    env,
  });
  assert.equal(response.status, 502);
  assert.ok(!(await response.text()).includes("secret"));
});
test("não segue redirecionamentos do backend", async () => {
  globalThis.fetch = async () =>
    Response.redirect("https://external.example", 302);
  assert.equal(
    (
      await onRequest({
        request: new Request("https://taskflow.pages.dev/api/auth/me"),
        env,
      })
    ).status,
    502,
  );
});
test("preserva GET sem corpo e logout sem conteúdo", async () => {
  globalThis.fetch = async (_, init) => {
    assert.equal(init.body, undefined);
    return new Response(null, {
      status: 204,
      headers: {
        "Set-Cookie":
          "taskflow_session=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/",
      },
    });
  };
  const response = await onRequest({
    request: new Request("https://taskflow.pages.dev/api/health?probe=true"),
    env,
  });
  assert.equal(response.status, 204);
  assert.equal(await response.text(), "");
  assert.equal(response.headers.getSetCookie().length, 1);
});
