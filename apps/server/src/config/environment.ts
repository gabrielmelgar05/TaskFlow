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

  return {
    ...environment,
    DATABASE_URL: databaseUrl,
    PORT: port,
    CORS_ORIGIN: origins,
  };
}
