import { Transform } from 'class-transformer';
import { IsString, Length, Matches } from 'class-validator';

// Compartilhado pelos quatro DTOs: nomes legíveis, sem controles ou marcação.
export class ResourceNameDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().replace(/ {2,}/g, ' ') : value,
  )
  @IsString({ message: 'Informe um nome.' })
  @Length(1, 100, { message: 'Use um nome de 1 a 100 caracteres.' })
  @Matches(/^[-\p{L}\p{M}\p{N} .,'’!?&()+_:#@%/]+$/u, {
    message: 'Use letras, números, espaços e pontuação simples no nome.',
  })
  name!: string;
}
