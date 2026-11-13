import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
export class LoginDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  @MaxLength(254, { message: 'O e-mail deve ter até 254 caracteres.' })
  email!: string;

  @IsString({ message: 'Informe sua senha.' })
  @IsNotEmpty({ message: 'Informe sua senha.' })
  @MaxLength(128, { message: 'A senha deve ter até 128 caracteres.' })
  password!: string;
}
