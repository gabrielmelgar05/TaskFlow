import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
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
import { PrismaService } from '../src/prisma/prisma.service.js';
import { Prisma, type ColumnStatus } from '../src/generated/prisma/client.js';
import { configureApp } from '../src/configure-app.js';
import type { DashboardSummary } from '../src/dashboard/dashboard.types.js';

type Account = { id: string; cookie: string };
type Board = { id: string; columns: { id: string; status: ColumnStatus }[] };
const origin = 'http://localhost:3000';
const secret = 'stage06-isolated-proxy-secret-32-characters';
const prefix = `stage06-${randomUUID()}`;
const today = '2026-11-13';

describe.skipIf(process.env.RUN_DATABASE_TESTS !== 'true')(
  'Etapa 06 — dashboard HTTP + PostgreSQL isolado',
  () => {
    let app: INestApplication, prisma: PrismaService;
    let owner: Account, admin: Account, member: Account, outsider: Account;
    let workspaceId: string, foreignWorkspaceId: string;
    const users: string[] = [],
      workspaces: string[] = [];
    let address = 1;
    function call(
      method: 'get' | 'post' | 'patch' | 'delete',
      path: string,
      account?: Account,
    ) {
      const test = request(app.getHttpServer())
        [method](path)
        .set('Origin', origin)
        .set('x-taskflow-proxy-secret', secret)
        .set('x-taskflow-client-ip', `203.0.113.${(address++ % 250) + 1}`);
      return account ? test.set('Cookie', account.cookie) : test;
    }
    async function newWorkspace(account = owner) {
      const response = await call('post', '/api/workspaces', account)
        .send({ name: `${prefix} Workspace` })
        .expect(201);
      const id = response.body.id as string;
      workspaces.push(id);
      return id;
    }
    async function newBoard(id = workspaceId, account = owner): Promise<Board> {
      const response = await call(
        'post',
        `/api/workspaces/${id}/boards`,
        account,
      )
        .send({ name: 'Quadro real' })
        .expect(201);
      const details = await call(
        'get',
        `/api/boards/${response.body.id as string}`,
        account,
      ).expect(200);
      return details.body as Board;
    }
    async function task(
      board: Board,
      status: ColumnStatus,
      title: string,
      extra: Record<string, unknown> = {},
      account = owner,
    ) {
      const response = await call(
        'post',
        `/api/boards/${board.id}/tasks`,
        account,
      )
        .send({
          title,
          columnId: board.columns.find((column) => column.status === status)!
            .id,
          ...extra,
        })
        .expect(201);
      return response.body as { id: string };
    }
    async function summary(
      id = workspaceId,
      date = today,
      account = owner,
    ): Promise<DashboardSummary> {
      const response = await call(
        'get',
        `/api/dashboard/summary?workspaceId=${id}&today=${date}`,
        account,
      ).expect(200);
      expect(response.headers['cache-control']).toBe('no-store');
      return response.body as DashboardSummary;
    }
    beforeAll(async () => {
      if (
        !/^taskflow_etapa0[67]_test/.test(
          new URL(process.env.DATABASE_URL ?? '').pathname.slice(1),
        )
      )
        throw new Error(
          'Use um banco isolado taskflow_etapa06_test* ou taskflow_etapa07_test*.',
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
      async function register(name: string): Promise<Account> {
        const response = await call('post', '/api/auth/register')
          .send({
            name,
            email: `${prefix}-${name}@example.invalid`,
            password: 'Uma frase longa de dashboard isolado 2026!',
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
      outsider = await register('outsider');
      foreignWorkspaceId = await newWorkspace(outsider);
      const foreign = await newBoard(foreignWorkspaceId, outsider);
      await task(
        foreign,
        'IN_PROGRESS',
        'Privada',
        { dueAt: '2020-01-01', priority: 'URGENT' },
        outsider,
      );
    }, 20000);
    beforeEach(async () => {
      workspaceId = await newWorkspace();
      await prisma.workspaceMember.createMany({
        data: [
          { workspaceId, userId: admin.id, role: 'ADMIN' },
          { workspaceId, userId: member.id, role: 'MEMBER' },
        ],
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
    it('exige sessão e mantém o endpoint de saúde público', async () => {
      await call(
        'get',
        `/api/dashboard/summary?workspaceId=${workspaceId}&today=${today}`,
      ).expect(401);
      await request(app.getHttpServer()).get('/api/health').expect(200);
    });
    it('valida workspace e data civil, rejeitando campos arbitrários', async () => {
      for (const query of [
        `today=${today}`,
        `workspaceId=${workspaceId}`,
        `workspaceId=&today=${today}`,
        `workspaceId=${workspaceId}&today=2026-02-30`,
        `workspaceId=${workspaceId}&today=2026-11-13T00:00:00Z`,
        `workspaceId=${workspaceId}&today=${today}&userId=${outsider.id}`,
        `workspaceId=${workspaceId}&workspaceId=other&today=${today}`,
      ])
        await call('get', `/api/dashboard/summary?${query}`, owner).expect(400);
    });
    it('retorna 404 para workspace inexistente ou inacessível', async () => {
      await call(
        'get',
        `/api/dashboard/summary?workspaceId=${foreignWorkspaceId}&today=${today}`,
        owner,
      ).expect(404);
      await call(
        'get',
        `/api/dashboard/summary?workspaceId=${workspaceId}&today=${today}`,
        outsider,
      ).expect(404);
      await call(
        'get',
        `/api/dashboard/summary?workspaceId=nonexistent&today=${today}`,
        owner,
      ).expect(404);
    });
    it('workspace vazio tem zeros reais e listas vazias', async () => {
      expect(await summary()).toEqual({
        workspace: {
          id: workspaceId,
          name: `${prefix} Workspace`,
          role: 'OWNER',
        },
        metrics: { total: 0, inProgress: 0, completed: 0, overdue: 0 },
        boards: [],
        attention: [],
      });
    });
    it('quadro sem tarefas não inventa um percentual de progresso', async () => {
      const board = await newBoard();
      const result = await summary();
      expect(result.boards).toEqual([
        {
          id: board.id,
          name: 'Quadro real',
          totalTasks: 0,
          completedTasks: 0,
          progress: null,
        },
      ]);
      expect(result.attention).toEqual([]);
      expect(result.metrics.total).toBe(0);
    });
    it('soma múltiplos quadros e calcula progresso com dados agregados do banco', async () => {
      const first = await newBoard(),
        second = await newBoard();
      await task(first, 'TODO', 'Atrasada', { dueAt: '2026-11-12' });
      await task(first, 'TODO', 'Hoje', { dueAt: today });
      await task(first, 'IN_PROGRESS', 'Sem prazo');
      await task(second, 'DONE', 'Concluída com prazo vencido', {
        dueAt: '2026-11-01',
      });
      await task(second, 'TODO', 'Futura', { dueAt: '2027-01-01' });
      const result = await summary();
      expect(result.metrics).toEqual({
        total: 5,
        inProgress: 1,
        completed: 1,
        overdue: 1,
      });
      expect(
        result.boards.find((board) => board.id === first.id),
      ).toMatchObject({ totalTasks: 3, completedTasks: 0, progress: 0 });
      expect(
        result.boards.find((board) => board.id === second.id),
      ).toMatchObject({ totalTasks: 2, completedTasks: 1, progress: 50 });
      expect(result.boards.map((board) => board.id)).toEqual([
        second.id,
        first.id,
      ]);
    });
    it('conclusão depende do status explícito e não de nome ou posição', async () => {
      const board = await newBoard();
      const done = board.columns.find((column) => column.status === 'DONE')!;
      const todo = board.columns.find((column) => column.status === 'TODO')!;
      await prisma.boardColumn.update({
        where: { id: done.id },
        data: { name: 'A fazer', position: 0 },
      });
      await prisma.boardColumn.update({
        where: { id: todo.id },
        data: { name: 'Concluído', position: 2 },
      });
      await task(board, 'DONE', 'Feita', { dueAt: '2020-01-01' });
      await task(board, 'TODO', 'Ainda pendente', { dueAt: '2020-01-01' });
      await task(board, 'IN_PROGRESS', 'Em execução');
      const result = await summary();
      expect(result.metrics).toEqual({
        total: 3,
        inProgress: 1,
        completed: 1,
        overdue: 1,
      });
      expect(result.attention.map((task) => task.title)).toEqual([
        'Ainda pendente',
      ]);
      expect(result.boards[0].progress).toBe(33);
    });
    it('hoje não está atrasado; concluídas e tarefas sem prazo não entram em atraso', async () => {
      const board = await newBoard();
      await task(board, 'TODO', 'Ontem', { dueAt: '2026-11-12' });
      await task(board, 'TODO', 'Hoje', { dueAt: today });
      await task(board, 'TODO', 'Sem prazo');
      await task(board, 'DONE', 'Feita', { dueAt: '2020-01-01' });
      expect((await summary()).metrics.overdue).toBe(1);
      expect((await summary(workspaceId, '2026-11-12')).metrics.overdue).toBe(
        0,
      );
      expect((await summary(workspaceId, '2026-11-14')).metrics.overdue).toBe(
        2,
      );
    });
    it('prioriza atrasadas, depois prazos próximos e depois prioridade alta', async () => {
      const board = await newBoard();
      await task(board, 'TODO', 'Alta sem prazo', { priority: 'HIGH' });
      await task(board, 'IN_PROGRESS', 'Urgente sem prazo', {
        priority: 'URGENT',
      });
      await task(board, 'TODO', 'Em sete dias', { dueAt: '2026-11-20' });
      await task(board, 'TODO', 'Hoje', { dueAt: today });
      await task(board, 'TODO', 'Atrasada baixa', {
        dueAt: '2026-11-12',
        priority: 'LOW',
      });
      const result = await summary();
      expect(result.attention.map((task) => task.title)).toEqual([
        'Atrasada baixa',
        'Hoje',
        'Em sete dias',
        'Urgente sem prazo',
        'Alta sem prazo',
      ]);
      expect(result.attention.map((task) => task.reason)).toEqual([
        'OVERDUE',
        'DUE_SOON',
        'DUE_SOON',
        'HIGH_PRIORITY',
        'HIGH_PRIORITY',
      ]);
    });
    it('limita a lista de atenção a cinco sem limitar o total de atrasadas', async () => {
      const board = await newBoard();
      for (let day = 1; day <= 7; day++)
        await task(board, 'TODO', `Atraso ${day}`, {
          dueAt: `2026-11-0${day}`,
        });
      const result = await summary();
      expect(result.metrics.overdue).toBe(7);
      expect(result.attention).toHaveLength(5);
      expect(result.attention.map((task) => task.title)).toEqual([
        'Atraso 1',
        'Atraso 2',
        'Atraso 3',
        'Atraso 4',
        'Atraso 5',
      ]);
    });
    it('não lista baixa prioridade distante e não duplica prioridades altas com prazo próximo', async () => {
      const board = await newBoard();
      await task(board, 'TODO', 'Distante', {
        dueAt: '2026-11-21',
        priority: 'LOW',
      });
      await task(board, 'TODO', 'Alta amanhã', {
        dueAt: '2026-11-14',
        priority: 'HIGH',
      });
      await task(board, 'TODO', 'Urgente distante', {
        dueAt: '2026-11-21',
        priority: 'URGENT',
      });
      await task(board, 'DONE', 'Já resolvida urgente', { priority: 'URGENT' });
      const result = await summary();
      expect(result.attention.map((task) => [task.title, task.reason])).toEqual(
        [
          ['Alta amanhã', 'DUE_SOON'],
          ['Urgente distante', 'HIGH_PRIORITY'],
        ],
      );
      expect(new Set(result.attention.map((task) => task.id)).size).toBe(
        result.attention.length,
      );
    });
    it('não mistura dois workspaces do mesmo usuário', async () => {
      const first = await newBoard();
      await task(first, 'TODO', 'Do workspace atual');
      const otherId = await newWorkspace();
      const second = await newBoard(otherId);
      await task(second, 'DONE', 'De outro workspace');
      expect((await summary()).metrics).toEqual({
        total: 1,
        inProgress: 0,
        completed: 0,
        overdue: 0,
      });
      const other = await summary(otherId);
      expect(other.metrics).toEqual({
        total: 1,
        inProgress: 0,
        completed: 1,
        overdue: 0,
      });
      expect(other.boards.map((board) => board.id)).toEqual([second.id]);
    });
    it('OWNER, ADMIN e MEMBER recebem os mesmos agregados autorizados', async () => {
      const board = await newBoard();
      await task(board, 'IN_PROGRESS', 'Compartilhada');
      const own = await summary(),
        adm = await summary(workspaceId, today, admin),
        mem = await summary(workspaceId, today, member);
      expect(adm.metrics).toEqual(own.metrics);
      expect(mem.metrics).toEqual(own.metrics);
      expect(adm.workspace.role).toBe('ADMIN');
      expect(mem.workspace.role).toBe('MEMBER');
    });
    it('resposta contém só informações públicas necessárias', async () => {
      const board = await newBoard();
      await task(board, 'TODO', 'Visível', {
        description: 'Descrição que não deve ir ao dashboard',
        dueAt: '2026-11-12',
        assigneeId: admin.id,
      });
      const result = await summary();
      const serialized = JSON.stringify(result);
      expect(serialized).not.toMatch(
        /passwordHash|tokenHash|session|email|Descrição que/,
      );
      expect(Object.keys(result.attention[0]).sort()).toEqual([
        'board',
        'dueAt',
        'id',
        'priority',
        'reason',
        'title',
      ]);
    });
    it('reflete criação, edição, conclusão e exclusão sem cache', async () => {
      const board = await newBoard();
      const created = await task(board, 'TODO', 'Mudando');
      expect((await summary()).metrics.total).toBe(1);
      await call('patch', `/api/tasks/${created.id}`, owner)
        .send({ dueAt: '2026-11-12' })
        .expect(200);
      expect((await summary()).metrics.overdue).toBe(1);
      await call('patch', `/api/tasks/${created.id}/move`, owner)
        .send({
          columnId: board.columns.find((column) => column.status === 'DONE')!
            .id,
          position: 0,
        })
        .expect(200);
      expect((await summary()).metrics).toEqual({
        total: 1,
        inProgress: 0,
        completed: 1,
        overdue: 0,
      });
      expect((await summary()).boards[0].progress).toBe(100);
      await call('delete', `/api/tasks/${created.id}`, owner).expect(204);
      expect((await summary()).metrics.total).toBe(0);
      expect((await summary()).boards[0].progress).toBeNull();
    });
    it('falha Prisma responde 503 sem expor detalhes privados', async () => {
      const spy = vi
        .spyOn(prisma, '$transaction')
        .mockRejectedValueOnce(
          new Prisma.PrismaClientKnownRequestError(
            'postgresql://private:secret@internal/db',
            { code: 'P1001', clientVersion: '7.10.1' },
          ),
        );
      try {
        const response = await call(
          'get',
          `/api/dashboard/summary?workspaceId=${workspaceId}&today=${today}`,
          owner,
        ).expect(503);
        expect(response.text).not.toMatch(/secret|internal|postgresql/);
      } finally {
        spy.mockRestore();
      }
    });
  },
);
