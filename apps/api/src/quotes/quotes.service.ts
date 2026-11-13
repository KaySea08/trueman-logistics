import { BadRequestException, ConflictException, ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { createHmac, randomBytes, createHash } from 'node:crypto';
import { Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS } from '../redis/redis.module';
import { Prisma, QuoteStatus, RateBasis, ShipmentMode } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { CreateQuoteDto, CreateRateRuleDto } from './quotes.dto';

const money = (n: number) => new Prisma.Decimal(n.toFixed(2));
const tokenDigest = (raw: string) => { const key = process.env.AUTH_PEPPER; if (!key || key.length < 32) throw new Error('AUTH_PEPPER is not configured.'); return createHmac('sha256', key).update(raw).digest('hex'); };
const quoteNumber = () => `TRQ-${new Date().getUTCFullYear()}-${randomBytes(5).toString('hex').toUpperCase()}`;
const shipmentNumber = () => `TRM-${new Date().getUTCFullYear()}-${randomBytes(6).toString('hex').toUpperCase()}`;

@Injectable()
export class QuotesService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, @Inject(REDIS) private readonly redis: Redis) {}

  private async throttle(userId: string, action: string, limit: number, seconds: number) {
    const key = `rl:quotes:${action}:${createHash('sha256').update(userId).digest('hex')}`;
    const count = await this.redis.incr(key);
    if (count === 1) await this.redis.expire(key, seconds);
    if (count > limit) throw new HttpException('Too many quotation requests. Please wait and try again.', HttpStatus.TOO_MANY_REQUESTS);
  }

  private async customerId(userId: string) {
    const customer = await this.prisma.customer.findUnique({ where: { userId }, select: { id: true } });
    if (!customer) throw new ForbiddenException('A customer account is required to request a shipment quote.');
    return customer.id;
  }

  async create(userId: string, dto: CreateQuoteDto) {
    await this.throttle(userId, 'create', 10, 3600);
    const customerId = await this.customerId(userId);
    const now = new Date();
    const candidateRules = await this.prisma.rateRule.findMany({ where: { mode: dto.mode, active: true, validFrom: { lte: now }, OR: [{ validUntil: null }, { validUntil: { gt: now } }], AND: [{ OR: [{ destinationCountryCode: dto.destinationCountryCode }, { destinationCountryCode: null }] }] }, orderBy: { createdAt: 'desc' } });
    const rule = candidateRules.find(item => item.destinationCountryCode === dto.destinationCountryCode) ?? candidateRules.find(item => item.destinationCountryCode === null);
    if (!rule) throw new BadRequestException('A current rate is not configured for this shipping method and destination. Please contact Trueman Logistics for a manual quotation.');
    const actualWeight = dto.packages.reduce((sum, p) => sum + p.weightKg * p.quantity, 0);
    const volumeM3 = dto.packages.reduce((sum, p) => sum + (p.lengthCm * p.widthCm * p.heightCm * p.quantity) / 1_000_000, 0);
    const divisor = Number(rule.volumetricDivisor);
    const volumetricWeight = (volumeM3 * 1_000_000) / divisor;
    const chargeableWeight = Math.max(actualWeight, volumetricWeight);
    const billable = rule.basis === RateBasis.CBM ? volumeM3 : rule.basis === RateBasis.ACTUAL_KG ? actualWeight : chargeableWeight;
    const rawSubtotal = Math.max(Number(rule.minimumCharge), billable * Number(rule.ratePerUnit));
    const subtotal = money(rawSubtotal); const handlingFee = money(Number(rule.handlingFee)); const totalAmount = subtotal.add(handlingFee);
    const validUntil = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const requestSnapshot = { originCountryCode: 'CN', chinaCollectionAddress: dto.chinaCollectionAddress.trim(), senderName: dto.senderName.trim(), senderPhone: dto.senderPhone, recipientName: dto.recipientName.trim(), recipientPhone: dto.recipientPhone, destinationCountryCode: dto.destinationCountryCode, destinationCity: dto.destinationCity.trim(), destinationAddressLine: dto.destinationAddressLine.trim(), handlingInstructions: dto.handlingInstructions?.trim() ?? null, packages: dto.packages.map(p => ({ description: p.description.trim(), quantity: p.quantity, weightKg: p.weightKg, lengthCm: p.lengthCm, widthCm: p.widthCm, heightCm: p.heightCm })) };
    const pricingSnapshot = { rateRuleId: rule.id, rateRuleName: rule.name, mode: dto.mode, basis: rule.basis, ratePerUnit: Number(rule.ratePerUnit), minimumCharge: Number(rule.minimumCharge), handlingFee: Number(rule.handlingFee), actualWeightKg: Number(actualWeight.toFixed(3)), volumetricWeightKg: Number(volumetricWeight.toFixed(3)), chargeableWeightKg: Number(chargeableWeight.toFixed(3)), volumeCbm: Number(volumeM3.toFixed(4)), billableUnits: Number(billable.toFixed(4)), currency: rule.currency };
    const quote = await this.prisma.quote.create({ data: { quoteNumber: quoteNumber(), customerId, rateRuleId: rule.id, mode: dto.mode, destinationCountryCode: dto.destinationCountryCode, destinationCity: dto.destinationCity.trim(), currency: rule.currency, subtotal, handlingFee, totalAmount, chargeableWeightKg: money(chargeableWeight), volumeCbm: new Prisma.Decimal(volumeM3.toFixed(4)), validUntil, requestSnapshot, pricingSnapshot } });
    await this.audit.record({ actorUserId: userId, action: 'QUOTE_CREATED', targetType: 'Quote', targetId: quote.id, outcome: 'SUCCESS', metadata: { quoteNumber: quote.quoteNumber, mode: quote.mode, destinationCountryCode: quote.destinationCountryCode, totalAmount: quote.totalAmount.toString(), currency: quote.currency } });
    return quote;
  }

  async listMine(userId: string) { const customerId = await this.customerId(userId); await this.prisma.quote.updateMany({ where: { customerId, status: QuoteStatus.QUOTED, validUntil: { lte: new Date() } }, data: { status: QuoteStatus.EXPIRED } }); return this.prisma.quote.findMany({ where: { customerId }, orderBy: { createdAt: 'desc' }, include: { shipment: { select: { shipmentNumber: true, status: true } } } }); }

  async accept(userId: string, quoteId: string) {
    await this.throttle(userId, 'accept', 10, 3600);
    const customerId = await this.customerId(userId);
    const rawTracking = `TRK-${randomBytes(24).toString('base64url').toUpperCase()}`;
    let result: any;
    try {
      result = await this.prisma.$transaction(async tx => {
        const quote = await tx.quote.findFirst({ where: { id: quoteId, customerId }, include: { shipment: true } });
        if (!quote) throw new NotFoundException('Quotation not found.');
        if (quote.status === QuoteStatus.ACCEPTED && quote.shipment) return { alreadyAccepted: true, shipment: quote.shipment, trackingReference: null };
        if (quote.status !== QuoteStatus.QUOTED) throw new ConflictException('This quotation is no longer available for acceptance.');
        if (quote.validUntil <= new Date()) throw new ConflictException('This quotation has expired. Request a new quotation.');
        const locked = await tx.quote.updateMany({ where: { id: quote.id, customerId, status: QuoteStatus.QUOTED, validUntil: { gt: new Date() } }, data: { status: QuoteStatus.ACCEPTED, acceptedAt: new Date() } });
        if (locked.count !== 1) throw new ConflictException('The quotation was updated by another request. Refresh and try again.');
        const snap = quote.requestSnapshot as any;
        const submitter = await tx.user.findUnique({
          where: { id: userId },
          select: { userRoles: { select: { role: { select: { name: true } } } } },
        });
        const roleNames = (submitter?.userRoles ?? []).map((assignment) => assignment.role.name).sort();
        if (!roleNames.length) throw new ForbiddenException('Your account does not have an assigned submission role.');
        const submitterRole = roleNames.find((role) => role !== 'CUSTOMER') ?? roleNames[0];
        const creationSource = submitterRole === 'CUSTOMER' ? 'CUSTOMER' : 'STAFF';
        const submittedAt = new Date();
        const shipment = await tx.shipment.create({ data: { shipmentNumber: shipmentNumber(), customerId, quoteId: quote.id, createdByUserId: userId, submitterRole, creationSource, submittedAt, mode: quote.mode, currency: quote.currency, quotedAmount: quote.totalAmount, status: 'ORDER_RECEIVED', packages: { create: snap.packages.map((p: any) => ({ description: p.description, quantity: p.quantity, weightKg: p.weightKg, lengthCm: p.lengthCm, widthCm: p.widthCm, heightCm: p.heightCm })) }, addresses: { create: [{ kind: 'ORIGIN', contactName: snap.senderName, contactPhone: snap.senderPhone, countryCode: 'CN', city: 'China', addressLine: snap.chinaCollectionAddress }, { kind: 'DESTINATION', contactName: snap.recipientName, contactPhone: snap.recipientPhone, countryCode: snap.destinationCountryCode, city: snap.destinationCity, addressLine: snap.destinationAddressLine }] }, trackingReference: { create: { tokenDigest: tokenDigest(rawTracking) } }, events: { create: { previousStatus: null, status: 'ORDER_RECEIVED', locationLabel: 'China · Order received', notes: 'Shipment created after quotation acceptance.', source: 'SYSTEM', actorUserId: userId } } } });
        await this.audit.recordInTransaction(tx, {
          actorUserId: userId,
          action: 'QUOTE_ACCEPTED_SHIPMENT_CREATED',
          targetType: 'Shipment',
          targetId: shipment.id,
          outcome: 'SUCCESS',
          metadata: { quoteId, shipmentNumber: shipment.shipmentNumber, submitterRole, creationSource },
        });
        return { alreadyAccepted: false, shipment, trackingReference: rawTracking };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error: any) { if (error?.code === 'P2002' || error?.code === 'P2034') throw new ConflictException('This request conflicts with another update. Refresh your quotations and try again.'); throw error; }
    return { shipment: result.shipment, trackingReference: result.trackingReference, message: result.alreadyAccepted ? 'This quotation was already accepted. The tracking reference is not reissued; use the reference saved when it was first created.' : 'Quotation accepted and shipment created. Save the tracking reference; it will not be displayed again.' };
  }

  async createRateRule(userId: string, dto: CreateRateRuleDto) {
    if (dto.mode === 'SEA' && dto.basis !== RateBasis.CBM) throw new BadRequestException('Sea freight rate rules must use CBM billing in this release.');
    if (dto.mode !== 'SEA' && dto.basis === RateBasis.CBM) throw new BadRequestException('CBM billing is reserved for sea freight.');
    if (dto.validUntil && new Date(dto.validUntil) <= new Date()) throw new BadRequestException('Rate rule expiry must be in the future.');
    const rule = await this.prisma.rateRule.create({ data: { name: dto.name.trim(), mode: dto.mode, basis: dto.basis, destinationCountryCode: dto.destinationCountryCode ?? null, currency: dto.currency, ratePerUnit: new Prisma.Decimal(dto.ratePerUnit.toFixed(4)), minimumCharge: money(dto.minimumCharge), handlingFee: money(dto.handlingFee), volumetricDivisor: new Prisma.Decimal(dto.volumetricDivisor ?? 6000), validUntil: dto.validUntil ? new Date(dto.validUntil) : null } });
    await this.audit.record({ actorUserId: userId, action: 'SHIPPING_RATE_RULE_CREATED', targetType: 'RateRule', targetId: rule.id, outcome: 'SUCCESS', metadata: { mode: rule.mode, basis: rule.basis, destinationCountryCode: rule.destinationCountryCode, currency: rule.currency } });
    return rule;
  }
  async listRateRules() { return this.prisma.rateRule.findMany({ orderBy: [{ active: 'desc' }, { mode: 'asc' }, { destinationCountryCode: 'asc' }, { createdAt: 'desc' }] }); }
}
