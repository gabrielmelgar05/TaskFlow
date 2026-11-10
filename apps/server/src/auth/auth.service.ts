import {
  ConflictException,
  HttpException,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { publicUserSelect } from './auth.types.js';
import type { LoginDto } from './dto/login.dto.js';
import type { RegisterDto } from './dto/register.dto.js';
import { PasswordService } from './password.service.js';

export function hashSessionToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PasswordService) private readonly passwords: PasswordService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  private newSession() {
    const token = randomBytes(32).toString('base64url');
    const days = this.config.getOrThrow<number>('SESSION_TTL_DAYS');
    return {
      token,
      tokenHash: hashSessionToken(token),
      expiresAt: new Date(Date.now() + days * 86400000),
    };
  }

  private databaseError(error: unknown): never {
    if (error instanceof HttpException) throw error;
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException({
        message: 'Já existe uma conta com este e-mail.',
        errors: { email: 'Este e-mail já está cadastrado.' },
      });
    }
    throw new ServiceUnavailableException(
      'Não foi possível acessar o serviço. Tente novamente em instantes.',
    );
  }

  async register(input: RegisterDto) {
    try {
      const passwordHash = await this.passwords.hash(input.password);
      const session = this.newSession();
      // A criação aninhada é atômica: usuário e sessão são salvos juntos.
      // O índice único do banco resolve também cadastros concorrentes.
      const user = await this.prisma.user.create({
        data: {
          name: input.name,
          email: input.email,
          passwordHash,
          sessions: {
            create: {
              tokenHash: session.tokenHash,
              expiresAt: session.expiresAt,
            },
          },
        },
        select: publicUserSelect,
      });
      return { user, token: session.token, expiresAt: session.expiresAt };
    } catch (error) {
      this.databaseError(error);
    }
  }

  async login(input: LoginDto) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email: input.email },
        select: { ...publicUserSelect, passwordHash: true },
      });
      const valid = await this.passwords.verify(
        input.password,
        user?.passwordHash,
      );
      if (!user || !valid)
        throw new UnauthorizedException('E-mail ou senha incorretos.');
      const session = this.newSession();
      await this.prisma.session.create({
        data: {
          userId: user.id,
          tokenHash: session.tokenHash,
          expiresAt: session.expiresAt,
        },
      });
      return {
        user: { id: user.id, name: user.name, email: user.email },
        token: session.token,
        expiresAt: session.expiresAt,
      };
    } catch (error) {
      this.databaseError(error);
    }
  }

  async authenticate(token: string | undefined) {
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token))
      throw new UnauthorizedException('Entre na sua conta para continuar.');
    try {
      const session = await this.prisma.session.findUnique({
        where: { tokenHash: hashSessionToken(token) },
        select: {
          id: true,
          expiresAt: true,
          user: { select: publicUserSelect },
        },
      });
      if (!session || session.expiresAt.getTime() <= Date.now())
        throw new UnauthorizedException('Sua sessão expirou. Entre novamente.');
      return { user: session.user, sessionId: session.id };
    } catch (error) {
      this.databaseError(error);
    }
  }

  async logout(sessionId: string) {
    try {
      // Invalida imediatamente sem remover outros registros ou sessões do usuário.
      await this.prisma.session.update({
        where: { id: sessionId },
        data: { expiresAt: new Date() },
      });
    } catch (error) {
      this.databaseError(error);
    }
  }
}
