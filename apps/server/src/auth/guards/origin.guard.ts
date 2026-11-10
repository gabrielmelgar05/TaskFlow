import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
@Injectable()
export class OriginGuard implements CanActivate {
  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return true;
    const origin = request.get('origin');
    if (
      !origin ||
      !this.config.getOrThrow<string[]>('CORS_ORIGIN').includes(origin)
    ) {
      throw new ForbiddenException('Origem da solicitação não permitida.');
    }
    return true;
  }
}
