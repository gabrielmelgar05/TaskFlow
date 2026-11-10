import { BadRequestException, type Type, ValidationPipe } from '@nestjs/common';

export function validateDto(dto: Type<unknown>) {
  return new ValidationPipe({
    expectedType: dto,
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
    validationError: { target: false, value: false },
    exceptionFactory: (errors) =>
      new BadRequestException({
        message: 'Confira os campos informados.',
        errors: Object.fromEntries(
          errors.map((error) => [
            error.property,
            Object.values(error.constraints ?? {})[0] ?? 'Valor inválido.',
          ]),
        ),
      }),
  });
}
