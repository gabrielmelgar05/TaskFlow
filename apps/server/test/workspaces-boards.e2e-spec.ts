import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/configure-app.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { WorkspacesService } from '../src/workspaces/workspaces.service.js';

const origin = 'http://localhost:3000';
const prefix = `stage04-${randomUUID()}`;
const password = 'Uma frase isolada para testes 2026!';
const secret = 'stage04-isolated-proxy-secret-32-characters';
type Account = { id: string; cookie: string };

// Os testes de falha atômica usam um trigger temporário: nunca rodar no banco da aplicação.
describe.skipIf(process.env.RUN_DATABASE_TESTS !== 'true')(
  'Etapa 04 — HTTP + PostgreSQL isolado',
  () => {
    let app: INestApplication;
    let prisma: PrismaService;
    let owner: Account;
    let admin: Account;
    let member: Account;
    let outsider: Account;
    let workspaceId: string;
    let boardId: string;
    let foreignWorkspaceId: string;
    let foreignBoardId: string;
    const ownedWorkspaces = new Set<string>();
    const users = new Set<string>();
    let address = 1;
    const call = (
      method: 'get' | 'post' | 'patch' | 'delete',
      path: string,
      account?: Account,
    ) => {
      const test = request(app.getHttpServer())
        [method](path)
        .set('Origin', origin)
        .set('x-taskflow-proxy-secret', secret)
        .set('x-taskflow-client-ip', `192.0.2.${(address++ % 250) + 1}`);
      return account ? test.set('Cookie', account.cookie) : test;
    };
    async function newApp() {
      const module = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
      const instance = module.createNestApplication();
      instance.get(ConfigService).set('API_PROXY_SECRET', secret);
      instance.get(ConfigService).set('CORS_ORIGIN', [origin]);
      configureApp(instance);
      await instance.init();
      return instance;
    }
    beforeAll(async () => {
      const database = new URL(process.env.DATABASE_URL ?? '').pathname.slice(
        1,
      );
      if (!database.startsWith('taskflow_etapa04_test'))
        throw new Error(
          'Use um DATABASE_URL de teste isolado: taskflow_etapa04_test*.',
        );
      app = await newApp();
      prisma = app.get(PrismaService);
      async function register(label: string): Promise<Account> {
        const response = await call('post', '/api/auth/register')
          .send({
            name: label,
            email: `${prefix}-${label}@example.invalid`,
            password,
          })
          .expect(201);
        const id = response.body.user.id as string;
        users.add(id);
        return {
          id,
          cookie: String(response.headers['set-cookie'][0]).split(';')[0],
        };
      }
      owner = await register('owner');
      admin = await register('admin');
      member = await register('member');
      outsider = await register('outsider');
    }, 20000);
    afterAll(async () => {
      if (prisma) {
        await prisma.workspace.deleteMany({
          where: { id: { in: [...ownedWorkspaces] } },
        });
        await prisma.user.deleteMany({ where: { id: { in: [...users] } } });
      }
      await app?.close();
    });

    it('protege todos os endpoints sem sessão, preservando health e auth/me', async () => {
      for (const [method, path] of [
        ['get', '/api/workspaces'],
        ['post', '/api/workspaces'],
        ['get', '/api/workspaces/missing'],
        ['patch', '/api/workspaces/missing'],
        ['delete', '/api/workspaces/missing'],
        ['get', '/api/workspaces/missing/boards'],
        ['post', '/api/workspaces/missing/boards'],
        ['get', '/api/boards/missing'],
        ['patch', '/api/boards/missing'],
        ['delete', '/api/boards/missing'],
      ] as const)
        await call(method, path).expect(401);
      await request(app.getHttpServer()).get('/api/health').expect(200);
      await call('get', '/api/auth/me', owner).expect(200);
    });
    it('valida nomes, tipos e campos extras; impede escolher outro proprietário', async () => {
      for (const name of [
        '',
        '   ',
        'x'.repeat(101),
        '<script>',
        'linha\nquebrada',
        42,
        null,
      ]) {
        const response = await call('post', '/api/workspaces', owner)
          .send({ name })
          .expect(400);
        expect(response.body.errors.name).toBeDefined();
      }
      await call('post', '/api/workspaces', owner)
        .send({ name: 'Teste', userId: outsider.id })
        .expect(400);
      await call('post', '/api/workspaces', owner)
        .send({ name: 'Teste', role: 'ADMIN' })
        .expect(400);
    });
    it('cria workspace com OWNER da sessão e resposta mínima', async () => {
      const response = await call('post', '/api/workspaces', owner)
        .send({ name: `  ${prefix}   Projetos  ` })
        .expect(201);
      workspaceId = response.body.id as string;
      ownedWorkspaces.add(workspaceId);
      expect(response.body).toEqual({
        id: workspaceId,
        name: `${prefix} Projetos`,
        role: 'OWNER',
      });
      expect(response.headers['cache-control']).toBe('no-store');
      const associations = await prisma.workspaceMember.findMany({
        where: { workspaceId },
      });
      expect(associations).toHaveLength(1);
      expect(associations[0]).toMatchObject({
        userId: owner.id,
        role: 'OWNER',
      });
    });
    it('reverte workspace se a criação do OWNER falhar por chave estrangeira', async () => {
      const name = `${prefix} rollback`;
      await expect(
        app.get(WorkspacesService).create('nonexistent-stage04-user', name),
      ).rejects.toThrow();
      expect(await prisma.workspace.count({ where: { name } })).toBe(0);
    });
    it('lista apenas associações do usuário e mantém uma ordem estável', async () => {
      const foreign = await call('post', '/api/workspaces', outsider)
        .send({ name: `${prefix} Outro` })
        .expect(201);
      foreignWorkspaceId = foreign.body.id as string;
      ownedWorkspaces.add(foreignWorkspaceId);
      await prisma.workspaceMember.createMany({
        data: [
          { workspaceId, userId: admin.id, role: 'ADMIN' },
          { workspaceId, userId: member.id, role: 'MEMBER' },
        ],
      });
      const own = await call('get', '/api/workspaces', owner).expect(200);
      expect(own.body.map((item: { id: string }) => item.id)).toEqual([
        workspaceId,
      ]);
      const repeated = await call('get', '/api/workspaces', owner).expect(200);
      expect(repeated.body).toEqual(own.body);
      const shared = await call('get', '/api/workspaces', member).expect(200);
      expect(shared.body[0].role).toBe('MEMBER');
    });
    it('OWNER e ADMIN renomeiam; MEMBER não altera nem exclui e ADMIN não exclui workspace', async () => {
      for (const account of [owner, admin])
        await call('patch', `/api/workspaces/${workspaceId}`, account)
          .send({ name: `${prefix} Renomeado` })
          .expect(200);
      await call('patch', `/api/workspaces/${workspaceId}`, member)
        .send({ name: 'Proibido' })
        .expect(403);
      for (const account of [member, admin])
        await call('delete', `/api/workspaces/${workspaceId}`, account).expect(
          403,
        );
      await call('patch', `/api/workspaces/${workspaceId}`, owner)
        .send({})
        .expect(400);
    });
    it('oculta workspace de terceiros em leitura, alteração, exclusão e listagem/criação de quadros', async () => {
      for (const method of ['get', 'patch', 'delete'] as const)
        await call(method, `/api/workspaces/${workspaceId}`, outsider)
          .send(method === 'patch' ? { name: 'IDOR' } : undefined)
          .expect(404);
      await call(
        'get',
        `/api/workspaces/${workspaceId}/boards`,
        outsider,
      ).expect(404);
      await call('post', `/api/workspaces/${workspaceId}/boards`, outsider)
        .send({ name: 'IDOR' })
        .expect(404);
      await call('get', '/api/workspaces/nonexistent', owner).expect(404);
    });
    it('cria quadro e três colunas atomicamente com nomes e posições persistidos', async () => {
      const response = await call(
        'post',
        `/api/workspaces/${workspaceId}/boards`,
        owner,
      )
        .send({ name: 'Projeto Kanban' })
        .expect(201);
      boardId = response.body.id as string;
      expect(response.body.workspaceId).toBe(workspaceId);
      expect(Object.keys(response.body).sort()).toEqual([
        'createdAt',
        'id',
        'name',
        'workspaceId',
      ]);
      const columns = await prisma.boardColumn.findMany({
        where: { boardId },
        orderBy: { position: 'asc' },
        select: { name: true, position: true },
      });
      expect(columns).toEqual([
        { name: 'A fazer', position: 0 },
        { name: 'Em andamento', position: 1 },
        { name: 'Concluído', position: 2 },
      ]);
      for (let i = 0; i < 2; i++) {
        const opened = await call(
          'get',
          `/api/boards/${boardId}`,
          member,
        ).expect(200);
        expect(
          opened.body.columns.map(
            (column: { position: number }) => column.position,
          ),
        ).toEqual([0, 1, 2]);
        expect(opened.body.workspace).toMatchObject({
          id: workspaceId,
          role: 'MEMBER',
        });
      }
      expect(await prisma.boardColumn.count({ where: { boardId } })).toBe(3);
    });
    it('lista quadros apenas do workspace solicitado, incluindo lista vazia', async () => {
      const empty = await call(
        'get',
        `/api/workspaces/${foreignWorkspaceId}/boards`,
        outsider,
      ).expect(200);
      expect(empty.body).toEqual([]);
      const foreign = await call(
        'post',
        `/api/workspaces/${foreignWorkspaceId}/boards`,
        outsider,
      )
        .send({ name: 'Quadro privado' })
        .expect(201);
      foreignBoardId = foreign.body.id as string;
      const own = await call(
        'get',
        `/api/workspaces/${workspaceId}/boards`,
        member,
      ).expect(200);
      expect(own.body.map((item: { id: string }) => item.id)).toEqual([
        boardId,
      ]);
    });
    it('valida os DTOs de quadro e bloqueia MEMBER em todas as escritas', async () => {
      for (const body of [
        { name: '' },
        { name: '<script>' },
        { name: 'x'.repeat(101) },
        { name: 'Bom', workspaceId: foreignWorkspaceId },
      ]) {
        await call('post', `/api/workspaces/${workspaceId}/boards`, owner)
          .send(body)
          .expect(400);
        await call('patch', `/api/boards/${boardId}`, owner)
          .send(body)
          .expect(400);
      }
      await call('post', `/api/workspaces/${workspaceId}/boards`, member)
        .send({ name: 'Proibido' })
        .expect(403);
      await call('patch', `/api/boards/${boardId}`, member)
        .send({ name: 'Proibido' })
        .expect(403);
      await call('delete', `/api/boards/${boardId}`, member).expect(403);
    });
    it('OWNER e ADMIN podem criar, renomear e excluir quadros; exclusão preserva os outros', async () => {
      for (const account of [owner, admin]) {
        const created = await call(
          'post',
          `/api/workspaces/${workspaceId}/boards`,
          account,
        )
          .send({ name: 'Temporário' })
          .expect(201);
        const id = created.body.id as string;
        await call('patch', `/api/boards/${id}`, account)
          .send({ name: 'Renomeado' })
          .expect(200);
        expect(
          (await prisma.board.findUniqueOrThrow({ where: { id } })).name,
        ).toBe('Renomeado');
        await call('delete', `/api/boards/${id}`, account).expect(204);
        expect(await prisma.boardColumn.count({ where: { boardId: id } })).toBe(
          0,
        );
        expect(await prisma.board.count({ where: { id: boardId } })).toBe(1);
      }
      await call('patch', `/api/boards/${boardId}`, admin)
        .send({ name: 'Projeto persistente' })
        .expect(200);
    });
    it('impede IDOR em todas as operações de quadro e não revela sua existência', async () => {
      for (const method of ['get', 'patch', 'delete'] as const) {
        const response = await call(method, `/api/boards/${boardId}`, outsider)
          .send(method === 'patch' ? { name: 'IDOR' } : undefined)
          .expect(404);
        expect(response.body.message).toBe('Quadro não encontrado.');
      }
      await call('get', '/api/boards/nonexistent', owner).expect(404);
      await call('get', `/api/boards/${foreignBoardId}`, owner).expect(404);
    });
    it('preserva CSRF em POST/PATCH/DELETE e CORS para os novos métodos', async () => {
      for (const method of ['post', 'patch', 'delete'] as const) {
        await call(
          method,
          method === 'post'
            ? '/api/workspaces'
            : `/api/workspaces/${workspaceId}`,
          owner,
        )
          .set('Origin', 'https://external.example')
          .send({ name: 'CSRF' })
          .expect(403);
      }
      for (const method of ['PATCH', 'DELETE']) {
        const response = await request(app.getHttpServer())
          .options(`/api/workspaces/${workspaceId}`)
          .set('Origin', origin)
          .set('Access-Control-Request-Method', method)
          .expect(204);
        expect(response.headers['access-control-allow-methods']).toContain(
          method,
        );
      }
    });
    it('preserva dados e sessão em outra instância HTTP da aplicação', async () => {
      const second = await newApp();
      try {
        const response = await request(second.getHttpServer())
          .get(`/api/boards/${boardId}`)
          .set('Cookie', owner.cookie)
          .set('x-taskflow-proxy-secret', secret)
          .expect(200);
        expect(response.body.name).toBe('Projeto persistente');
        expect(response.body.columns).toHaveLength(3);
      } finally {
        await second.close();
      }
    });
    it('reverte também quadro e colunas anteriores quando a terceira coluna falha no PostgreSQL', async () => {
      await prisma.$executeRawUnsafe(
        `CREATE FUNCTION stage04_reject_column() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.name = 'Concluído' THEN RAISE EXCEPTION 'isolated-column-failure'; END IF; RETURN NEW; END; $$`,
      );
      try {
        await prisma.$executeRawUnsafe(
          `CREATE TRIGGER stage04_reject_column BEFORE INSERT ON "BoardColumn" FOR EACH ROW EXECUTE FUNCTION stage04_reject_column()`,
        );
        const before = await prisma.boardColumn.count();
        const response = await call(
          'post',
          `/api/workspaces/${workspaceId}/boards`,
          owner,
        )
          .send({ name: `${prefix} Incompleto` })
          .expect(503);
        expect(response.text).not.toContain('isolated-column-failure');
        expect(
          await prisma.board.count({ where: { name: `${prefix} Incompleto` } }),
        ).toBe(0);
        expect(await prisma.boardColumn.count()).toBe(before);
      } finally {
        await prisma.$executeRawUnsafe(
          'DROP TRIGGER IF EXISTS stage04_reject_column ON "BoardColumn"',
        );
        await prisma.$executeRawUnsafe('DROP FUNCTION stage04_reject_column()');
      }
    });
    it('exclui somente o workspace escolhido e seus descendentes em cascata', async () => {
      await call('delete', `/api/workspaces/${workspaceId}`, owner).expect(204);
      expect(
        await prisma.workspaceMember.count({ where: { workspaceId } }),
      ).toBe(0);
      expect(await prisma.board.count({ where: { workspaceId } })).toBe(0);
      expect(await prisma.boardColumn.count({ where: { boardId } })).toBe(0);
      await call('get', `/api/boards/${boardId}`, owner).expect(404);
      await call(
        'get',
        `/api/workspaces/${foreignWorkspaceId}`,
        outsider,
      ).expect(200);
      await call('get', `/api/boards/${foreignBoardId}`, outsider).expect(200);
    });
  },
);
