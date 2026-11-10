import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(@Inject(ConfigService) config: ConfigService) {
    const adapter = new PrismaPg({
      connectionString: config.getOrThrow<string>('DATABASE_URL'),
      connectionTimeoutMillis: 3000,
      query_timeout: 3000,
      statement_timeout: 3000,
      max: 10,
    });
    super({ adapter });
  }

  // A conexão é aberta na primeira consulta. Assim, /health pode responder 503
  // mesmo quando o banco estiver indisponível durante a inicialização.
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
