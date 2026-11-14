---
version: 1
slug: "src-app-tsx"
primary_target: "src/App.tsx"
related_targets: []
---

# Customer Dashboard Surface

Scope: `/dashboard` customer account workspace · Mode: Operate.

Audience and task: authenticated customers arranging China-origin freight need to request a quote, review outstanding quotes, and check their active shipment progress. Success is knowing the next action and opening the relevant quote or shipment quickly.

Content and states: render account-scoped active shipments and unexpired quoted offers from the API. Include loading, error, and empty states. Use shipment number, route, operational status, update time, quote reference, total, and validity date. Any sample data in design sketches is illustrative only.

Constraints: preserve Trueman Logistics' existing visual identity and standard web controls. Keep the quote action in the top action bar. Session authority remains the backend HttpOnly cookie; never store session tokens in browser storage. Never expose the raw one-time tracking reference. Staff operations remain separate from customer data.

## Direction contract

THESIS: One customer workspace gives shipments and quotes equal priority, so a customer can move between tracking progress and quote decisions without searching separate pages. It refuses to bury either workflow in a generic welcome dashboard.

OWN-WORLD: Extend the existing Trueman Logistics web identity: white working surfaces on a cool light-neutral ground, deep ink text, restrained red action color, compact DM Sans hierarchy, crisp table rules, and status colors reserved for operational meaning. Keep standard React web navigation, buttons, and semantic tables.

STORY: The signed-in customer sees their next useful actions immediately: start a quote, inspect active shipments, or review an outstanding quote. Real account data replaces all illustrative sketch content; empty and failure states explain the next available action.

FIRST VIEWPORT: A concise customer navigation header sits above an account title and prominent Request a quote action. Below it, Active shipments and Outstanding quotes occupy equal columns with stable table headings, readable references, route/status or amount/expiry, and clear row actions. On narrow screens the sections stack without horizontal page overflow.

FORM: Balanced customer workspace, grounded structure #2 and the third dealt option selected by the user; seed:9943b11f3c0ce2de.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
