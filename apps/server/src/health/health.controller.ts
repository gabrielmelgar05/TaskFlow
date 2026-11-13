import { Controller, Get, Header, Inject } from '@nestjs/common';
import { HealthService } from './health.service.js';
import { Public } from '../auth/public.decorator.js';

@Controller('health')
export class HealthController {
  constructor(@Inject(HealthService) private readonly health: HealthService) {}

  @Get()
  @Public({ allowDirect: true })
  @Header('Cache-Control', 'no-store')
  check() {
    return this.health.check();
  }
}
