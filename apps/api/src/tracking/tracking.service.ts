import { Injectable, NotFoundException } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TrackingService {
  constructor(private readonly prisma: PrismaService) {}

  private tokenDigest(rawReference: string) {
    const pepper = process.env.AUTH_PEPPER;
    if (!pepper || pepper.length < 32) {
      throw new Error('AUTH_PEPPER must be configured with at least 32 characters');
    }
    return createHmac('sha256', pepper).update(rawReference.trim().toUpperCase()).digest('hex');
  }

  async lookup(reference: string) {
    const digest = this.tokenDigest(reference);

    const trackingRecord = await this.prisma.trackingReference.findUnique({
      where: { tokenDigest: digest },
      include: {
        shipment: {
          select: {
            id: true,
            shipmentNumber: true,
            status: true,
            mode: true,
            createdAt: true,
            updatedAt: true,
            estimatedDelivery: true,
            addresses: {
              select: {
                kind: true,
                city: true,
                countryCode: true,
              },
            },
            events: {
              orderBy: { occurredAt: 'desc' },
              take: 10,
              select: {
                status: true,
                locationLabel: true,
                notes: true,
                source: true,
                occurredAt: true,
              },
            },
          },
        },
      },
    });

    if (!trackingRecord) {
      throw new NotFoundException('No shipment matches that tracking reference.');
    }

    const origin = trackingRecord.shipment.addresses.find((address) => address.kind === 'ORIGIN');
    const destination = trackingRecord.shipment.addresses.find((address) => address.kind === 'DESTINATION');

    return {
      shipmentNumber: trackingRecord.shipment.shipmentNumber,
      status: trackingRecord.shipment.status,
      mode: trackingRecord.shipment.mode,
      createdAt: trackingRecord.shipment.createdAt.toISOString(),
      updatedAt: trackingRecord.shipment.updatedAt.toISOString(),
      estimatedDelivery: trackingRecord.shipment.estimatedDelivery?.toISOString() ?? null,
      origin: origin
        ? { city: origin.city, countryCode: origin.countryCode }
        : null,
      destination: destination
        ? { city: destination.city, countryCode: destination.countryCode }
        : null,
      recentEvents: trackingRecord.shipment.events.map((event) => ({
        status: event.status,
        locationLabel: event.locationLabel,
        notes: event.notes,
        source: event.source,
        occurredAt: event.occurredAt.toISOString(),
      })),
    };
  }
}
