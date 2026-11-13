import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { WorkspacesService } from '../workspaces/workspaces.service.js';
import type {
  AttentionReason,
  AttentionTask,
  DashboardSummary,
} from './dashboard.types.js';

const attentionSelect = {
  id: true,
  title: true,
  priority: true,
  dueAt: true,
  column: { select: { board: { select: { id: true, name: true } } } },
} as const;
type AttentionRecord = Prisma.TaskGetPayload<{
  select: typeof attentionSelect;
}>;
const attentionLimit = 5;

@Injectable()
export class DashboardService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(WorkspacesService) private readonly workspaces: WorkspacesService,
  ) {}

  async summary(
    userId: string,
    workspaceId: string,
    today: string,
  ): Promise<DashboardSummary> {
    const workspace = await this.workspaces.requireMember(workspaceId, userId);
    const start = new Date(`${today}T00:00:00.000Z`);
    const nextWeek = new Date(start);
    nextWeek.setUTCDate(nextWeek.getUTCDate() + 8); // Hoje e os próximos sete dias.
    const scope: Prisma.TaskWhereInput = {
      column: {
        board: { workspaceId, workspace: { members: { some: { userId } } } },
      },
    };
    const pending: Prisma.TaskWhereInput = {
      AND: [scope, { column: { status: { not: 'DONE' } } }],
    };

    return this.prisma.$transaction(
      async (tx): Promise<DashboardSummary> => {
        // O banco conta tarefas por coluna; nenhum cartão é carregado para contagem.
        // Prisma carrega as relações em lote, sem uma consulta por quadro.
        const records = await tx.board.findMany({
          where: { workspaceId, workspace: { members: { some: { userId } } } },
          select: {
            id: true,
            name: true,
            columns: {
              select: { status: true, _count: { select: { tasks: true } } },
            },
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        });
        const metrics = { total: 0, inProgress: 0, completed: 0, overdue: 0 };
        const boards = records.map((board) => {
          let totalTasks = 0,
            completedTasks = 0;
          for (const column of board.columns) {
            const count = column._count.tasks;
            totalTasks += count;
            metrics.total += count;
            if (column.status === 'IN_PROGRESS') metrics.inProgress += count;
            if (column.status === 'DONE') {
              metrics.completed += count;
              completedTasks += count;
            }
          }
          return {
            id: board.id,
            name: board.name,
            totalTasks,
            completedTasks,
            progress: totalTasks
              ? Math.round((completedTasks * 100) / totalTasks)
              : null,
          };
        });
        metrics.overdue = await tx.task.count({
          where: { AND: [pending, { dueAt: { lt: start } }] },
        });

        const attention: AttentionTask[] = [];
        const append = (rows: AttentionRecord[], reason: AttentionReason) => {
          attention.push(
            ...rows.map((row) => ({
              id: row.id,
              title: row.title,
              priority: row.priority,
              dueAt: row.dueAt?.toISOString() ?? null,
              board: row.column.board,
              reason,
            })),
          );
        };
        append(
          await tx.task.findMany({
            where: { AND: [pending, { dueAt: { lt: start } }] },
            select: attentionSelect,
            take: attentionLimit,
            orderBy: [
              { dueAt: 'asc' },
              { priority: 'desc' },
              { createdAt: 'asc' },
              { id: 'asc' },
            ],
          }),
          'OVERDUE',
        );
        if (attention.length < attentionLimit)
          append(
            await tx.task.findMany({
              where: {
                AND: [pending, { dueAt: { gte: start, lt: nextWeek } }],
              },
              select: attentionSelect,
              take: attentionLimit - attention.length,
              orderBy: [
                { dueAt: 'asc' },
                { priority: 'desc' },
                { createdAt: 'asc' },
                { id: 'asc' },
              ],
            }),
            'DUE_SOON',
          );
        if (attention.length < attentionLimit)
          append(
            await tx.task.findMany({
              where: {
                AND: [
                  pending,
                  {
                    priority: { in: ['HIGH', 'URGENT'] },
                    OR: [{ dueAt: null }, { dueAt: { gte: nextWeek } }],
                  },
                ],
              },
              select: attentionSelect,
              take: attentionLimit - attention.length,
              orderBy: [
                { priority: 'desc' },
                { dueAt: { sort: 'asc', nulls: 'last' } },
                { createdAt: 'asc' },
                { id: 'asc' },
              ],
            }),
            'HIGH_PRIORITY',
          );
        return { workspace, metrics, boards, attention };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
}
