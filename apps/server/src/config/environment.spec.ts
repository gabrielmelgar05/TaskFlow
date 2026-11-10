import { describe, expect, it } from 'vitest';
import { validateEnvironment } from './environment.js';

const databaseUrl = 'postgresql://example:example@localhost:5433/example';

describe('Configuração do ambiente', () => {
  it('define a porta e a origem locais por padrão', () => {
    expect(validateEnvironment({ DATABASE_URL: databaseUrl })).toMatchObject({
      PORT: 3001,
      CORS_ORIGIN: ['http://localhost:3000'],
    });
  });

  it('converte a porta e permite uma lista explícita de origens', () => {
    expect(
      validateEnvironment({
        DATABASE_URL: databaseUrl,
        PORT: '3002',
        CORS_ORIGIN: 'http://localhost:3000, http://127.0.0.1:3000',
      }),
    ).toMatchObject({
      PORT: 3002,
      CORS_ORIGIN: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    });
  });

  it.each([
    undefined,
    '',
    'mysql://example:example@localhost/example',
    'senha-secreta',
  ])('rejeita URL inválida sem expor o valor: %s', (url) => {
    expect(() => validateEnvironment({ DATABASE_URL: url })).toThrow(
      /DATABASE_URL/,
    );
    try {
      validateEnvironment({ DATABASE_URL: url });
    } catch (error) {
      expect(String(error)).not.toContain('senha-secreta');
    }
  });

  it.each(['', '0', '65536', '3001.5', 'abc'])(
    'rejeita porta inválida: %s',
    (port) => {
      expect(() =>
        validateEnvironment({ DATABASE_URL: databaseUrl, PORT: port }),
      ).toThrow(/PORT/);
    },
  );

  it.each([
    '*',
    '',
    'http://localhost:3000/',
    'http://localhost:3000/path',
    'ftp://localhost:3000',
  ])('rejeita uma origem inválida: %s', (origin) => {
    expect(() =>
      validateEnvironment({ DATABASE_URL: databaseUrl, CORS_ORIGIN: origin }),
    ).toThrow(/CORS_ORIGIN/);
  });
});
