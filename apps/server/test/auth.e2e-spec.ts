import 'reflect-metadata';
import {
  Controller,
  Get,
  type INestApplication,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { randomBytes, randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { verify } from 'argon2';
import { AppModule } from '../src/app.module.js';
import { AuthService, hashSessionToken } from '../src/auth/auth.service.js';
import { PasswordService } from '../src/auth/password.service.js';
import { configureApp } from '../src/configure-app.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const origin = 'http://localhost:3000';
const proxySecret = 'isolated-test-proxy-secret-32-characters';
const password = 'Uma frase de teste bem longa 2026!';
let address = 1;
function call(
  app: INestApplication,
  method: 'get' | 'post',
  path: string,
  ip = `192.0.2.${(address++ % 250) + 1}`,
) {
  const client = request(app.getHttpServer());
  return (method === 'get' ? client.get(path) : client.post(path))
    .set('Origin', origin)
    .set('x-taskflow-proxy-secret', proxySecret)
    .set('x-taskflow-client-ip', ip);
}
function cookieOf(response: { headers: Record<string, unknown> }) {
  const cookies = response.headers['set-cookie'];
  if (!Array.isArray(cookies) || !cookies.length)
    throw new Error('Cookie de sessão ausente');
  return String(cookies[0]).split(';')[0];
}
function configureTestApp(app: INestApplication) {
  app.get(ConfigService).set('API_PROXY_SECRET', proxySecret);
  app.get(ConfigService).set('CORS_ORIGIN', [origin]);
  configureApp(app);
}

@Controller('test-private')
class PrivateTestController {
  @Get() read() {
    return { protected: true };
  }
}

describe.skipIf(process.env.RUN_DATABASE_TESTS !== 'true')(
  'Autenticação HTTP + PostgreSQL real — contas isoladas',
  () => {
    let app: INestApplication;
    let prisma: PrismaService;
    let cookie: string;
    let userId: string;
    const prefix = `auth-e2e-${randomUUID()}`;
    const email = `${prefix}@example.invalid`;
    const emails = new Set([email]);
    const freshEmail = () => {
      const value = `auth-test-${randomUUID()}@example.invalid`;
      emails.add(value);
      return value;
    };

    beforeAll(async () => {
      if (
        !/^taskflow_etapa0[4567]_test/.test(
          new URL(process.env.DATABASE_URL ?? '').pathname.slice(1),
        )
      )
        throw new Error('Use um banco isolado taskflow_etapa07_test*.');
      const module = await Test.createTestingModule({
        imports: [AppModule],
        controllers: [PrivateTestController],
      }).compile();
      app = module.createNestApplication();
      configureTestApp(app);
      await app.init();
      prisma = app.get(PrismaService);
      const response = await call(app, 'post', '/api/auth/register')
        .send({
          name: '  Pessoa   de Teste  ',
          email: `  ${email.toUpperCase()}  `,
          password,
        })
        .expect(201);
      cookie = cookieOf(response);
      userId = response.body.user.id as string;
      expect(response.body.user).toEqual({
        id: userId,
        name: 'Pessoa de Teste',
        email,
      });
    }, 15000);
    afterAll(async () => {
      try {
        if (prisma)
          await prisma.user.deleteMany({
            where: { email: { in: [...emails] } },
          });
      } finally {
        await app?.close();
      }
    });

    it('persiste senha Argon2id e somente o hash do token; devolve apenas dados públicos', async () => {
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: userId },
      });
      expect(user.passwordHash).toMatch(/^\$argon2id\$/);
      expect(await verify(user.passwordHash, password)).toBe(true);
      const token = cookie.split('=')[1];
      const session = await prisma.session.findUniqueOrThrow({
        where: { tokenHash: hashSessionToken(token) },
      });
      expect(session.tokenHash).not.toBe(token);
      expect(session.tokenHash).toHaveLength(64);
      expect(session.userId).toBe(userId);
      expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now());
      const response = await call(app, 'get', '/api/auth/me')
        .set('Cookie', cookie)
        .expect(200);
      expect(Object.keys(response.body.user).sort()).toEqual([
        'email',
        'id',
        'name',
      ]);
      expect(response.text).not.toMatch(/passwordHash|tokenHash|expiresAt/);
      expect(response.headers['cache-control']).toBe('no-store');
    });
    it('rejeita e-mail inválido com erro de campo', async () => {
      const response = await call(app, 'post', '/api/auth/register')
        .send({ name: 'Teste', email: 'invalido', password })
        .expect(400);
      expect(response.body.errors.email).toBeDefined();
    });
    it.each(['curta', 'x'.repeat(129)])(
      'rejeita senha fora dos limites: %s',
      async (invalid) => {
        const response = await call(app, 'post', '/api/auth/register')
          .send({ name: 'Teste', email: freshEmail(), password: invalid })
          .expect(400);
        expect(response.body.errors.password).toBeDefined();
        expect(response.text).not.toContain(invalid);
      },
    );
    it('rejeita nome vazio, tipos incorretos e campos não permitidos', async () => {
      await call(app, 'post', '/api/auth/register')
        .send({ name: '  ', email: freshEmail(), password })
        .expect(400);
      await call(app, 'post', '/api/auth/register')
        .send({ name: 123, email: [], password: {} })
        .expect(400);
      await call(app, 'post', '/api/auth/register')
        .send({ name: 'Teste', email: freshEmail(), password, role: 'ADMIN' })
        .expect(400);
    });
    it('impede e-mail duplicado com caixa diferente', async () => {
      await call(app, 'post', '/api/auth/register')
        .send({ name: 'Outra pessoa', email: email.toUpperCase(), password })
        .expect(409);
    });
    it('o banco impede duplicidade sem depender da normalização do DTO', async () => {
      await expect(
        prisma.user.create({
          data: {
            name: 'Teste',
            email: email.toUpperCase(),
            passwordHash: 'unused-test-value',
          },
        }),
      ).rejects.toMatchObject({ code: 'P2002' });
    });
    it('resolve cadastros concorrentes com uma única conta', async () => {
      const concurrentEmail = freshEmail();
      const responses = await Promise.all(
        [concurrentEmail, concurrentEmail.toUpperCase()].map((value) =>
          call(app, 'post', '/api/auth/register').send({
            name: 'Concorrência teste',
            email: value,
            password,
          }),
        ),
      );
      expect(
        responses
          .map((response) => response.status)
          .sort((left, right) => left - right),
      ).toEqual([201, 409]);
      expect(
        await prisma.user.count({
          where: { email: { equals: concurrentEmail, mode: 'insensitive' } },
        }),
      ).toBe(1);
    });
    it('login correto normaliza e-mail e cria um novo token aleatório', async () => {
      const response = await call(app, 'post', '/api/auth/login')
        .send({ email: ` ${email.toUpperCase()} `, password })
        .expect(200);
      const newCookie = cookieOf(response);
      expect(newCookie).not.toBe(cookie);
      expect(response.body.user.id).toBe(userId);
      const header = String(response.headers['set-cookie'][0]);
      expect(header).toContain('HttpOnly');
      expect(header).toContain('SameSite=Lax');
      expect(header).toContain('Path=/');
      expect(header).toContain('Max-Age=');
      expect(header).not.toContain('Domain=');
      expect(header).not.toContain('Secure');
      await call(app, 'get', '/api/auth/me')
        .set('Cookie', newCookie)
        .expect(200);
    });
    it('login incorreto e conta inexistente têm a mesma mensagem genérica', async () => {
      const wrong = await call(app, 'post', '/api/auth/login')
        .send({ email, password: 'senha incorreta' })
        .expect(401);
      const missing = await call(app, 'post', '/api/auth/login')
        .send({ email: freshEmail(), password })
        .expect(401);
      expect(wrong.body.message).toBe('E-mail ou senha incorretos.');
      expect(missing.body.message).toBe(wrong.body.message);
    });
    it('busca e-mail exato: percentuais e sublinhados não são curingas de login', async () => {
      for (const pattern of [
        'auth-e2e-%@example.invalid',
        email.replace('auth-e2e', 'auth_e2e'),
      ]) {
        await call(app, 'post', '/api/auth/login')
          .send({ email: pattern, password })
          .expect(401);
      }
    });
    it('rejeita sessão ausente, malformada ou token inexistente', async () => {
      await call(app, 'get', '/api/auth/me').expect(401);
      await call(app, 'get', '/api/auth/me')
        .set('Cookie', 'taskflow_session=invalido')
        .expect(401);
      await call(app, 'get', '/api/auth/me')
        .set(
          'Cookie',
          `taskflow_session=${randomBytes(32).toString('base64url')}`,
        )
        .expect(401);
    });
    it('rejeita sessão expirada no servidor', async () => {
      const login = await call(app, 'post', '/api/auth/login')
        .send({ email, password })
        .expect(200);
      const expiredCookie = cookieOf(login);
      await prisma.session.update({
        where: { tokenHash: hashSessionToken(expiredCookie.split('=')[1]) },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      await call(app, 'get', '/api/auth/me')
        .set('Cookie', expiredCookie)
        .expect(401);
    });
    it('logout invalida a sessão, remove o cookie e impede reutilização do token', async () => {
      const login = await call(app, 'post', '/api/auth/login')
        .send({ email, password })
        .expect(200);
      const logoutCookie = cookieOf(login);
      const response = await call(app, 'post', '/api/auth/logout')
        .set('Cookie', logoutCookie)
        .expect(204);
      const cleared = String(response.headers['set-cookie'][0]);
      expect(cleared).toContain('taskflow_session=;');
      expect(cleared).toContain('Expires=Thu, 01 Jan 1970');
      expect(cleared).toContain('HttpOnly');
      expect(cleared).toContain('SameSite=Lax');
      expect(cleared).not.toContain('Domain=');
      await call(app, 'get', '/api/auth/me')
        .set('Cookie', logoutCookie)
        .expect(401);
      await call(app, 'get', '/api/auth/me').set('Cookie', cookie).expect(200);
    });
    it('aplica Secure quando configurado e remove o cookie com os mesmos atributos', async () => {
      const config = app.get(ConfigService);
      config.set('COOKIE_SECURE', true);
      try {
        const response = await call(app, 'post', '/api/auth/login')
          .send({ email, password })
          .expect(200);
        expect(String(response.headers['set-cookie'][0])).toContain('Secure');
        const logout = await call(app, 'post', '/api/auth/logout')
          .set('Cookie', cookieOf(response))
          .expect(204);
        expect(String(logout.headers['set-cookie'][0])).toContain('Secure');
      } finally {
        config.set('COOKIE_SECURE', false);
      }
    });
    it('protege novas rotas privadas por padrão no backend', async () => {
      await call(app, 'get', '/api/test-private').expect(401);
      await call(app, 'get', '/api/test-private')
        .set('Cookie', cookie)
        .expect(200);
    });
    it('bloqueia CSRF com Origin ausente, null ou externo', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .set('x-taskflow-proxy-secret', proxySecret)
        .send({ email, password })
        .expect(403);
      for (const otherOrigin of ['null', 'https://external.example']) {
        await call(app, 'post', '/api/auth/logout')
          .set('Origin', otherOrigin)
          .set('Cookie', cookie)
          .expect(403);
      }
      await call(app, 'get', '/api/auth/me').set('Cookie', cookie).expect(200);
    });
    it('não confia em cabeçalhos do proxy sem o segredo correto; health continua público', async () => {
      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('x-taskflow-client-ip', '192.0.2.200')
        .set('Cookie', cookie)
        .expect(403);
      await request(app.getHttpServer()).get('/api/health').expect(200);
    });
    it('CORS permite cookies somente para a origem configurada', async () => {
      const response = await call(app, 'get', '/api/auth/me')
        .set('Cookie', cookie)
        .expect(200);
      expect(response.headers['access-control-allow-origin']).toBe(origin);
      expect(response.headers['access-control-allow-credentials']).toBe('true');
      await request(app.getHttpServer())
        .options('/api/auth/login')
        .set('Origin', origin)
        .set('Access-Control-Request-Method', 'POST')
        .expect(204);
    });
    it('falha do banco retorna 503 em vez de 401 ou detalhes privados', async () => {
      const spy = vi
        .spyOn(prisma.session, 'findUnique')
        .mockRejectedValueOnce(new Error('private-database-details'));
      try {
        const response = await call(app, 'get', '/api/auth/me')
          .set('Cookie', cookie)
          .expect(503);
        expect(response.text).not.toContain('private-database-details');
      } finally {
        spy.mockRestore();
      }
    });
  },
);

