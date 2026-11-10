import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/configure-app.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('GET /api/health', () => {
  let app: INestApplication;
  const query = vi.fn();

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ $queryRaw: query })
      .compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
  });

  beforeEach(() => {
    query.mockReset();
  });
  afterAll(async () => {
    await app?.close();
  });

  it('responde 200 apenas depois de consultar o banco e não armazena cache', async () => {
    query.mockResolvedValue([{ '?column?': 1 }]);
    const response = await request(app.getHttpServer())
      .get('/api/health')
      .expect(200);
    expect(response.body).toEqual({ status: 'ok', database: 'up' });
    expect(response.headers['cache-control']).toBe('no-store');
    expect(query).toHaveBeenCalledExactlyOnceWith(['SELECT 1']);
  });

  it('responde 503 sem expor detalhes internos quando a consulta falha', async () => {
    query.mockRejectedValue(
      new Error('postgresql://private:secret@internal:5432/database'),
    );
    const response = await request(app.getHttpServer())
      .get('/api/health')
      .expect(503);
    expect(response.body).toEqual({
      status: 'error',
      database: 'down',
      message:
        'O serviço está temporariamente indisponível. Tente novamente em instantes.',
    });
    expect(response.text).not.toMatch(/secret|internal|postgresql/);
  });

  it('permite CORS para a origem configurada', async () => {
    query.mockResolvedValue([]);
    const response = await request(app.getHttpServer())
      .get('/api/health')
      .set('Origin', 'http://localhost:3000')
      .expect(200);
    expect(response.headers['access-control-allow-origin']).toBe(
      'http://localhost:3000',
    );
  });

  it('não libera CORS para outras origens', async () => {
    query.mockResolvedValue([]);
    const response = await request(app.getHttpServer())
      .get('/api/health')
      .set('Origin', 'https://example.org')
      .expect(200);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('mantém o endpoint sob o prefixo /api', async () => {
    await request(app.getHttpServer()).get('/health').expect(404);
  });
});

describe.skipIf(process.env.RUN_DATABASE_TESTS !== 'true')(
  'PostgreSQL real — somente leitura',
  () => {
    let app: INestApplication;

    beforeAll(async () => {
      const module = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
      app = module.createNestApplication();
      configureApp(app);
      await app.init();
    });
    afterAll(async () => {
      await app?.close();
    });

    it('executa SELECT 1 via HTTP, NestJS, PrismaPg e PostgreSQL', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/health')
        .expect(200);
      expect(response.body).toEqual({ status: 'ok', database: 'up' });
    });
  },
);
