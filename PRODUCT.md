# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Customers arranging international freight from China. Staff and administrators use separate protected operations tools.

## Product Purpose

Trueman Logistics helps customers request and review shipping quotations and follow shipments originating in China. Success means customers can understand their available next steps and access their own shipment information securely.

## Positioning

A China-origin logistics service with customer-facing quotation and shipment visibility workflows.

## Operating Context

Customers provide shipment, sender, and recipient details when requesting a quotation. They review the resulting price and validity period, may accept an eligible quotation to create a shipment, and use the issued tracking reference to follow shipment events. Staff manage operations through permission-protected workflows.

## Capabilities and Constraints

- Web portal built with React, TypeScript, and Vite; backend built with NestJS and Prisma.
- Customer authentication uses backend-managed HttpOnly session cookies; browser token storage is not used.
- Customer data must be scoped to the authenticated account.
- Raw shipment tracking references are revealed once when issued and are not stored for later display.
- Current quotation modes include air, sea, and express. Availability and prices depend on configured rate rules.
- Quote, shipment, and destination availability are determined by backend data; do not invent customer records, prices, or service coverage.

## Brand Commitments

The product is Trueman Logistics, centered on China-origin international shipping. Existing public copy uses the line “Global Shipping. Reliable Delivery.”

## Evidence on Hand

- Customer-facing site and service content: `apps/web/src/App.tsx` and `apps/web/src/data/services.ts`.
- Quotation and shipment data model: `apps/api/prisma/schema.prisma`.
- Customer quotation workflow: `apps/api/src/quotes/quotes.service.ts`.
- Public tracking lookup: `apps/api/src/tracking/`.
- No verified testimonials, customer benchmarks, or published service-coverage data are present in the repository.

## Product Principles

- Keep China-origin shipment workflows clear from request through delivery.
- Show customers only information belonging to their account.
- Make shipment status and quote validity easy to understand.
- Keep rates, route availability, and operational status grounded in backend data.
