# Phase 2 redesign — file-by-file notes

This update repositions the customer website for a China-based logistics business shipping from China to international destinations. The existing application architecture, API, Prisma schema, Docker Compose services and existing brand component are retained.

## Changed files

- `apps/web/src/App.tsx` — Rebuilt the homepage structure and navigation. The previous Ghana/local framing, truck illustration, redundant promotional bands and old network block were removed. The page now contains the China-to-world hero, services, tracking preview, shipping steps, destination route illustration, about section and updated footer.
- `apps/web/src/data/services.ts` — Replaced Ghana-oriented service descriptions with China-origin international air freight, sea freight, express shipping, cargo consolidation, warehousing and international logistics descriptions.
- `apps/web/src/styles.css` — Added the responsive China-origin design system, photographic hero treatment, service cards, tracking panel, shipping steps, destination route illustration, about section and footer. Existing styles remain in place for components still used by the application.
- `apps/web/src/components/TrackingForm.tsx` — Updated the tracking reference example and clarified that live tracking is not connected yet. The form remains a preview until the Phase 5 tracking API exists.
- `apps/web/index.html` — Updated the page title and search description to reflect China-origin international logistics.
- `docs/PHASE-2-UI.md` — Updated the Phase 2 UI scope and implementation notes.

## Added files

- `apps/web/public/images/china-global-freight-hero.webp` — Generated and cropped hero artwork showing an aircraft and container port. This is a visual asset, not documentary evidence of a specific company facility or shipment.
- `docs/PHASE-2-REDESIGN-NOTES.md` — This file-by-file change record.

## Intentionally unchanged

- `apps/web/src/components/Brand.tsx` — Kept the existing logo component as requested.
- `apps/api/**`, `apps/api/prisma/schema.prisma`, `docker-compose.yml`, `.env.example`, root workspace configuration and infrastructure — No Phase 1 architecture or backend behavior was changed.

## Functional boundaries

- The hero quote links open an email draft; they do not create a shipment order.
- The tracking form is a frontend preview; it does not query a tracking API.
- The route illustration is conceptual. It does not represent live routes, guaranteed coverage or live GPS.
- Rates, transit times, customs handling and destination availability are not calculated or guaranteed by this UI.
