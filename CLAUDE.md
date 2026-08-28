# Hasu Gallery - AI Development Guide

This file is a lightweight entry point for coding agents. Keep it current and
short. Historical phase details belong in `.ccg/spec/roadmap.md` and the phase
summary files, not here.

## Current Status

- Phase 1-5 baseline is complete.
- Frontend: React 19 + Rspack + TanStack Router/Query + zustand + Tailwind v4.
- Backend: Rust Axum + PostgreSQL + MinIO/S3 + tower-sessions.
- Current production model is still an independently served SPA plus JSON API.
- Architecture V3 (2026-08-28) supersedes V2: one JSON API contract, no
  Protobuf/codegen toolchain. V3 S1 is shipped: Fiction public/account/
  moderation routes are JSON under `/api/fictions*`, `/api/users/me/fictions*`,
  and `/api/moderation/fictions*`; `galleryd` embeds the SPA as fallback.
  V3 S2 is shipped: `media_assets` + UUIDv4 media IDs, private
  `private/{uuid}/...` staging, approval-time copy to immutable
  `public/{uuid}/v1/...`, presigned review URLs, and `galleryd backfill-media`.
  S3 (policy layer, security headers, single-binary cutover) is not shipped.
- CI is intentionally lightweight: frontend typecheck/build/component tests and
  backend Postgres + `cargo test`.
- Playwright E2E is a local pre-release acceptance script, not part of CI.
- Current engineering track: deploy S2 (migration 006 + `backfill-media` +
  CDN denies `private/*`), then implement V3 S3 (policy layer, security
  headers, single-binary cutover) while keeping the completed
  guest/account/moderation baseline green.

## Source Of Truth

- Product and implementation roadmap: `.ccg/spec/roadmap.md`
- Approved target architecture: `.ccg/spec/architecture-v3.md`
  (`architecture-v2.md` is superseded, kept for history)
- Data model: `.ccg/spec/phase0-content-core-model.md`
- Current API contract: `docs/api.md`
- Current deployment: `docs/deployment.md`
- Monitoring: `docs/monitoring.md`
- Moderation policy: `docs/moderation-guidelines.md`
- Local product/design guidance: `.codex-local/PRODUCT.md` and
  `.codex-local/ui-design-system-guidance.md` (ignored by Git)

## Architecture Rules

- Treat `.ccg/spec/architecture-v3.md` as the target architecture source of
  truth. Do not describe an unimplemented V3 capability as already shipped.
- The business API is one JSON contract under `/api`. Do not reintroduce a
  second transport (Protobuf/gRPC) or a schema codegen toolchain.
- Preserve the current JSON API and independently served SPA until the
  corresponding V3 migration slice passes regression and rollback checks.
- V3 keeps the existing React/Rspack/TanStack/zustand/Tailwind architecture but
  embeds its production build in one Rust executable; independent static
  frontend deployment is not a requirement.
- V3 uses PostgreSQL as the system of record and external S3-compatible storage
  such as AWS S3 or Cloudflare R2, with `private/` and `public/` key prefixes.
- Content kinds are Meme, Art, and Fiction. Fiction uses versioned PostgreSQL
  text revisions, series ordering, shared moderation, and safe constrained
  markup rather than raw HTML.
- Public media URLs use a distinct UUIDv4 media ID (shipped in V3 S2).
  Originals and pending objects live under the private `private/{uuid}/...`
  namespace and are reachable only via short-lived presigned URLs; only
  approved sanitized objects are copied to public `public/{uuid}/v{n}/...`.
- Production frontend and API are same-origin, production CORS is disabled, and
  protected operations pass through a centralized deny-by-default policy layer
  (V3 S3).
- Do not place user-uploaded works in frontend `public/` or expose raw upload
  bytes from the public media origin.
- Large gallery filtering must stay server-side (`GET /api/works`).
- Upload requires login. `gallery=meme` requires `origin`; `gallery=art`
  requires artist, rating, and source URL.

## Key Files

- Frontend routes: `apps/web/src/router.tsx`
- Frontend app state: `apps/web/src/store/index.ts`,
  `apps/web/src/store/auth.ts`
