import { ArgumentsHost, Catch, type ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { Prisma } from '../generated/prisma/client.js';

// Aplicado somente aos novos controllers; erros HTTP dos services são preservados.
@Catch(
  Prisma.PrismaClientKnownRequestError,
  Prisma.PrismaClientUnknownRequestError,
  Prisma.PrismaClientInitializationError,
  Prisma.PrismaClientRustPanicError,
)
export class ResourceErrorsFilter implements ExceptionFilter {
  catch(error: Error, host: ArgumentsHost) {
    const missing =
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025';
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(missing ? 404 : 503)
      .json({
        statusCode: missing ? 404 : 503,
        message: missing
          ? 'Recurso não encontrado.'
          : 'Não foi possível acessar o serviço. Tente novamente em instantes.',
      });
  }
}
