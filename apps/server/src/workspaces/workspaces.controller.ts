import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  UseFilters,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { validateDto } from '../config/validation.js';
import { ResourceErrorsFilter } from '../common/resource-errors.filter.js';
import { CreateWorkspaceDto } from './dto/create-workspace.dto.js';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto.js';
import { WorkspacesService } from './workspaces.service.js';

@Controller('workspaces')
@UseFilters(ResourceErrorsFilter)
export class WorkspacesController {
  constructor(
    @Inject(WorkspacesService) private readonly workspaces: WorkspacesService,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  list(@Req() request: AuthenticatedRequest) {
    return this.workspaces.list(request.auth.user.id);
  }
  @Post()
  @Header('Cache-Control', 'no-store')
  create(
    @Req() request: AuthenticatedRequest,
    @Body(validateDto(CreateWorkspaceDto)) input: CreateWorkspaceDto,
  ) {
    return this.workspaces.create(request.auth.user.id, input.name);
  }
  @Get(':id')
  @Header('Cache-Control', 'no-store')
  get(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.workspaces.requireMember(id, request.auth.user.id);
  }
  @Patch(':id')
  @Header('Cache-Control', 'no-store')
  update(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
    @Body(validateDto(UpdateWorkspaceDto)) input: UpdateWorkspaceDto,
  ) {
    return this.workspaces.update(id, request.auth.user.id, input.name);
  }
  @Delete(':id')
  @Header('Cache-Control', 'no-store')
  @HttpCode(204)
  remove(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.workspaces.remove(id, request.auth.user.id);
  }
}
