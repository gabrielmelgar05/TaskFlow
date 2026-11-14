import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/configure-app.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

type Account = { id: string; cookie: string };
type TaskResult = {
  id: string;
  title: string;
  columnId: string;
  position: number;
  creator: { id: string };
  assignee: { id: string } | null;
  dueAt: string | null;
  updatedAt: string;
};
const origin = 'http://localhost:3000';
const secret = 'stage05-isolated-proxy-secret-32-characters';
const prefix = `stage05-${randomUUID()}`;
const password = 'Uma frase longa e isolada de tarefas 2026!';

describe.skipIf(process.env.RUN_DATABASE_TESTS !== 'true')(
  'Etapa 05 — tarefas HTTP + PostgreSQL isolado',
  () => {
    let app: INestApplication;
    let prisma: PrismaService;
    let owner: Account,
      admin: Account,
      member: Account,
      peer: Account,
      outsider: Account;
    let workspaceId: string,
      foreignWorkspaceId: string,
      foreignBoardId: string,
      foreignColumnId: string;
    let boardId: string;
    let columns: { id: string; name: string; position: number }[];
    let address = 1;
    const users: string[] = [];
    const workspaces: string[] = [];
    function call(
      method: 'get' | 'post' | 'patch' | 'delete',
      path: string,
      account?: Account,
    ) {
      const test = request(app.getHttpServer())
        [method](path)
        .set('Origin', origin)
        .set('x-taskflow-proxy-secret', secret)
        .set('x-taskflow-client-ip', `198.51.100.${(address++ % 250) + 1}`);
      return account ? test.set('Cookie', account.cookie) : test;
    }
    async function create(
      title = 'Uma tarefa real',
      account = owner,
      columnId = columns[0].id,
      extra: Record<string, unknown> = {},
    ) {
      const response = await call(
        'post',
        `/api/boards/${boardId}/tasks`,
        account,
      )
        .send({ title, columnId, ...extra })
        .expect(201);
      return response.body as TaskResult;
    }
    async function list() {
      const response = await call(
        'get',
        `/api/boards/${boardId}/tasks`,
        owner,
      ).expect(200);
      return response.body as TaskResult[];
    }
    function expectContiguous(tasks: TaskResult[]) {
      for (const columnId of new Set(tasks.map((task) => task.columnId))) {
        const items = tasks
          .filter((task) => task.columnId === columnId)
          .sort((a, b) => a.position - b.position);
        expect(items.map((task) => task.position)).toEqual(
          items.map((_task, index) => index),
        );
      }
      expect(new Set(tasks.map((task) => task.id)).size).toBe(tasks.length);
    }
    beforeAll(async () => {
      if (
        !/^taskflow_etapa0[4567]_test/.test(
          new URL(process.env.DATABASE_URL ?? '').pathname.slice(1),
        )
      )
        throw new Error(
          'Use um banco isolado taskflow_etapa05_test* ou taskflow_etapa06_test* ou taskflow_etapa07_test*.',
        );
      const module = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
      app = module.createNestApplication();
      app.get(ConfigService).set('API_PROXY_SECRET', secret);
      app.get(ConfigService).set('CORS_ORIGIN', [origin]);
      configureApp(app);
      await app.init();
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
        users.push(id);
        return {
          id,
          cookie: String(response.headers['set-cookie'][0]).split(';')[0],
        };
      }
      owner = await register('owner');
      admin = await register('admin');
      member = await register('member');
      peer = await register('peer');
      outsider = await register('outsider');
      const workspace = await call('post', '/api/workspaces', owner)
        .send({ name: `${prefix} Principal` })
        .expect(201);
      workspaceId = workspace.body.id as string;
      workspaces.push(workspaceId);
      await prisma.workspaceMember.createMany({
        data: [
          { workspaceId, userId: admin.id, role: 'ADMIN' },
          { workspaceId, userId: member.id, role: 'MEMBER' },
          { workspaceId, userId: peer.id, role: 'MEMBER' },
        ],
      });
      const foreign = await call('post', '/api/workspaces', outsider)
        .send({ name: `${prefix} Privado` })
        .expect(201);
      foreignWorkspaceId = foreign.body.id as string;
      workspaces.push(foreignWorkspaceId);
      const board = await call(
        'post',
        `/api/workspaces/${foreignWorkspaceId}/boards`,
        outsider,
      )
        .send({ name: 'Outro quadro' })
        .expect(201);
      foreignBoardId = board.body.id as string;
      foreignColumnId = (
        await prisma.boardColumn.findFirstOrThrow({
          where: { boardId: foreignBoardId },
        })
      ).id;
    }, 20000);
    beforeEach(async () => {
      const board = await call(
        'post',
        `/api/workspaces/${workspaceId}/boards`,
        owner,
      )
        .send({ name: 'Quadro isolado de tarefas' })
        .expect(201);
      boardId = board.body.id as string;
      columns = await prisma.boardColumn.findMany({
        where: { boardId },
        orderBy: { position: 'asc' },
      });
    });
    afterAll(async () => {
      if (prisma) {
        await prisma.workspace.deleteMany({
          where: { id: { in: workspaces } },
        });
        await prisma.user.deleteMany({ where: { id: { in: users } } });
      }
      await app?.close();
    });

    it('protege todos os endpoints de tarefas e membros sem autenticação', async () => {
      for (const [method, path] of [
        ['get', `/api/boards/${boardId}/tasks`],
        ['post', `/api/boards/${boardId}/tasks`],
        ['get', '/api/tasks/missing'],
        ['patch', '/api/tasks/missing'],
        ['delete', '/api/tasks/missing'],
        ['patch', '/api/tasks/missing/move'],
        ['get', `/api/workspaces/${workspaceId}/members`],
        ['get', '/api/tasks/summary?today=2026-11-13'],
      ] as const)
        await call(method, path).expect(401);
    });
    it('cria tarefa completa com criador da sessão, responsável válido e data sem deslocamento', async () => {
      const task = await create(
        '  Preparar entrevista  ',
        member,
        columns[0].id,
        {
          description: '  Uma descrição\ncom duas linhas.  ',
          priority: 'HIGH',
          dueAt: '2026-11-13',
          assigneeId: admin.id,
        },
      );
      expect(task).toMatchObject({
        title: 'Preparar entrevista',
        description: 'Uma descrição\ncom duas linhas.',
        priority: 'HIGH',
        dueAt: '2026-11-13T00:00:00.000Z',
        creator: { id: member.id, name: 'member' },
        assignee: { id: admin.id, name: 'admin' },
        columnId: columns[0].id,
        position: 0,
      });
      expect(
        (await prisma.task.findUniqueOrThrow({ where: { id: task.id } }))
          .creatorId,
      ).toBe(member.id);
      const response = await call('get', `/api/tasks/${task.id}`, peer).expect(
        200,
      );
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.text).not.toMatch(/passwordHash|tokenHash|email|session/);
    });
    it('usa prioridade média e campos opcionais nulos; adiciona no final', async () => {
      const first = await create('Primeira');
      const second = await create('Segunda');
      expect(first).toMatchObject({
        priority: 'MEDIUM',
        description: null,
        dueAt: null,
        assignee: null,
        position: 0,
      });
      expect(second.position).toBe(1);
      expect((await list()).map((task) => task.id)).toEqual([
        first.id,
        second.id,
      ]);
    });
    it.each([
      '',
      '   ',
      'x'.repeat(201),
      42,
      null,
      'Linha\nquebrada',
      'Controle\u0000',
    ])('rejeita título inválido: %s', async (title) => {
      const response = await call('post', `/api/boards/${boardId}/tasks`, owner)
        .send({ title, columnId: columns[0].id })
        .expect(400);
      expect(response.body.errors.title).toBeDefined();
      expect(await prisma.task.count({ where: { column: { boardId } } })).toBe(
        0,
      );
    });
    it('valida descrição, prioridade e prazo inclusive datas impossíveis', async () => {
      for (const fields of [
        { description: 'x'.repeat(5001) },
        { description: 12 },
        { description: '\u0000' },
        { priority: 'CRITICAL' },
        { priority: null },
        { dueAt: '2026-02-30' },
        { dueAt: '2026-13-01' },
        { dueAt: '13/11/2026' },
        { dueAt: '2026-11-13T00:00:00Z' },
      ]) {
        const response = await call(
          'post',
          `/api/boards/${boardId}/tasks`,
          owner,
        )
          .send({ title: 'Teste', columnId: columns[0].id, ...fields })
          .expect(400);
        expect(response.body.errors[Object.keys(fields)[0]]).toBeDefined();
      }
      await create('Ano bissexto', owner, columns[0].id, {
        dueAt: '2028-02-29',
      });
    });
    it('rejeita atribuição de terceiro, coluna de outro quadro e criador arbitrário', async () => {
      const invalidAssignee = await call(
        'post',
        `/api/boards/${boardId}/tasks`,
        owner,
      )
        .send({
          title: 'Teste',
          columnId: columns[0].id,
          assigneeId: outsider.id,
        })
        .expect(400);
      expect(invalidAssignee.body.errors.assigneeId).toBeDefined();
      await call('post', `/api/boards/${boardId}/tasks`, owner)
        .send({ title: 'Teste', columnId: foreignColumnId })
        .expect(400);
      await call('post', `/api/boards/${boardId}/tasks`, owner)
        .send({
          title: 'Teste',
          columnId: columns[0].id,
          creatorId: outsider.id,
        })
        .expect(400);
      expect(await list()).toEqual([]);
    });
    it('lista apenas membros do workspace e somente id/nome', async () => {
      const response = await call(
        'get',
        `/api/workspaces/${workspaceId}/members`,
        member,
      ).expect(200);
      expect(
        new Set(response.body.map((person: { id: string }) => person.id)),
      ).toEqual(new Set([owner.id, admin.id, member.id, peer.id]));
      for (const person of response.body)
        expect(Object.keys(person).sort()).toEqual(['id', 'name']);
      await call(
        'get',
        `/api/workspaces/${workspaceId}/members`,
        outsider,
      ).expect(404);
    });
    it('OWNER, ADMIN e MEMBER criam, editam e movem tarefas', async () => {
      for (const account of [owner, admin, member]) {
        const task = await create('Criada', account);
        await call('patch', `/api/tasks/${task.id}`, account)
          .send({ title: 'Editada' })
          .expect(200);
        await call('patch', `/api/tasks/${task.id}/move`, account)
          .send({ columnId: columns[1].id, position: 0 })
          .expect(200);
        await call('get', `/api/tasks/${task.id}`, peer).expect(200);
      }
      expectContiguous(await list());
      // As permissões administrativas da etapa anterior continuam restritas.
      await call('patch', `/api/boards/${boardId}`, member)
        .send({ name: 'Proibido' })
        .expect(403);
      await call('delete', `/api/workspaces/${workspaceId}`, member).expect(
        403,
      );
    });
    it('edita todas as informações e permite limpar descrição, prazo e responsável', async () => {
      const task = await create('Original', owner, columns[0].id, {
        description: 'Descrição',
        assigneeId: member.id,
        dueAt: '2026-11-13',
      });
      const response = await call('patch', `/api/tasks/${task.id}`, peer)
        .send({
          title: 'Novo título',
          description: 'Nova descrição',
          priority: 'URGENT',
          dueAt: '2027-01-15',
          assigneeId: admin.id,
        })
        .expect(200);
      expect(response.body).toMatchObject({
        title: 'Novo título',
        priority: 'URGENT',
        dueAt: '2027-01-15T00:00:00.000Z',
        assignee: { id: admin.id },
        creator: { id: owner.id },
      });
      const cleared = await call('patch', `/api/tasks/${task.id}`, member)
        .send({ description: null, dueAt: null, assigneeId: null })
        .expect(200);
      expect(cleared.body).toMatchObject({
        description: null,
        dueAt: null,
        assignee: null,
        creator: { id: owner.id },
      });
    });
    it('edição não altera criador, coluna ou posição e rejeita nulos obrigatórios', async () => {
      const task = await create();
      for (const fields of [
        { creatorId: member.id },
        { columnId: columns[1].id },
        { position: 8 },
        { title: null },
        { priority: null },
        {},
      ])
        await call('patch', `/api/tasks/${task.id}`, member)
          .send(fields)
          .expect(400);
      await call('patch', `/api/tasks/${task.id}`, owner)
        .send({ assigneeId: outsider.id })
        .expect(400);
      expect(await list()).toHaveLength(1);
    });
    it('MEMBER exclui só o que criou; OWNER e ADMIN excluem qualquer tarefa', async () => {
      const own = await create('Do membro', member);
      const other = await create('Do proprietário');
      await call('delete', `/api/tasks/${other.id}`, member).expect(403);
      await call('delete', `/api/tasks/${own.id}`, peer).expect(403);
      await call('delete', `/api/tasks/${own.id}`, member).expect(204);
      await call('delete', `/api/tasks/${other.id}`, admin).expect(204);
      const another = await create('Do colega', peer);
      await call('delete', `/api/tasks/${another.id}`, owner).expect(204);
      await call('delete', `/api/tasks/${another.id}`, owner).expect(404);
    });
    it('compacta a ordem após exclusão e preserva as outras tarefas/colunas', async () => {
      const a = await create('A');
      const b = await create('B');
      const c = await create('C');
      const other = await create('Outra coluna', owner, columns[1].id);
      await call('delete', `/api/tasks/${b.id}`, owner).expect(204);
      const tasks = await list();
      expect(
        tasks
          .filter((task) => task.columnId === columns[0].id)
          .map((task) => [task.id, task.position]),
      ).toEqual([
        [a.id, 0],
        [c.id, 1],
      ]);
      expect(tasks.find((task) => task.id === other.id)?.position).toBe(0);
      expectContiguous(tasks);
    });
    it('reordena para cima e para baixo na mesma coluna', async () => {
      const a = await create('A');
      const b = await create('B');
      const c = await create('C');
      await call('patch', `/api/tasks/${c.id}/move`, member)
        .send({ columnId: columns[0].id, position: 0 })
        .expect(200);
      expect((await list()).map((task) => task.id)).toEqual([c.id, a.id, b.id]);
      await call('patch', `/api/tasks/${c.id}/move`, member)
        .send({ columnId: columns[0].id, position: 2 })
        .expect(200);
      expect((await list()).map((task) => task.id)).toEqual([a.id, b.id, c.id]);
      expectContiguous(await list());
    });
    it('move entre colunas, insere na posição pedida e aceita coluna vazia', async () => {
      const a = await create('A');
      const b = await create('B');
      const c = await create('C', owner, columns[1].id);
      await call('patch', `/api/tasks/${a.id}/move`, member)
        .send({ columnId: columns[1].id, position: 0 })
        .expect(200);
      const tasks = await list();
      expect(
        tasks
          .filter((task) => task.columnId === columns[0].id)
          .map((task) => [task.id, task.position]),
      ).toEqual([[b.id, 0]]);
      expect(
        tasks
          .filter((task) => task.columnId === columns[1].id)
          .map((task) => [task.id, task.position]),
      ).toEqual([
        [a.id, 0],
        [c.id, 1],
      ]);
      await call('patch', `/api/tasks/${a.id}/move`, member)
        .send({ columnId: columns[2].id, position: 0 })
        .expect(200);
      expect(
        await prisma.task.findUniqueOrThrow({ where: { id: a.id } }),
      ).toMatchObject({ columnId: columns[2].id, position: 0 });
      expectContiguous(await list());
    });
    it('rejeita posição negativa, fracionada, texto e fora da coluna sem modificar dados', async () => {
      const a = await create('A');
      await create('B');
      const before = await list();
      for (const position of [-1, 0.5, '0', 2, 1000001, null])
        await call('patch', `/api/tasks/${a.id}/move`, owner)
          .send({ columnId: columns[0].id, position })
          .expect(400);
      expect(await list()).toEqual(before);
    });
    it('não move para outro quadro nem mesmo no mesmo workspace', async () => {
      const a = await create('A');
      const another = await prisma.board.create({
        data: {
          workspaceId,
          name: 'Segundo quadro',
          columns: { create: { name: 'A fazer', position: 0 } },
        },
        include: { columns: true },
      });
      for (const columnId of [
        foreignColumnId,
        another.columns[0].id,
        'nonexistent',
      ])
        await call('patch', `/api/tasks/${a.id}/move`, owner)
          .send({ columnId, position: 0 })
          .expect(400);
      await call('patch', `/api/tasks/${a.id}/transfer`, owner)
        .send({ columnId: columns[0].id })
        .expect(404);
      expect((await list())[0].columnId).toBe(columns[0].id);
    });
    it('IDOR recebe 404 para todas as operações e não revela recursos', async () => {
      const task = await create();
      await call('get', `/api/boards/${boardId}/tasks`, outsider).expect(404);
      await call('post', `/api/boards/${boardId}/tasks`, outsider)
        .send({ title: 'IDOR', columnId: columns[0].id })
        .expect(404);
      for (const method of ['get', 'patch', 'delete'] as const)
        await call(method, `/api/tasks/${task.id}`, outsider)
          .send(method === 'patch' ? { title: 'IDOR' } : undefined)
          .expect(404);
      await call('patch', `/api/tasks/${task.id}/move`, outsider)
        .send({ columnId: foreignColumnId, position: 0 })
        .expect(404);
      await call('get', '/api/tasks/nonexistent', owner).expect(404);
      expect((await list())[0].title).toBe('Uma tarefa real');
    });
    it('preserva CSRF nas operações mutáveis', async () => {
      const task = await create();
      for (const [method, path, body] of [
        [
          'post',
          `/api/boards/${boardId}/tasks`,
          { title: 'CSRF', columnId: columns[0].id },
        ],
        ['patch', `/api/tasks/${task.id}`, { title: 'CSRF' }],
        ['delete', `/api/tasks/${task.id}`, undefined],
        [
          'patch',
          `/api/tasks/${task.id}/move`,
          { columnId: columns[1].id, position: 0 },
        ],
      ] as const)
        await call(method, path, owner)
          .set('Origin', 'https://external.example')
          .send(body)
          .expect(403);
    });
    it('criações concorrentes recebem posições únicas e consecutivas', async () => {
      const created = await Promise.all(
        Array.from({ length: 12 }, (_, index) =>
          create(`Concorrente ${index}`),
        ),
      );
      expect(new Set(created.map((task) => task.position)).size).toBe(12);
      const tasks = await list();
      expect(tasks).toHaveLength(12);
      expectContiguous(tasks);
    });
    it('movimentos simultâneos para a mesma coluna não perdem tarefas nem duplicam posições', async () => {
      const created = await Promise.all(
        Array.from({ length: 8 }, (_, index) => create(`Movimento ${index}`)),
      );
      await Promise.all(
        created.map((task) =>
          call('patch', `/api/tasks/${task.id}/move`, member)
            .send({ columnId: columns[1].id, position: 0 })
            .expect(200),
        ),
      );
      const tasks = await list();
      expect(tasks).toHaveLength(8);
      expect(tasks.every((task) => task.columnId === columns[1].id)).toBe(true);
      expectContiguous(tasks);
      expect(new Set(tasks.map((task) => task.id))).toEqual(
        new Set(created.map((task) => task.id)),
      );
    });
    it('requisições duplicadas de movimento têm o mesmo destino final sem duplicação', async () => {
      await create('A');
      await create('B');
      const task = await create('C');
      await Promise.all(
        Array.from({ length: 6 }, () =>
          call('patch', `/api/tasks/${task.id}/move`, member)
            .send({ columnId: columns[0].id, position: 0 })
            .expect(200),
        ),
      );
      const tasks = await list();
      expect(tasks).toHaveLength(3);
      expect(tasks[0].id).toBe(task.id);
      expectContiguous(tasks);
    });
    it('reverte todas as posições se uma atualização falhar dentro da transação', async () => {
      const a = await create('A');
      await create('B');
      await create('C');
      const before = await list();
      await prisma.$executeRawUnsafe(
        `CREATE FUNCTION stage05_reject_move() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."columnId" <> OLD."columnId" THEN RAISE EXCEPTION 'isolated-move-failure'; END IF; RETURN NEW; END; $$`,
      );
      try {
        await prisma.$executeRawUnsafe(
          'CREATE TRIGGER stage05_reject_move BEFORE UPDATE ON "Task" FOR EACH ROW EXECUTE FUNCTION stage05_reject_move()',
        );
        const response = await call('patch', `/api/tasks/${a.id}/move`, owner)
          .send({ columnId: columns[1].id, position: 0 })
          .expect(503);
        expect(response.text).not.toContain('isolated-move-failure');
        expect(await list()).toEqual(before);
      } finally {
        await prisma.$executeRawUnsafe(
          'DROP TRIGGER IF EXISTS stage05_reject_move ON "Task"',
        );
        await prisma.$executeRawUnsafe('DROP FUNCTION stage05_reject_move()');
      }
    });
    it('resumo conta apenas tarefas acessíveis e considera data civil e conclusão', async () => {
      const baseline = await call(
        'get',
        '/api/tasks/summary?today=2026-11-13',
        owner,
      ).expect(200);
      await create('Atrasada', owner, columns[0].id, { dueAt: '2026-11-12' });
      await create('Hoje', owner, columns[1].id, { dueAt: '2026-11-13' });
      await create('Concluída', owner, columns[2].id, { dueAt: '2026-11-12' });
      await call('post', `/api/boards/${foreignBoardId}/tasks`, outsider)
        .send({
          title: 'Não contar',
          columnId: foreignColumnId,
          dueAt: '2026-11-12',
        })
        .expect(201);
      const response = await call(
        'get',
        '/api/tasks/summary?today=2026-11-13',
        owner,
      ).expect(200);
      expect(response.body).toEqual({
        total: baseline.body.total + 3,
        inProgress: baseline.body.inProgress + 1,
        completed: baseline.body.completed + 1,
        overdue: baseline.body.overdue + 1,
      });
      await call('get', '/api/tasks/summary?today=2026-02-30', owner).expect(
        400,
      );
    });
    it('dados persistidos podem ser lidos por outro Prisma Client após novas requisições', async () => {
      const task = await create('Persistente');
      await call('patch', `/api/tasks/${task.id}/move`, owner)
        .send({ columnId: columns[2].id, position: 0 })
        .expect(200);
      const second = new PrismaService(app.get(ConfigService));
      try {
        expect(
          await second.task.findUniqueOrThrow({ where: { id: task.id } }),
        ).toMatchObject({
          title: 'Persistente',
          columnId: columns[2].id,
          position: 0,
        });
      } finally {
        await second.$disconnect();
      }
      await call('get', '/api/auth/me', member).expect(200);
      await request(app.getHttpServer()).get('/api/health').expect(200);
    });
  },
);
