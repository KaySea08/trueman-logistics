import { Controller, Get } from '@nestjs/common';
@Controller('health')
export class HealthController {
  @Get() check() { return { status: 'ok', service: 'trueman-api', phase: 6, timestamp: new Date().toISOString() }; }
}
