# Phase 5 — Shipment Operations Centre

## Implemented in this phase package

- Protected staff route at `/admin`; it is served by the existing website application.
- Staff sign-in using the existing session cookie and mandatory MFA enrollment for privileged accounts.
- Operations summary: total, pending review, active, in-transit, delivered in the last 30 days, overdue and submitted today.
- Central shipment register with search, review-state, shipment-state and submission-source filters.
- Shipment details with customer, destination, cargo, quote, event history and submitter attribution.
- Review actions: approve, reject and request correction.
- Staff assignment using active staff profiles.
- Append-only operational tracking event endpoint with an explicit status-transition allowlist.
- Staff activity feed based on shipment-related audit events attributed to staff accounts.
- Redis-backed per-user throttles on review, assignment and tracking mutations.
- Phase 4 quotation acceptance now records `createdByUserId`, `submitterRole`, `creationSource` and `submittedAt` from authenticated server-side identity.
- Review, assignment and tracking changes write their audit record in the same database transaction as the operational change.

## API routes

All routes are under `/api/v1` and require an authenticated session plus the `shipments:manage` permission:

- `GET /admin/operations/summary`
- `GET /admin/operations/shipments`
- `GET /admin/operations/shipments/:id`
- `POST /admin/operations/shipments/:id/review`
- `POST /admin/operations/shipments/:id/assign`
- `POST /admin/operations/shipments/:id/events`
- `GET /admin/operations/staff`
- `GET /admin/operations/activity`

The list endpoint supports `page`, `pageSize` (maximum 100), `search`, `status`, `reviewStatus` and `creationSource`.

## Data and attribution rules

- `createdByUserId` is derived from the authenticated session by the API.
- `submitterRole` stores the role name at submission time; it is a historical snapshot and must not be recomputed from current role assignments.
- `creationSource` distinguishes `CUSTOMER`, `STAFF` and `SYSTEM`.
- `submittedAt` is assigned by the server.
- Legacy shipments are migrated with `creationSource=CUSTOMER` and a migration-time `submittedAt`. Their original submitter cannot be reconstructed; `createdByUserId` and `submitterRole` remain null.
- Shipment events are append-only through the Phase 5 API. No update or delete route is exposed.
- Shipment review state is separate from physical shipment status.
- Approving a newly received shipment moves it to `ORDER_CONFIRMED` and records an event.
- Rejecting a shipment or requesting correction requires a staff review note.
- Operational status updates are accepted only through the transition allowlist in `operations.service.ts`.

## Security boundaries

- The admin route is not a security boundary by itself. Every API route independently checks the session and `shipments:manage` permission.
- Customer access is not granted by knowing a shipment ID; operations endpoints are staff-permission protected.
- Mutation throttles are enforced in Redis per authenticated user.
- Request bodies use the existing global validation pipe (`whitelist` and `forbidNonWhitelisted`).
- Audit writes for review, assignment and event append are transactionally coupled to the corresponding database mutation.
- The dashboard uses React text rendering and does not inject server-provided HTML.

## Not represented as complete

This package does not claim that DNS, registrar security, production TLS, edge DDoS protection, WAF policy, production secrets management, external penetration testing, or disaster recovery have been completed. Those remain part of Phase 8 and the production deployment review.
