import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export const priorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;
export function trimText({ value }: { value: unknown }) {
  return typeof value === 'string' ? value.trim() : value;
}

export class TaskFieldsDto {
  @IsOptional()
  @Transform(trimText)
  @IsString({ message: 'Informe uma descrição em texto.' })
  @MaxLength(5000, { message: 'A descrição deve ter até 5000 caracteres.' })
  @Matches(/^[\P{Cc}\t\r\n]*$/u, {
    message: 'Remova os caracteres de controle da descrição.',
  })
  description?: string | null;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsIn(priorities, { message: 'Escolha uma prioridade válida.' })
  priority?: (typeof priorities)[number];

  @IsOptional()
  @IsString({ message: 'Escolha um responsável válido.' })
  @Length(1, 64, { message: 'Escolha um responsável válido.' })
  assigneeId?: string | null;

  // A API recebe uma data civil, sem hora ou conversão do fuso do navegador.
  @IsOptional()
  @Matches(dateOnlyPattern, {
    message: 'Informe o prazo no formato AAAA-MM-DD.',
  })
  @IsDateString(
    { strict: true },
    { message: 'Informe uma data de prazo válida.' },
  )
  dueAt?: string | null;
}
