export function validateEnvironment(environment: Record<string, unknown>) {
  const databaseUrl = environment.DATABASE_URL;

  if (typeof databaseUrl !== 'string' || !databaseUrl.trim()) {
    throw new Error('Configure DATABASE_URL no ambiente do servidor.');
  }

  try {
    const url = new URL(databaseUrl);
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname) {
      throw new Error();
    }
  } catch {
    throw new Error('DATABASE_URL deve ser uma URL PostgreSQL válida.');
  }

  const port = Number(environment.PORT ?? 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT deve ser um número entre 1 e 65535.');
  }

  const corsOrigin = environment.CORS_ORIGIN ?? 'http://localhost:3000';
  if (typeof corsOrigin !== 'string' || !corsOrigin.trim()) {
    throw new Error('Configure CORS_ORIGIN com a origem do frontend.');
  }

  const origins = corsOrigin.split(',').map((origin) => origin.trim());
  for (const origin of origins) {
    try {
      const url = new URL(origin);
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.origin !== origin
      ) {
        throw new Error();
      }
    } catch {
      throw new Error(
        'CORS_ORIGIN deve conter origens HTTP separadas por vírgula.',
      );
    }
  }

  const nodeEnv = environment.NODE_ENV ?? 'development';
  if (
    typeof nodeEnv !== 'string' ||
    !['development', 'test', 'production'].includes(nodeEnv)
  ) {
    throw new Error('NODE_ENV deve ser development, test ou production.');
  }
  const cookieSecure =
    environment.COOKIE_SECURE ?? (nodeEnv === 'production' ? 'true' : 'false');
  if (
    typeof cookieSecure !== 'string' ||
    !['true', 'false'].includes(cookieSecure) ||
    (nodeEnv === 'production' && cookieSecure !== 'true')
  ) {
    throw new Error(
      'COOKIE_SECURE deve ser true ou false; em produção, deve ser true.',
    );
  }
  const sessionTtlDays = Number(environment.SESSION_TTL_DAYS ?? 7);
  if (
    !Number.isInteger(sessionTtlDays) ||
    sessionTtlDays < 1 ||
    sessionTtlDays > 30
  ) {
    throw new Error('SESSION_TTL_DAYS deve estar entre 1 e 30 dias.');
  }
  const proxySecret = environment.API_PROXY_SECRET;
  if (
    (proxySecret !== undefined &&
      (typeof proxySecret !== 'string' || proxySecret.length < 32)) ||
    (nodeEnv === 'production' && !proxySecret)
  ) {
    throw new Error(
      'API_PROXY_SECRET deve ter pelo menos 32 caracteres e é obrigatório em produção.',
    );
  }
  if (
    nodeEnv === 'production' &&
    origins.some((origin) => !origin.startsWith('https://'))
  ) {
    throw new Error('CORS_ORIGIN deve utilizar HTTPS em produção.');
  }

  return {
    ...environment,
    DATABASE_URL: databaseUrl,
    PORT: port,
    CORS_ORIGIN: origins,
    NODE_ENV: nodeEnv,
    COOKIE_SECURE: cookieSecure === 'true',
    SESSION_TTL_DAYS: sessionTtlDays,
    API_PROXY_SECRET: proxySecret,
  };
}
