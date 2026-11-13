interface ProxyEnvironment {
  API_ORIGIN: string;
  API_PROXY_SECRET?: string;
}
interface ProxyContext {
  request: Request;
  env: ProxyEnvironment;
}
const hopByHop = [
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
];

function unavailable(status = 502) {
  return Response.json(
    {
      message:
        "Não foi possível conectar ao serviço. Tente novamente em instantes.",
    },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function onRequest({
  request,
  env,
}: ProxyContext): Promise<Response> {
  const incoming = new URL(request.url);
  if (!incoming.pathname.startsWith("/api/"))
    return new Response(null, { status: 404 });
  let target: URL;
  try {
    target = new URL(env.API_ORIGIN);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(target.hostname);
    if (
      (target.protocol !== "https:" &&
        !(target.protocol === "http:" && local)) ||
      target.username ||
      target.password ||
      target.pathname !== "/" ||
      target.search ||
      target.hash ||
      target.origin === incoming.origin
    )
      return unavailable(503);
  } catch {
    return unavailable(503);
  }
  // A origem vem exclusivamente do ambiente do servidor. Nunca de parâmetros.
  target.pathname = incoming.pathname;
  target.search = incoming.search;
  const headers = new Headers();
  for (const name of ["accept", "content-type", "cookie", "origin"]) {
    const value = request.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  const connectionHeaders = (request.headers.get("connection") ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase());
  for (const name of connectionHeaders) if (name) headers.delete(name);
  if (env.API_PROXY_SECRET) {
    headers.set("x-taskflow-proxy-secret", env.API_PROXY_SECRET);
    const clientIp = request.headers.get("cf-connecting-ip");
    if (clientIp) headers.set("x-taskflow-client-ip", clientIp);
  }
  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method)
        ? undefined
        : await request.arrayBuffer(),
      redirect: "manual",
      signal: AbortSignal.timeout(20000),
    });
    // Não seguimos redirecionamentos que poderiam enviar cookies/segredos a outro host.
    if (upstream.status >= 300 && upstream.status < 400) return unavailable();
    const responseHeaders = new Headers(upstream.headers);
    const additional = (responseHeaders.get("connection") ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase());
    for (const name of [
      ...hopByHop,
      ...additional,
      "content-length",
      "access-control-allow-origin",
      "access-control-allow-credentials",
    ])
      if (name) responseHeaders.delete(name);
    // Set-Cookie é repetível: não separar por vírgulas (Expires contém vírgula).
    const cookies = upstream.headers.getSetCookie();
    responseHeaders.delete("set-cookie");
    for (const cookie of cookies) responseHeaders.append("set-cookie", cookie);
    responseHeaders.set("cache-control", "no-store");
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch {
    return unavailable();
  }
}
