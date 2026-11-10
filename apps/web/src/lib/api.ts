export interface HealthResponse {
  status: "ok";
  database: "up";
}
export interface PublicUser {
  id: string;
  name: string;
  email: string;
}
export interface AuthResponse {
  user: PublicUser;
}
export interface LoginInput {
  email: string;
  password: string;
}
export interface RegisterInput extends LoginInput {
  name: string;
}
export type FieldErrors = Record<string, string>;

export class ApiError extends Error {
  readonly status: number;
  readonly fields: FieldErrors;
  readonly retryAfter?: number;
  constructor(
    message: string,
    status = 0,
    fields: FieldErrors = {},
    retryAfter?: number,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fields = fields;
    this.retryAfter = retryAfter;
  }
}

export async function apiRequest<T>(
  path: string,
  options: {
    method?: "GET" | "POST";
    body?: unknown;
    signal?: AbortSignal;
  } = {},
): Promise<T> {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "/api";
  let response: Response;
  try {
    const timeout = AbortSignal.timeout(15000);
    response = await fetch(`${base.replace(/\/$/, "")}${path}`, {
      method: options.method ?? "GET",
      credentials: "include",
      cache: "no-store",
      headers:
        options.body === undefined
          ? undefined
          : { "Content-Type": "application/json" },
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal
        ? AbortSignal.any([options.signal, timeout])
        : timeout,
    });
  } catch {
    throw new ApiError(
      "Não foi possível conectar ao serviço. Verifique sua conexão e tente novamente.",
    );
  }
  if (response.status === 204) return undefined as T;
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const fields: FieldErrors = {};
    let message =
      response.status === 429
        ? "Muitas tentativas. Aguarde alguns minutos e tente novamente."
        : "Não foi possível concluir a solicitação. Tente novamente.";
    if (typeof data === "object" && data !== null) {
      if ("message" in data && typeof data.message === "string")
        message = data.message;
      if (
        "errors" in data &&
        typeof data.errors === "object" &&
        data.errors !== null
      ) {
        for (const [key, value] of Object.entries(data.errors)) {
          if (
            ["name", "email", "password"].includes(key) &&
            typeof value === "string"
          )
            fields[key] = value;
        }
      }
    }
    throw new ApiError(
      message,
      response.status,
      fields,
      Number(response.headers.get("Retry-After")) || undefined,
    );
  }
  return data as T;
}
export async function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const data = await apiRequest<unknown>("/health", { signal });
  if (
    typeof data !== "object" ||
    data === null ||
    !("status" in data) ||
    !("database" in data) ||
    data.status !== "ok" ||
    data.database !== "up"
  )
    throw new ApiError("Resposta inesperada do serviço.");
  return { status: data.status, database: data.database };
}
