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
  Query,
  Req,
  UseFilters,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { validateDto } from '../config/validation.js';
import { ResourceErrorsFilter } from '../common/resource-errors.filter.js';
import { CreateTaskDto } from './dto/create-task.dto.js';
import { UpdateTaskDto } from './dto/update-task.dto.js';
import { MoveTaskDto } from './dto/move-task.dto.js';
import { TaskSummaryDto } from './dto/task-summary.dto.js';
import { TasksService } from './tasks.service.js';

@Controller()
@UseFilters(ResourceErrorsFilter)
export class TasksController {
  constructor(@Inject(TasksService) private readonly tasks: TasksService) {}

  @Get('boards/:boardId/tasks')
  @Header('Cache-Control', 'no-store')
  list(
    @Param('boardId') boardId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.tasks.list(boardId, request.auth.user.id);
  }
  @Post('boards/:boardId/tasks')
  @Header('Cache-Control', 'no-store')
  create(
    @Param('boardId') boardId: string,
    @Req() request: AuthenticatedRequest,
    @Body(validateDto(CreateTaskDto)) input: CreateTaskDto,
  ) {
    return this.tasks.create(boardId, request.auth.user.id, input);
  }
  @Get('tasks/summary')
  @Header('Cache-Control', 'no-store')
  summary(
    @Req() request: AuthenticatedRequest,
    @Query(validateDto(TaskSummaryDto)) query: TaskSummaryDto,
  ) {
    return this.tasks.summary(request.auth.user.id, query.today);
  }
  @Get('tasks/:id')
  @Header('Cache-Control', 'no-store')
  get(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.tasks.get(id, request.auth.user.id);
  }
  @Patch('tasks/:id')
  @Header('Cache-Control', 'no-store')
  update(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
    @Body(validateDto(UpdateTaskDto)) input: UpdateTaskDto,
  ) {
    return this.tasks.update(id, request.auth.user.id, input);
  }
  @Delete('tasks/:id')
  @Header('Cache-Control', 'no-store')
  @HttpCode(204)
  remove(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.tasks.remove(id, request.auth.user.id);
  }
  @Patch('tasks/:id/move')
  @Header('Cache-Control', 'no-store')
  move(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
    @Body(validateDto(MoveTaskDto)) input: MoveTaskDto,
  ) {
    return this.tasks.move(id, request.auth.user.id, input);
  }
}