describe('Rate limiting HTTP real por IP e conta (serviço de autenticação substituído)', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AuthService)
      .useValue({
        login: () => {
          throw new UnauthorizedException('E-mail ou senha incorretos.');
        },
        register: () => ({
          user: {
            id: 'rate-test',
            name: 'Teste',
            email: 'rate@example.invalid',
          },
          token: randomBytes(32).toString('base64url'),
          expiresAt: new Date(Date.now() + 60000),
        }),
      })
      .overrideProvider(PasswordService)
      .useValue({})
      .compile();
    app = module.createNestApplication();
    configureTestApp(app);
    await app.init();
  });
  afterAll(async () => {
    await app?.close();
  });
  it('limita login pela mesma conta apesar de IPs e caixa diferentes', async () => {
    for (let i = 0; i < 10; i++)
      await call(app, 'post', '/api/auth/login')
        .send({
          email:
            i % 2
              ? ' RATE-ACCOUNT@example.invalid '
              : 'rate-account@example.invalid',
          password,
        })
        .expect(401);
    const response = await call(app, 'post', '/api/auth/login')
      .send({ email: 'rate-account@example.invalid', password })
      .expect(429);
    expect(Number(response.headers['retry-after'])).toBeGreaterThan(0);
    expect(response.body.message).toContain('Muitas tentativas');
  });
  it('limita login pelo IP mesmo alternando contas', async () => {
    for (let i = 0; i < 20; i++)
      await call(app, 'post', '/api/auth/login', '203.0.113.50')
        .send({ email: `ip-limit-${i}@example.invalid`, password })
        .expect(401);
    await call(app, 'post', '/api/auth/login', '203.0.113.50')
      .send({ email: 'ip-limit-last@example.invalid', password })
      .expect(429);
  });
  it('também limita cadastros por IP', async () => {
    for (let i = 0; i < 5; i++)
      await call(app, 'post', '/api/auth/register', '203.0.113.60')
        .send({
          name: 'Teste',
          email: `register-limit-${i}@example.invalid`,
          password,
        })
        .expect(201);
    await call(app, 'post', '/api/auth/register', '203.0.113.60')
      .send({
        name: 'Teste',
        email: 'register-limit-last@example.invalid',
        password,
      })
      .expect(429);
  });
});
