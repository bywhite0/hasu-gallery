# Hasu Gallery - AI Development Guide

This file is a lightweight entry point for coding agents. Keep it current and
short. Historical phase details belong in `.ccg/spec/roadmap.md` and the phase
summary files, not here.

## Current Status

- Phase 1-5 baseline is complete.
- Frontend: React 19 + Rspack + TanStack Router/Query + zustand + Tailwind v4.
- Backend: Rust Axum + PostgreSQL + MinIO/S3 + tower-sessions.
- CI is intentionally lightweight: frontend typecheck/build/component tests and
  backend Postgres + `cargo test`.
- Playwright E2E is a local pre-release acceptance script, not part of CI.
- Current product-design track: keep release acceptance green, support
  production hookup, then evolve Profile into a submission workspace before
  larger community interaction or popularity metrics.

## Source Of Truth

- Product and implementation roadmap: `.ccg/spec/roadmap.md`
- Data model: `.ccg/spec/phase0-content-core-model.md`
- API contract: `docs/api.md`
- Deployment: `docs/deployment.md`
- Monitoring: `docs/monitoring.md`
- Moderation policy: `docs/moderation-guidelines.md`
- Local product/design guidance: `.codex-local/PRODUCT.md` and
  `.codex-local/ui-design-system-guidance.md` (ignored by Git)

## Architecture Rules

- Frontend and backend are independently deployable. Do not couple frontend
  build output to backend runtime.
- Data flow: PostgreSQL -> Rust API -> React frontend.
- Upload flow: authenticated user -> Rust validation -> S3/MinIO original and
  thumbnail -> public media URL.
- Keep API contracts stable. Frontend consumes JSON responses only.
- Do not place user-uploaded works in frontend `public/`.
- Large gallery filtering must stay server-side via `GET /api/works` params.
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
- Shared types: `packages/types/src/models.ts`, `packages/types/src/api.ts`
- Backend entry: `backend/src/main.rs`
- Backend routes: `backend/src/routes/`
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

Pre-release/local acceptance:

```powershell
pnpm test
pnpm typecheck
pnpm build
cargo test --manifest-path backend/Cargo.toml
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

The next design/implementation track should start with the account submission
workspace:

- Group owned works by Waiting for review, Published, Needs changes, and Not
  accepted.
- Show submission date, review state, reviewer note, and next action.
- Keep private reviewer notes separate from future public comments.
- Add Account Settings only after the submission workflow stays clear.
- Add favorites/likes/reporting before comments; do not add direct messages in
  the near term.

## Git

- Use Conventional Commits in English.
- Keep unrelated local changes out of commits.
- `.codex-local/` is intentionally ignored local guidance.
