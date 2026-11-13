import { Transform } from 'class-transformer';
import { IsString, Length, Matches } from 'class-validator';
import { TaskFieldsDto, trimText } from './task-fields.dto.js';

export class CreateTaskDto extends TaskFieldsDto {
  @Transform(trimText)
  @IsString({ message: 'Informe um título.' })
  @Length(1, 200, { message: 'Use um título de 1 a 200 caracteres.' })
  @Matches(/^\P{Cc}+$/u, { message: 'Use um título em uma única linha.' })
  title!: string;

  @IsString({ message: 'Escolha a coluna da tarefa.' })
  @Length(1, 64, { message: 'Escolha uma coluna válida.' })
  columnId!: string;
}
