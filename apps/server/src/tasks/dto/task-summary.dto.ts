import { IsDateString, Matches } from 'class-validator';
import { dateOnlyPattern } from './task-fields.dto.js';
export class TaskSummaryDto {
  @Matches(dateOnlyPattern, {
    message: 'Informe a data atual no formato AAAA-MM-DD.',
  })
  @IsDateString({ strict: true }, { message: 'Informe uma data atual válida.' })
  today!: string;
}
