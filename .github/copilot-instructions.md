# Trueman Logistics Copilot Instructions

## Project overview
- This repository is a monorepo with two primary apps:
  - `apps/web`: React + Vite + TypeScript front-end for the logistics portal
  - `apps/api`: NestJS + TypeScript API with Prisma ORM and PostgreSQL-backed data access
- Use workspace scripts from the repo root for cross-app checks:
  - `npm run build`
  - `npm run typecheck`
- Keep changes scoped to the relevant app unless a cross-cutting update is required.

## Coding rules
- Prefer TypeScript types over `any`.
- Keep components small, readable, and focused on a single responsibility.
- Preserve existing naming patterns and folder structure.
- Do not introduce new dependencies unless they are clearly required for the task.
- Favor minimal, surgical edits over broad refactors.

## Front-end conventions (`apps/web`)
- Use React functional components and typed props.
- Prefer clear, semantic markup and reusable UI logic.
- Keep API data fetching consistent with the existing TanStack Query usage when present.
- Validate user-facing state and error handling before shipping UI changes.
- Avoid introducing styling patterns that conflict with the current app structure.

## API conventions (`apps/api`)
- Follow NestJS module/service patterns.
- Put business logic in services; keep controllers thin.
- Validate request DTOs using class-validator and class-transformer patterns already in use.
- Keep Prisma access centralized in services or repository-like layers; avoid ad hoc raw queries in controllers.
- Preserve existing environment and configuration conventions.

## Validation
- Run the smallest relevant validation command for the changed area.
- For TypeScript and build correctness, prefer the app-scoped typecheck/build commands when practical.
- When changing shared behavior or cross-app contracts, validate both sides of the change.

## Change expectations
- When implementing features or fixes, match the surrounding code style and architecture.
- Prefer adding or updating existing helpers instead of duplicating logic.
- Keep commit-sized changes focused and reviewable.
