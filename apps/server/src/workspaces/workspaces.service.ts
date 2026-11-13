import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { WorkspaceRole } from '../generated/prisma/client.js';

const workspaceSelect = { id: true, name: true } as const;

@Injectable()
export class WorkspacesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // Retorna 404 também para IDs existentes sem associação, evitando IDOR.
  async requireMember(
    workspaceId: string,
    userId: string,
    roles?: WorkspaceRole[],
  ) {
    const member = await this.prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } },
      select: { role: true, workspace: { select: workspaceSelect } },
    });
    if (!member) throw new NotFoundException('Workspace não encontrado.');
    if (roles && !roles.includes(member.role))
      throw new ForbiddenException('Você não tem permissão para esta ação.');
    return { ...member.workspace, role: member.role };
  }

  async list(userId: string) {
    const memberships = await this.prisma.workspaceMember.findMany({
      where: { userId },
      select: { role: true, workspace: { select: workspaceSelect } },
      orderBy: [{ workspace: { createdAt: 'asc' } }, { workspaceId: 'asc' }],
    });
    return memberships.map(({ role, workspace }) => ({ ...workspace, role }));
  }

  async create(userId: string, name: string) {
    // Nested write: workspace e OWNER são confirmados ou revertidos juntos.
    const workspace = await this.prisma.workspace.create({
      data: { name, members: { create: { userId, role: 'OWNER' } } },
      select: workspaceSelect,
    });
    return { ...workspace, role: 'OWNER' as const };
  }

  async update(id: string, userId: string, name: string) {
    const workspace = await this.requireMember(id, userId, ['OWNER', 'ADMIN']);
    const updated = await this.prisma.workspace.update({
      where: {
        id,
        members: { some: { userId, role: { in: ['OWNER', 'ADMIN'] } } },
      },
      data: { name },
      select: workspaceSelect,
    });
    return { ...updated, role: workspace.role };
  }

  async remove(id: string, userId: string) {
    await this.requireMember(id, userId, ['OWNER']);
    await this.prisma.workspace.delete({
      where: { id, members: { some: { userId, role: 'OWNER' } } },
      select: { id: true },
    });
  }
}
