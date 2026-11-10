import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { PasswordService } from './password.service.js';
import { AuthGuard } from './guards/auth.guard.js';
import { OriginGuard } from './guards/origin.guard.js';
import { AuthThrottlerGuard } from './guards/auth-throttler.guard.js';

@Module({
  imports: [
    PrismaModule,
    ThrottlerModule.forRoot({
      throttlers: [
        { name: 'ip', ttl: 60000, limit: 20 },
        { name: 'account', ttl: 900000, limit: 10 },
      ],
      errorMessage:
        'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    AuthThrottlerGuard,
    { provide: APP_GUARD, useClass: OriginGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AuthModule {}
