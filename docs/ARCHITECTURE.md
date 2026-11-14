# Phase 1 — Architecture baseline

## Product boundary

Trueman Logistics is a Ghana-based courier and freight platform. The initial release is a modular monolith: one NestJS deployment, one PostgreSQL database, and bounded modules with explicit internal contracts. This avoids premature distributed-systems overhead while preserving extraction seams.

## Runtime topology

- `apps/web`: React + TypeScript + Vite customer web application.
- `apps/api`: NestJS REST API; `/api/v1` prefix; health endpoint included.
- PostgreSQL 16: authoritative transactional store.
- Redis 7: planned rate-limit counters, short-lived verification state, cache and job coordination.
- Nginx: production TLS termination/reverse proxy (configuration to be added in deployment phase).
- Object storage: private bucket for shipment documents; signed, short-lived download URLs only.

## Bounded contexts

1. Identity & Access — customers, staff, sessions, MFA, roles and permissions.
2. Customer & Contacts — verified contact channels and customer profile.
3. Quotation — versioned rate cards, dimensional/actual weight, surcharges and quote expiry.
4. Shipment Orchestration — shipment aggregate, package/address data, authorization and lifecycle transitions.
5. Tracking — opaque reference issuance, event timeline, facility scans and optional verified GPS telemetry.
6. Operations — staff assignment, warehouse and delivery workflows.
7. Billing — invoices, payment intents, signed provider webhooks and reconciliation.
8. Notifications — transactional email/SMS/WhatsApp delivery with retries and idempotency.
9. Documents — malware scanning, content sniffing, private object storage and access policy.
10. Audit & Security — append-only application events, security signals and integrity verification.

## Critical invariants

- A shipment is not finalized until a one-time challenge bound to the order session and purpose is verified.
- OTPs are random, short-lived, hashed at rest, attempt-limited, single-use and never logged.
- Tracking credentials are independently generated, high entropy and stored as keyed digests. They are identifiers, not bearer authorization for sensitive operations.
- Customer access is scoped through authenticated ownership checks; public tracking reveals only a deliberately minimized view.
- Shipment status changes go through a transition policy in the domain layer, never direct mass assignment.
- Prices, payment states, ownership, roles and event actors are server-authoritative.
- Payment webhooks are signature-verified and idempotent.
- Audit events are hash chained and periodically anchored outside the application trust boundary in production.

## Data model notes

`schema.prisma` defines the initial relational shape. Production migrations must be reviewed, tested and applied through CI/CD. Before real deployment, add tenant boundaries only if Trueman will host multiple independent logistics operators; do not add tenant complexity without an actual tenancy requirement. Use country codes, currency codes and explicit units. Financial values use Decimal, never floating point.

## API conventions

- Versioned REST: `/api/v1/<resource>`.
- DTO validation at the boundary; reject unknown properties.
- Consistent error envelope with correlation ID; never expose stack traces.
- Cursor pagination for event/history collections.
- Idempotency keys for shipment finalization and payment operations.
- OpenAPI contract generated from NestJS DTOs once API modules are implemented.

## Production evolution

Keep modules independent through domain services, repository interfaces and events. Extract notification delivery, document processing or tracking ingestion only when throughput, team ownership or isolation needs justify it. Use an outbox pattern for reliable asynchronous side effects before introducing a broker.
