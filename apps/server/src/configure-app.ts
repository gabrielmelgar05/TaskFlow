import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export function configureApp(app: INestApplication) {
  const config = app.get(ConfigService);
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: config.getOrThrow<string[]>('CORS_ORIGIN'),
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: true,
    exposedHeaders: ['Retry-After'],
  });
}
