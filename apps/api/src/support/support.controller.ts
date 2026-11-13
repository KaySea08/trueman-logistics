import { Body, Controller, Headers, HttpException, HttpStatus, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { createHash } from 'node:crypto';
import Redis from 'ioredis';
import { Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS } from '../redis/redis.module';
import { CreateSupportInquiryDto } from './support.dto';
import { AuditService } from '../common/audit.service';
@Controller('support')
export class SupportController {
  constructor(private readonly prisma: PrismaService, @Inject(REDIS) private readonly redis: Redis, private readonly audit: AuditService) {}
  @Post('inquiries') async create(@Body() dto: CreateSupportInquiryDto, @Req() req: Request, @Headers('x-request-id') requestId?: string) {
    const ipDigest = createHash('sha256').update(req.ip ?? 'unknown').digest('hex');
    const key = `support-inquiry:${ipDigest}`; const count = await this.redis.incr(key); if (count === 1) await this.redis.expire(key, 3600); if (count > 5) throw new HttpException('Too many inquiries. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);
    const inquiry = await this.prisma.supportInquiry.create({ data: { fullName: dto.fullName.trim(), email: dto.email.trim().toLowerCase(), phone: dto.phone?.trim(), serviceName: dto.serviceName.trim(), message: dto.message.trim() }, select: { id: true, status: true, createdAt: true } });
    await this.audit.record({ action: 'SUPPORT_INQUIRY_CREATED', targetType: 'SupportInquiry', targetId: inquiry.id, outcome: 'SUCCESS', metadata: { serviceName: dto.serviceName, requestId: requestId ?? null } });
    return { message: 'Your inquiry has been received. Our customer service team will follow up using the contact details you provided.', reference: inquiry.id };
  }
}
