import { IsInt, IsString, Length, Max, Min } from 'class-validator';
export class MoveTaskDto {
  @IsString({ message: 'Escolha uma coluna de destino.' })
  @Length(1, 64, { message: 'Escolha uma coluna válida.' })
  columnId!: string;

  @IsInt({ message: 'A posição deve ser um número inteiro.' })
  @Min(0, { message: 'A posição não pode ser negativa.' })
  @Max(1000000, { message: 'A posição está fora do limite.' })
  position!: number;
}
