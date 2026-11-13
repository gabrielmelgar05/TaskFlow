import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { WorkspacesModule } from '../workspaces/workspaces.module.js';
import { BoardsController } from './boards.controller.js';
import { BoardsService } from './boards.service.js';

@Module({
  imports: [PrismaModule, WorkspacesModule],
  controllers: [BoardsController],
  providers: [BoardsService],
})
export class BoardsModule {}
