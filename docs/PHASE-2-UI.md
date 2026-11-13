# Phase 2 — Customer website

## Brand direction

Trueman Logistics is presented as a China-based logistics business coordinating international shipments from China to destination markets worldwide. The visual system retains the existing Trueman brand mark and red identity, supported by navy, white and restrained gold accents.

## Homepage sections

1. Hero: China-to-world positioning, generated cargo-port visual, quote contact and tracking entry points.
2. Shipping services: air freight, sea freight, express shipping, cargo consolidation, warehousing and international logistics.
3. Shipment tracking: tracking reference entry with an explicit preview state until the tracking API is implemented.
4. How it works: quote request, shipment confirmation, dispatch from China, tracking and receipt.
5. Destinations: illustrative route visual. It does not claim verified coverage in a fixed number of countries.
6. About: China-origin company positioning and service principles.
7. Footer: navigation and existing support email.

## Asset

`apps/web/public/images/china-global-freight-hero.webp` is the generated visual asset used by the hero section. It is a visual design asset, not a photograph of a verified Trueman facility, aircraft, vessel or operation.

## Implementation notes

- Existing `Brand.tsx` logo component is intentionally retained because the requested direction was to keep the existing logo.
- No new backend integration is claimed. Quote requests currently open an email draft; tracking remains a frontend preview until the relevant API and shipment records are implemented.
- Destination paths are illustrative. Actual destination availability, customs requirements, rates and transit estimates must be confirmed operationally before publication.
- Responsive styles and reduced-motion-aware motion components are included.
