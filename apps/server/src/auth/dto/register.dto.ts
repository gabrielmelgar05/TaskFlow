import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
export class RegisterDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  @MaxLength(254, { message: 'O e-mail deve ter até 254 caracteres.' })
  email!: string;
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value,
  )
  @IsString({ message: 'Informe seu nome.' })
  @IsNotEmpty({ message: 'Informe seu nome.' })
  @MaxLength(100, { message: 'O nome deve ter até 100 caracteres.' })
  name!: string;

  @MinLength(15, {
    message: 'Use pelo menos 15 caracteres na senha. Uma frase funciona bem.',
  })
  @IsString({ message: 'Informe sua senha.' })
  @MaxLength(128, { message: 'A senha deve ter até 128 caracteres.' })
  password!: string;
}
