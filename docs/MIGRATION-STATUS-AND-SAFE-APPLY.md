# Migration status and safe application

## Important finding in the supplied Phase 4 archive

The archive contains the Phase 4 quotation migration, but it does not contain the earlier baseline migrations that create the pre-existing `User`, `Customer`, `Shipment`, `ShipmentEvent`, and related tables. The Phase 4 migration alters those existing tables. Therefore, this archive alone does not prove that a brand-new empty PostgreSQL database can be initialized using `prisma migrate deploy`.

Do not run `prisma migrate reset`, do not delete the PostgreSQL Docker volume, and do not use `docker compose down -v`.

## Before applying Phase 5 to an existing local database

1. Make a database backup.
2. Start the existing Docker services without removing volumes.
3. From the project root, run `docker compose exec api npx prisma migrate status`.
4. Confirm whether the Phase 4 migration is recorded as applied.
5. Confirm the actual database schema is consistent with the Phase 4 Prisma models.
6. Only after the migration history is reconciled should the Phase 5 migration be deployed.

The Phase 5 migration is additive: it creates the review/source enums, adds attribution and review columns to `Shipment`, adds indexes and adds nullable foreign keys to `User`.

## If this is a fresh database

Do not assume the Phase 4 migration can run first. The missing baseline migration must be reconstructed and reconciled with the actual Phase 3 database schema before using `migrate deploy`. Do not invent a baseline from an incomplete database snapshot.

## Commands after migration history has been verified

From the project root:

```powershell
docker compose exec api npx prisma validate
docker compose exec api npx prisma migrate deploy
docker compose exec api npx prisma generate
```

Then rebuild the API and web containers:

```powershell
docker compose up -d --build api web
docker compose ps
```

Check API logs:

```powershell
docker compose logs --tail=100 api
```

The local staff portal route is `/admin` on the same host and port as the public website. For the default Compose configuration, that is `http://localhost:5173/admin`.

The default local web port can be changed through `WEB_PORT`; use the actual published port shown by `docker compose ps`.
