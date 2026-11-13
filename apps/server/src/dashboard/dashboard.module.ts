import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { WorkspacesModule } from '../workspaces/workspaces.module.js';
import { DashboardController } from './dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';

@Module({
  imports: [PrismaModule, WorkspacesModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
