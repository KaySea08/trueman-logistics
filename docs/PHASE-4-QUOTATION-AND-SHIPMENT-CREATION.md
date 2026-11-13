# Phase 4 — Quotation and shipment creation

## Delivered scope

- Customer-authenticated shipment quote requests.
- Configurable shipping rate rules managed through permission-protected API routes.
- Air/express chargeable-weight calculations using actual versus volumetric weight.
- Sea-freight CBM calculation.
- Minimum freight charge and handling fee.
- Seven-day quote validity and immutable request/pricing snapshots.
- Customer-owned quote listing and acceptance.
- Transactional conversion of an accepted quote into a shipment, including package/address records, initial shipment event and opaque tracking-reference digest.
- One-time display of the raw tracking reference after successful acceptance.
- Redis per-account rate limits on quote creation and acceptance.
- Audit records for rate-rule creation, quote creation and shipment creation.
- Customer-facing quote request modal connected to the existing website's Get a quote / Start shipping actions.

## Pricing rules

No real-world shipping price, customs duty, tax, insurance or transit-time estimate is invented. An administrator must configure a current rate rule before a customer can receive an automated quote.

`RateBasis` options:

- `CHARGEABLE_KG`: max(actual kg, volumetric kg). Suitable for air and express.
- `ACTUAL_KG`: actual gross kg.
- `CBM`: cubic metres. Sea freight is restricted to this basis in this release.

Volumetric kg = total package volume in cm³ / the configured volumetric divisor (default 6000). Total package volume includes quantity. The rate calculation is `max(minimumCharge, billableUnits × ratePerUnit) + handlingFee`.

The customer form currently accepts one package profile repeated by quantity. For mixed package sizes, request a manual quotation until the multi-line package editor is implemented.

## API

All endpoints use `/api/v1` and the existing `trueman_session` HttpOnly cookie.

- `POST /quotes` — customer creates a quote.
- `GET /quotes/me` — list the authenticated customer's quotes.
- `POST /quotes/:id/accept` — accept own valid quote and create shipment.
- `POST /admin/rates` — create a rate rule; requires `rates:manage`.
- `GET /admin/rates` — list rate rules; requires `rates:manage`.

### Create a rate rule (administrator)

Example air freight rate rule, using illustrative values only. Replace the values with an approved Trueman rate schedule before use:

```json
{
  "name": "Illustrative China to Ghana air rate",
  "mode": "AIR",
  "basis": "CHARGEABLE_KG",
  "destinationCountryCode": "GH",
  "currency": "USD",
  "ratePerUnit": 8.75,
  "minimumCharge": 25,
  "handlingFee": 5,
  "volumetricDivisor": 6000
}
```

A rule without `destinationCountryCode` is a fallback for any destination where a destination-specific rule is not configured. Configure separate rules for `AIR`, `EXPRESS` and `SEA`. Sea freight uses `basis: "CBM"`.

### Customer quote request payload

```json
{
  "mode": "AIR",
  "destinationCountryCode": "GH",
  "destinationCity": "Accra",
  "destinationAddressLine": "Recipient delivery address",
  "recipientName": "Recipient name",
  "recipientPhone": "+233XXXXXXXXX",
  "senderName": "Sender name",
  "senderPhone": "+86XXXXXXXXXXX",
  "chinaCollectionAddress": "Collection address in China",
  "packages": [
    {
      "description": "General cargo",
      "quantity": 2,
      "weightKg": 5,
      "lengthCm": 40,
      "widthCm": 30,
      "heightCm": 25
    }
  ]
}
```

`weightKg` and dimensions are per package; quantity multiplies them in the server calculation.

## Windows / PowerShell rollout

1. Back up the database before applying schema changes.
2. Merge the Phase 4 project files into the existing project; preserve `.env`, local secrets and database volumes.
3. Confirm that the database already has the Phase 3 tables (`Customer`, `Shipment`, `ShipmentPackage`, `ShipmentAddress`, `TrackingReference`, `ShipmentEvent`, `AuditEvent`, etc.).
4. Check migration state first:

   ```powershell
   docker compose exec api npx prisma migrate status
   ```

5. The supplied migration is additive and assumes the Phase 3 base tables already exist. If your database has no recorded baseline migration, do not blindly run `migrate deploy` on an empty database. First establish/baseline the existing Phase 3 schema using a reviewed initial migration. The uploaded Phase 3 archive did not contain a complete baseline migration SQL file, so the migration history must be checked against your actual database before applying this change.
6. If the Phase 3 schema and migration history are consistent, apply:

   ```powershell
   docker compose exec api npx prisma migrate deploy
   docker compose exec api npx prisma generate
   docker compose exec api npm run db:seed
   ```

7. Rebuild the API and web containers after source/dependency/schema changes:

   ```powershell
   docker compose up -d --build api web
   docker compose logs -f api
   ```

8. Sign in with an administrator account that has the `rates:manage` permission. Add the real rate rules through `POST /api/v1/admin/rates` before testing automated quotes.
9. Sign in as a customer, select **Get a quote**, submit cargo details, review the quotation and accept it. Save the returned tracking reference; it is displayed only once.

Do not run `prisma migrate reset` or `docker compose down -v` on a database containing data.

## Important boundaries / follow-on work

- Phase 5 implements the customer tracking lookup and operations event-management workflow. The tracking reference is issued here, but the public tracking lookup is not implemented by Phase 4.
- Customs duties, taxes, insurance, remote-area charges, carrier API pricing and route-specific transit estimates are not automatically calculated.
- The quote request form currently supports one repeated package profile, not a list of different package dimensions.
- The current audit service is hash-chained/tamper-evident; independent immutable anchoring remains a production hardening requirement.
- Add e2e tests for quote calculations, cross-customer isolation, expiry, concurrent acceptance, replay/idempotency, rate-rule precedence and tracking-token secrecy before production.
