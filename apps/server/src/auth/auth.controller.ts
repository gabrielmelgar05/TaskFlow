import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Inject,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { AuthService } from './auth.service.js';
import type { AuthenticatedRequest } from './auth.types.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { AuthThrottlerGuard } from './guards/auth-throttler.guard.js';
import { Public } from './public.decorator.js';
import { SESSION_COOKIE, sessionCookieOptions } from './session-cookie.js';
import { validateDto } from '../config/validation.js';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  private writeCookie(
    response: Response,
    session: { token: string; expiresAt: Date },
  ) {
    response.cookie(SESSION_COOKIE, session.token, {
      ...sessionCookieOptions(this.config.getOrThrow<boolean>('COOKIE_SECURE')),
      expires: session.expiresAt,
      maxAge: Math.max(0, session.expiresAt.getTime() - Date.now()),
    });
  }

  @Public()
  @Post('register')
  @Header('Cache-Control', 'no-store')
  @UseGuards(AuthThrottlerGuard)
  @Throttle({
    ip: { limit: 5, ttl: 60000 },
    account: { limit: 3, ttl: 900000 },
  })
  async register(
    @Body(validateDto(RegisterDto)) input: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const session = await this.auth.register(input);
    this.writeCookie(response, session);
    return { user: session.user };
  }

  @Public()
  @Post('login')
  @Header('Cache-Control', 'no-store')
  @HttpCode(200)
  @UseGuards(AuthThrottlerGuard)
  async login(
    @Body(validateDto(LoginDto)) input: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const session = await this.auth.login(input);
    this.writeCookie(response, session);
    return { user: session.user };
  }

  @Get('me')
  @Header('Cache-Control', 'no-store')
  me(@Req() request: AuthenticatedRequest) {
    return { user: request.auth.user };
  }

  @Post('logout')
  @Header('Cache-Control', 'no-store')
  @HttpCode(204)
  async logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.auth.logout(request.auth.sessionId);
    response.clearCookie(
      SESSION_COOKIE,
      sessionCookieOptions(this.config.getOrThrow<boolean>('COOKIE_SECURE')),
    );
  }
}
