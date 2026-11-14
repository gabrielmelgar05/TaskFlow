import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Prisma, WorkspaceRole } from '../generated/prisma/client.js';
import type { CreateTaskDto } from './dto/create-task.dto.js';
import type { UpdateTaskDto } from './dto/update-task.dto.js';
import type { MoveTaskDto } from './dto/move-task.dto.js';
import type { TaskFieldsDto } from './dto/task-fields.dto.js';

type Tx = Prisma.TransactionClient;
type BoardAccess = { id: string; workspaceId: string; role: WorkspaceRole };
type OrderedTask = { id: string; columnId: string; position: number };
const personSelect = { id: true, name: true } as const;
const taskSelect = {
  id: true,
  title: true,
  description: true,
  priority: true,
  dueAt: true,
  columnId: true,
  position: true,
  createdAt: true,
  updatedAt: true,
  creator: { select: personSelect },
  assignee: { select: personSelect },
} as const;
const taskOrder = [
  { position: 'asc' },
  { createdAt: 'asc' },
  { id: 'asc' },
] satisfies Prisma.TaskOrderByWithRelationInput[];

@Injectable()
export class TasksService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private fieldError(field: string, message: string): never {
    throw new BadRequestException({
      message: 'Confira os campos informados.',
      errors: { [field]: message },
    });
  }

  private async board(boardId: string, userId: string) {
    const board = await this.prisma.board.findFirst({
      where: { id: boardId, workspace: { members: { some: { userId } } } },
      select: { id: true, workspaceId: true },
    });
    if (!board) throw new NotFoundException('Quadro não encontrado.');
    return board;
  }

  private async taskBoardId(id: string, userId: string) {
    const task = await this.prisma.task.findFirst({
      where: {
        id,
        column: { board: { workspace: { members: { some: { userId } } } } },
      },
      select: { column: { select: { boardId: true } } },
    });
    if (!task) throw new NotFoundException('Tarefa não encontrada.');
    return task.column.boardId;
  }

  private async inBoard<T>(
    boardId: string,
    userId: string,
    work: (tx: Tx, board: BoardAccess) => Promise<T>,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        // O lock por quadro serializa as escritas que alteram a ordem das tarefas.
        const [board] = await tx.$queryRaw<BoardAccess[]>`
        SELECT b."id", b."workspaceId", m."role"
        FROM "Board" b JOIN "WorkspaceMember" m ON m."workspaceId" = b."workspaceId"
        WHERE b."id" = ${boardId} AND m."userId" = ${userId}
        FOR UPDATE OF b`;
        if (!board) throw new NotFoundException('Quadro não encontrado.');
        return work(tx, board);
      },
      { maxWait: 5000, timeout: 10000 },
    );
  }

  private async validateAssignee(
    tx: Tx,
    workspaceId: string,
    assigneeId: string | null | undefined,
  ) {
    if (!assigneeId) return;
    const member = await tx.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: assigneeId, workspaceId } },
      select: { id: true },
    });
    if (!member)
      this.fieldError(
        'assigneeId',
        'O responsável deve participar deste workspace.',
      );
  }

  private async validateColumn(tx: Tx, boardId: string, columnId: string) {
    const column = await tx.boardColumn.findFirst({
      where: { id: columnId, boardId },
      select: { id: true },
    });
    if (!column)
      this.fieldError('columnId', 'Escolha uma coluna deste quadro.');
  }

  private fields(input: TaskFieldsDto) {
    return {
      description:
        input.description === undefined ? undefined : input.description || null,
      priority: input.priority,
      dueAt:
        input.dueAt === undefined
          ? undefined
          : input.dueAt
            ? new Date(`${input.dueAt}T00:00:00.000Z`)
            : null,
      assigneeId: input.assigneeId,
    };
  }

  private ordered(tx: Tx, columnId: string) {
    return tx.task.findMany({
      where: { columnId },
      select: { id: true, columnId: true, position: true },
      orderBy: taskOrder,
    });
  }

  private async saveOrder(tx: Tx, columnId: string, tasks: OrderedTask[]) {
    for (const [position, task] of tasks.entries()) {
      if (task.position !== position || task.columnId !== columnId)
        await tx.task.update({
          where: { id: task.id },
          data: { position, columnId },
          select: { id: true },
        });
    }
  }

  async list(boardId: string, userId: string) {
    await this.board(boardId, userId);
    return this.prisma.task.findMany({
      where: {
        column: {
          boardId,
          board: { workspace: { members: { some: { userId } } } },
        },
      },
      select: taskSelect,
      orderBy: [{ columnId: 'asc' }, ...taskOrder],
    });
  }

  async get(id: string, userId: string) {
    const task = await this.prisma.task.findFirst({
      where: {
        id,
        column: { board: { workspace: { members: { some: { userId } } } } },
      },
      select: taskSelect,
    });
    if (!task) throw new NotFoundException('Tarefa não encontrada.');
    return task;
  }

  async create(boardId: string, userId: string, input: CreateTaskDto) {
    return this.inBoard(boardId, userId, async (tx, board) => {
      await this.validateColumn(tx, boardId, input.columnId);
      await this.validateAssignee(tx, board.workspaceId, input.assigneeId);
      const tasks = await this.ordered(tx, input.columnId);
      await this.saveOrder(tx, input.columnId, tasks);
      return tx.task.create({
        data: {
          ...this.fields(input),
          title: input.title,
          columnId: input.columnId,
          creatorId: userId,
          position: tasks.length,
        },
        select: taskSelect,
      });
    });
  }

  async update(id: string, userId: string, input: UpdateTaskDto) {
    if (Object.values(input).every((value) => value === undefined))
      throw new BadRequestException('Informe ao menos um campo para editar.');
    const boardId = await this.taskBoardId(id, userId);
    return this.inBoard(boardId, userId, async (tx, board) => {
      await this.validateAssignee(tx, board.workspaceId, input.assigneeId);
      return tx.task.update({
        where: { id, column: { boardId } },
        data: { ...this.fields(input), title: input.title },
        select: taskSelect,
      });
    });
  }

  async remove(id: string, userId: string) {
    const boardId = await this.taskBoardId(id, userId);
    await this.inBoard(boardId, userId, async (tx, board) => {
      const task = await tx.task.findUnique({
        where: { id, column: { boardId } },
        select: { creatorId: true, columnId: true },
      });
      if (!task) throw new NotFoundException('Tarefa não encontrada.');
      if (board.role === 'MEMBER' && task.creatorId !== userId)
        throw new ForbiddenException(
          'Você só pode excluir tarefas criadas por você.',
        );
      await tx.task.delete({ where: { id }, select: { id: true } });
      await this.saveOrder(
        tx,
        task.columnId,
        await this.ordered(tx, task.columnId),
      );
    });
  }

  async move(id: string, userId: string, input: MoveTaskDto) {
    const boardId = await this.taskBoardId(id, userId);
    return this.inBoard(boardId, userId, async (tx) => {
      const task = await tx.task.findUnique({
        where: { id, column: { boardId } },
        select: { id: true, columnId: true, position: true },
      });
      if (!task) throw new NotFoundException('Tarefa não encontrada.');
      await this.validateColumn(tx, boardId, input.columnId);
      const source = (await this.ordered(tx, task.columnId)).filter(
        (item) => item.id !== id,
      );
      const target =
        input.columnId === task.columnId
          ? source
          : await this.ordered(tx, input.columnId);
      if (input.position > target.length)
        this.fieldError(
          'position',
          'A posição está fora dos limites da coluna.',
        );
      target.splice(input.position, 0, task);
      if (input.columnId !== task.columnId)
        await this.saveOrder(tx, task.columnId, source);
      await this.saveOrder(tx, input.columnId, target);
      // Retorna a ordem confirmada, incluindo mudanças concorrentes já concluídas.
      return tx.task.findMany({
        where: { column: { boardId } },
        select: taskSelect,
        orderBy: [{ columnId: 'asc' }, ...taskOrder],
      });
    });
  }

  async summary(userId: string, today: string) {
    const where: Prisma.TaskWhereInput = {
      column: { board: { workspace: { members: { some: { userId } } } } },
    };
    // Contagens no banco: não carregamos todos os cartões para calcular indicadores.
    const [total, inProgress, completed, overdue] =
      await this.prisma.$transaction(
        [
          this.prisma.task.count({ where }),
          this.prisma.task.count({
            where: { AND: [where, { column: { status: 'IN_PROGRESS' } }] },
          }),
          this.prisma.task.count({
            where: { AND: [where, { column: { status: 'DONE' } }] },
          }),
          this.prisma.task.count({
            where: {
              AND: [
                where,
                {
                  dueAt: { lt: new Date(`${today}T00:00:00.000Z`) },
                  column: { status: { not: 'DONE' } },
                },
              ],
            },
          }),
        ],
        { isolationLevel: 'RepeatableRead' },
      );
    return { total, inProgress, completed, overdue };
  }
}
