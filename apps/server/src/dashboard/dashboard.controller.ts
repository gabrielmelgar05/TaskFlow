import {
  Controller,
  Get,
  Header,
  Inject,
  Query,
  Req,
  UseFilters,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { ResourceErrorsFilter } from '../common/resource-errors.filter.js';
import { validateDto } from '../config/validation.js';
import { DashboardQueryDto } from './dto/dashboard-query.dto.js';
import { DashboardService } from './dashboard.service.js';
import type { DashboardSummary } from './dashboard.types.js';

@Controller('dashboard')
@UseFilters(ResourceErrorsFilter)
export class DashboardController {
  constructor(
    @Inject(DashboardService) private readonly dashboard: DashboardService,
  ) {}

  @Get('summary')
  @Header('Cache-Control', 'no-store')
  summary(
    @Req() request: AuthenticatedRequest,
    @Query(validateDto(DashboardQueryDto)) query: DashboardQueryDto,
  ): Promise<DashboardSummary> {
    return this.dashboard.summary(
      request.auth.user.id,
      query.workspaceId,
      query.today,
    );
  }
}
