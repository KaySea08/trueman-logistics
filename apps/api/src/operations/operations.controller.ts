import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Header,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { SessionGuard } from '../auth/session.guard';
import { OperationsService } from './operations.service';
import {
  AssignmentListQueryDto,
  AssignShipmentDto,
  ReviewShipmentDto,
  ShipmentEventDto,
  ShipmentListQueryDto,
} from './operations.dto';

@Controller('admin/operations')
@UseGuards(SessionGuard)
export class OperationsController {
  constructor(private readonly operations: OperationsService) {}

  private requirePermission(req: Request, permission: string) {
    const granted: string[] = (req as any).auth?.permissions ?? [];
    if (!granted.includes(permission)) {
      throw new ForbiddenException('You do not have permission to access this operations resource.');
    }
  }

  @Get('summary')
  @Header('Cache-Control', 'no-store, private')
  summary(@Req() req: Request) {
    this.requirePermission(req, 'shipments:manage');
    return this.operations.summary();
  }

  @Get('shipments')
  @Header('Cache-Control', 'no-store, private')
  shipments(@Req() req: Request, @Query() query: ShipmentListQueryDto) {
    this.requirePermission(req, 'shipments:manage');
    return this.operations.listShipments(query);
  }

  @Get('shipments/:id')
  @Header('Cache-Control', 'no-store, private')
  shipment(@Req() req: Request, @Param('id') id: string) {
    this.requirePermission(req, 'shipments:manage');
    return this.operations.getShipment(id);
  }

  @Post('shipments/:id/review')
  review(@Req() req: Request, @Param('id') id: string, @Body() dto: ReviewShipmentDto) {
    this.requirePermission(req, 'shipments:manage');
    return this.operations.reviewShipment(id, (req as any).auth.user.id, dto);
  }

  @Post('shipments/:id/assign')
  assign(@Req() req: Request, @Param('id') id: string, @Body() dto: AssignShipmentDto) {
    this.requirePermission(req, 'shipments:manage');
    return this.operations.assignShipment(id, (req as any).auth.user.id, dto);
  }

  @Post('shipments/:id/events')
  appendEvent(@Req() req: Request, @Param('id') id: string, @Body() dto: ShipmentEventDto) {
    this.requirePermission(req, 'shipments:manage');
    return this.operations.appendEvent(id, (req as any).auth.user.id, dto);
  }

  @Get('staff')
  @Header('Cache-Control', 'no-store, private')
  staff(@Req() req: Request) {
    this.requirePermission(req, 'shipments:manage');
    return this.operations.staffList();
  }

  @Get('activity')
  @Header('Cache-Control', 'no-store, private')
  activity(@Req() req: Request) {
    this.requirePermission(req, 'shipments:manage');
    return this.operations.activity();
  }

  @Get('assignments')
  @Header('Cache-Control', 'no-store, private')
  assignments(@Req() req: Request, @Query() query: AssignmentListQueryDto) {
    this.requirePermission(req, 'shipments:manage');
    return this.operations.listAssignments(query);
  }

  @Get('assignments/workload')
  @Header('Cache-Control', 'no-store, private')
  assignmentWorkload(@Req() req: Request) {
    this.requirePermission(req, 'shipments:manage');
    return this.operations.assignmentWorkload();
  }
}
