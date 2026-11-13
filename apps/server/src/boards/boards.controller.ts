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
import { ResourceErrorsFilter } from '../common/resource-errors.filter.js';
import { validateDto } from '../config/validation.js';
import { BoardsService } from './boards.service.js';
import { CreateBoardDto } from './dto/create-board.dto.js';
import { UpdateBoardDto } from './dto/update-board.dto.js';

@Controller()
@UseFilters(ResourceErrorsFilter)
export class BoardsController {
  constructor(@Inject(BoardsService) private readonly boards: BoardsService) {}
  @Get('workspaces/:workspaceId/boards')
  @Header('Cache-Control', 'no-store')
  list(
    @Param('workspaceId') workspaceId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.boards.list(workspaceId, request.auth.user.id);
  }
  @Post('workspaces/:workspaceId/boards')
  @Header('Cache-Control', 'no-store')
  create(
    @Param('workspaceId') workspaceId: string,
    @Req() request: AuthenticatedRequest,
    @Body(validateDto(CreateBoardDto)) input: CreateBoardDto,
  ) {
    return this.boards.create(workspaceId, request.auth.user.id, input.name);
  }
  @Get('boards/:id')
  @Header('Cache-Control', 'no-store')
  get(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.boards.get(id, request.auth.user.id);
  }
  @Patch('boards/:id')
  @Header('Cache-Control', 'no-store')
  update(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
    @Body(validateDto(UpdateBoardDto)) input: UpdateBoardDto,
  ) {
    return this.boards.update(id, request.auth.user.id, input.name);
  }
  @Delete('boards/:id')
  @Header('Cache-Control', 'no-store')
  @HttpCode(204)
  remove(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.boards.remove(id, request.auth.user.id);
  }
}
