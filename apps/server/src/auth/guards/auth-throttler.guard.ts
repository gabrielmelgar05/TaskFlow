import { type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerGuard, type ThrottlerLimitDetail } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { isIP } from 'node:net';
@Injectable()
export class AuthThrottlerGuard extends ThrottlerGuard {
  @Inject(ConfigService) private readonly config!: ConfigService;

  protected override getTracker(request: Request) {
    const clientIp = request.get('x-taskflow-client-ip');
    // AuthGuard já verificou o segredo. Não confiamos em X-Forwarded-For arbitrário.
    const trusted =
      this.config.get<string>('API_PROXY_SECRET') && clientIp && isIP(clientIp)
        ? clientIp
        : request.ip;
    return super.getTracker({ ip: trusted ?? request.socket.remoteAddress });
  }
  protected override generateKey(
    context: ExecutionContext,
    suffix: string,
    name: string,
  ) {
    if (name === 'account') {
      const request = context
        .switchToHttp()
        .getRequest<Request<unknown, unknown, Record<string, unknown>>>();
      const email = request.body?.email;
      suffix =
        typeof email === 'string'
          ? email.trim().toLowerCase().slice(0, 254)
          : 'invalid-email';
    }
    // O Throttler calcula SHA-256: nenhum e-mail é armazenado em texto na chave.
    return super.generateKey(context, suffix, name);
  }
  protected override async throwThrottlingException(
    context: ExecutionContext,
    detail: ThrottlerLimitDetail,
  ): Promise<void> {
    context
      .switchToHttp()
      .getResponse<Response>()
      .setHeader('Retry-After', detail.timeToBlockExpire);
    await super.throwThrottlingException(context, detail);
  }
}
