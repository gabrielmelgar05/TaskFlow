import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { timingSafeEqual } from 'node:crypto';
import { parse } from 'cookie';
import { AuthService } from '../auth.service.js';
import type { AuthenticatedRequest } from '../auth.types.js';
import { PUBLIC_ROUTE, type PublicOptions } from '../public.decorator.js';
import { SESSION_COOKIE } from '../session-cookie.js';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const publicRoute = this.reflector.getAllAndOverride<
      PublicOptions | undefined
    >(PUBLIC_ROUTE, [context.getHandler(), context.getClass()]);
    const secret = this.config.get<string>('API_PROXY_SECRET');
    if (secret && !publicRoute?.allowDirect) {
      const supplied = request.get('x-taskflow-proxy-secret') ?? '';
      if (
        Buffer.byteLength(supplied) !== Buffer.byteLength(secret) ||
        !timingSafeEqual(Buffer.from(supplied), Buffer.from(secret))
      ) {
        throw new ForbiddenException(
          'Acesse o serviço pelo endereço do TaskFlow.',
        );
      }
    }
    if (publicRoute) return true;
    const token = parse(request.headers.cookie ?? '')[SESSION_COOKIE];
    request.auth = await this.auth.authenticate(token);
    return true;
  }
}
