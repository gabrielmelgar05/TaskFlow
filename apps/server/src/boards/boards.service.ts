import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { WorkspacesService } from '../workspaces/workspaces.service.js';

const boardSelect = {
  id: true,
  name: true,
  workspaceId: true,
  createdAt: true,
} as const;
const administrators = ['OWNER', 'ADMIN'] as const;

@Injectable()
export class BoardsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(WorkspacesService) private readonly workspaces: WorkspacesService,
  ) {}

  async list(workspaceId: string, userId: string) {
    await this.workspaces.requireMember(workspaceId, userId);
    return this.prisma.board.findMany({
      where: { workspaceId, workspace: { members: { some: { userId } } } },
      select: boardSelect,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  async create(workspaceId: string, userId: string, name: string) {
    await this.workspaces.requireMember(workspaceId, userId, [
      ...administrators,
    ]);
    return this.prisma.board.create({
      data: {
        name,
        workspace: {
          connect: {
            id: workspaceId,
            members: { some: { userId, role: { in: [...administrators] } } },
          },
        },
        columns: {
          create: [
            { name: 'A fazer', position: 0, status: 'TODO' },
            { name: 'Em andamento', position: 1, status: 'IN_PROGRESS' },
            { name: 'Concluído', position: 2, status: 'DONE' },
          ],
        },
      },
      select: boardSelect,
    });
  }

  async get(id: string, userId: string) {
    const board = await this.prisma.board.findFirst({
      where: { id, workspace: { members: { some: { userId } } } },
      select: {
        ...boardSelect,
        columns: {
          select: { id: true, name: true, position: true, status: true },
          orderBy: [{ position: 'asc' }, { id: 'asc' }],
        },
      },
    });
    if (!board) throw new NotFoundException('Quadro não encontrado.');
    const workspace = await this.workspaces.requireMember(
      board.workspaceId,
      userId,
    );
    return { ...board, workspace };
  }

  async update(id: string, userId: string, name: string) {
    const board = await this.get(id, userId);
    await this.workspaces.requireMember(board.workspaceId, userId, [
      ...administrators,
    ]);
    return this.prisma.board.update({
      where: {
        id,
        workspace: {
          members: { some: { userId, role: { in: [...administrators] } } },
        },
      },
      data: { name },
      select: boardSelect,
    });
  }

  async remove(id: string, userId: string) {
    const board = await this.get(id, userId);
    await this.workspaces.requireMember(board.workspaceId, userId, [
      ...administrators,
    ]);
    await this.prisma.board.delete({
      where: {
        id,
        workspace: {
          members: { some: { userId, role: { in: [...administrators] } } },
        },
      },
      select: { id: true },
    });
  }
}
