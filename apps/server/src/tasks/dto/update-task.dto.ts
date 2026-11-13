import { Transform } from 'class-transformer';
import { IsString, Length, Matches, ValidateIf } from 'class-validator';
import { TaskFieldsDto, trimText } from './task-fields.dto.js';

export class UpdateTaskDto extends TaskFieldsDto {
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(trimText)
  @IsString({ message: 'Informe um título.' })
  @Length(1, 200, { message: 'Use um título de 1 a 200 caracteres.' })
  @Matches(/^\P{Cc}+$/u, { message: 'Use um título em uma única linha.' })
  title?: string;
}
