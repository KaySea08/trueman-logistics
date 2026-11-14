import { BadRequestException, Controller, Get, Param } from '@nestjs/common';
import { TrackingService } from './tracking.service';

@Controller('tracking')
export class TrackingController {
  constructor(private readonly tracking: TrackingService) {}

  @Get(':reference')
  async lookup(@Param('reference') reference: string) {
    const cleaned = reference?.trim();
    if (!cleaned) {
      throw new BadRequestException('Tracking reference is required.');
    }
    return this.tracking.lookup(cleaned);
  }
}