- Frontend API clients: `apps/web/src/api/`
- Frontend i18n: `apps/web/src/i18n/`
- UI tokens/primitives: `packages/ui/src/styles/tokens.css`,
  `packages/ui/src/primitives/`
- Shared types: `packages/types/src/models.ts`, `packages/types/src/api.ts`,
  `packages/types/src/fiction.ts`
- Target architecture: `.ccg/spec/architecture-v3.md`
- Backend entry / galleryd: `backend/src/main.rs`
- Embedded SPA fallback: `backend/src/spa.rs`
- Media identity/URLs: `backend/src/media.rs` (backfill: `backend/src/backfill.rs`)
- Backend routes: `backend/src/routes/` (Fiction: `backend/src/routes/fiction.rs`)
- Fiction domain layer: `backend/src/fiction/`
- Backend middleware: `backend/src/middleware.rs`
- DB migrations: `backend/migrations/`

## Development Commands

Run from repository root:

```powershell
pnpm install
pnpm run dev
pnpm run dev:api
pnpm run storybook
```

Single-binary galleryd packaging helpers:

```powershell
pnpm run sync:web-embed
pnpm run build:galleryd
cargo run --manifest-path backend/Cargo.toml --bin galleryd -- doctor
```

Pre-release/local acceptance:

```powershell
pnpm test
pnpm typecheck
pnpm build
cargo test --manifest-path backend/Cargo.toml --bin galleryd
pnpm e2e
```

Use project pnpm version `10.26.2` when regenerating the lockfile. In this
environment, `npx --yes pnpm@10.26.2 <command>` is a safe fallback if the shell
resolves another pnpm version.

## Coding Guidance

- Prefer existing React/TanStack/zustand patterns over new abstractions.
- Use Tailwind v4 tokens and shared UI primitives. Avoid inline styles.
- New user-facing copy should use i18n translation keys.
- Keep enum labels centralized through i18n helpers.
- Use product-level error copy; do not surface raw `Failed to fetch`, `HTTP 403`,
  or backend implementation text in primary UI.
- Preserve accessibility labels and keyboard paths for forms, filters, upload,
  and moderation controls.
- For risky frontend behavior, add or extend Vitest + Testing Library component
  tests in `apps/web`.
- For user flows, keep Playwright coverage across desktop `1440 x 1000` and
  mobile `390 x 844`.

## Common Change Patterns

### Add A Work Field

- Add a migration under `backend/migrations/`.
- Update shared types in `packages/types/src/models.ts`.
- Update backend SQL queries and API response mapping.
- Update frontend API consumption and UI labels.
- Add tests covering serialization and user-visible behavior.

### Add A Route

- Register the route in `apps/web/src/router.tsx`.
- Use TanStack Router navigation patterns already present in the app.
- Add route guards only where required by product access rules.
- Keep guest browsing open for approved public works.

### Add A Filter

- Extend `GET /api/works` parameters and SQL WHERE logic server-side.
- Update `packages/types/src/api.ts` if the contract changes.
- Update frontend state and `FilterPanel`.
- Add component and/or Playwright coverage for query params and visible labels.

## Next Product Direction

The next architecture/product track is the bounded Architecture V3 migration
(S3 policy/headers/single-binary cutover; S1–S2 are shipped). It must
preserve the completed Meme/Art baseline and the shipped Fiction foundation:

- Fiction is a first-class content kind, not an Art attachment.
- Support single works and ordered series.
- Keep drafts and pending revisions private.
- Publishing a replacement revision must atomically switch the public pointer
  without overwriting the currently published version before approval.
- Store bounded safe markup and plain-text search projections in PostgreSQL;
  never accept or render author-provided raw HTML.
- Reuse UUIDv4 private/public media handling for covers and inline
  illustrations.
- Keep reviewer notes private and separate from future public comments.

After the V3 foundation is stable, continue the existing product sequencing:
account settings, then favorites/likes/reporting, then carefully moderated
comments. Direct messages remain out of the near-term plan.

## Git

- Use Conventional Commits in English.
- Keep unrelated local changes out of commits.
- `.codex-local/` is intentionally ignored local guidance.
