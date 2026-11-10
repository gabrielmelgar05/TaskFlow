export interface HealthResponse {
  status: "ok";
  database: "up";
}

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) throw new Error("Endereço do serviço indisponível.");
  const timeout = AbortSignal.timeout(8000);
  const response = await fetch(`${apiUrl.replace(/\/$/, "")}${path}`, {
    cache: "no-store",
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  if (!response.ok) throw new Error("Não foi possível conectar ao serviço.");
  return response.json() as Promise<T>;
}

export async function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const data = await getJson<unknown>("/health", signal);
  if (
    typeof data !== "object" ||
    data === null ||
    !("status" in data) ||
    !("database" in data) ||
    data.status !== "ok" ||
    data.database !== "up"
  ) {
    throw new Error("Resposta inesperada do serviço.");
  }
  return { status: data.status, database: data.database };
}
