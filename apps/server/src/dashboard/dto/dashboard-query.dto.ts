import { IsString, Length } from 'class-validator';
import { TaskSummaryDto } from '../../tasks/dto/task-summary.dto.js';

export class DashboardQueryDto extends TaskSummaryDto {
  @IsString({ message: 'Selecione um workspace.' })
  @Length(1, 64, { message: 'Selecione um workspace válido.' })
  workspaceId!: string;
}
