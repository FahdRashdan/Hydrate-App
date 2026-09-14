# Hydrate App — Build Plan & To-Do Checklist

This is the working checklist for implementation. Check items off as we complete them.
Full rationale/design detail lives in the approved plan at
`~/.claude/plans/you-are-my-senior-dreamy-castle.md` — this file is the execution tracker.

## Context

Hydrate is a treatment-booking app: a simple mobile customer booking flow + a fully
configurable manager dashboard, in one Expo Router app, one Neon Postgres schema (via
Drizzle), one set of `+api.ts` routes, eventually deployed to EAS Hosting.

The riskiest piece is the **availability/capacity engine** — it must correctly compute
bookable slots and prevent double-booking under concurrent submissions, on a DB driver
(`neon-http`) with no transaction support. Schema + engine + tests are built first.

## Confirmed product decisions

- One Expo Router app, universal: mobile customer flow + web-optimized manager dashboard, role-gated in the same codebase.
- Backend = Expo Router API routes (`+api.ts`) in the same repo.
- Auth = Clerk, Google + Apple only (no email/password). Manager role = Clerk `publicMetadata.role` flag, set manually.
- DB = Neon Postgres via Drizzle ORM, `neon-http` driver.
- Background jobs = Inngest (thin v1 footprint — Clerk webhook profile sync only). **Local dev uses the Inngest Dev Server**, not Inngest Cloud, until Phase 6.
- Error tracking = Sentry.
- Hosting = EAS Hosting (Cloudflare Workers), only set up at Phase 6 — not needed for local dev.
- Data model is location-scoped (`Location` FK everywhere) even though v1 seeds one location.
- Single shared capacity pool across all treatments (not per-treatment).
- Treatment availability = simple active/inactive toggle only.
- Booking lifecycle: created **Pending** (holds capacity immediately), manager manually confirms, **no auto-expiry**, **no customer self-cancel** (manager-only).
- Booking window: manager manually opens/extends the bookable date range.
- Single fixed business timezone. English-only v1 (i18n-ready structurally).
- Customer flow order: **treatment → date → slot → confirm details → book**.
- Testing bar: automated tests for the availability engine; manual QA for screens.
- Out of scope v1: payments, customer self-cancel, notifications/reminders, Arabic/RTL, per-treatment schedules/capacity, auto-expiring pending bookings, multi-location UI.

## Verified platform facts

- Expo Router API routes need `"web": { "output": "server" }` in `app.json`; bundle to single CommonJS file per route (no dynamic imports, no ESM).
- EAS Hosting runs `+api.ts` server output on Cloudflare Workers (partial Node compat, no raw TCP) → Neon HTTP driver required, not node-postgres.
- `drizzle-orm/neon-http` does **not** support `db.transaction()` (confirmed) → concurrency-safe writes go through a single Postgres function call using `pg_advisory_xact_lock`.
- Clerk Expo native Google/Apple sign-in requires a **development build** — Expo Go won't work.
- Inngest has a first-class `inngest/cloudflare` serve handler.

---

## Phase 0 — Project setup

- [x] `app.json`: `web.output` → `"server"`
- [x] Install `drizzle-orm`, `@neondatabase/serverless`, `drizzle-kit` (devDependency)
- [x] Create Neon project, get `DATABASE_URL` (needed to actually run migrations/tests against a real DB)
- [x] Create Clerk project, enable Google + Apple providers
- [x] Install `expo-dev-client`; local development build working (`npx expo prebuild --clean` + `npx expo run:ios`) — not yet produced via EAS cloud build
- [x] Create Sentry project(s) (client + Workers)
- [x] Install & run Inngest Dev Server locally (`npx inngest-cli@latest dev`) — no Inngest Cloud account needed yet

## Phase 1 — Schema + availability engine + tests (highest risk, do first)

- [x] `src/lib/db/schema.ts` — Drizzle schema: `locations`, `profiles`, `weekly_schedules`, `date_overrides`, `treatments`, `slot_definitions`, `booking_windows`, `bookings` (+ indexes). Deviation: no separate `capacity_configs` table — capacity lives directly on `slot_definitions` (a 1:1 join would've added nothing given the single shared capacity pool decision below).
- [x] `src/lib/db/client.ts` — `neon()` + `drizzle(neon-http)` instance
- [x] `drizzle.config.ts` + first migration generated (`drizzle-kit generate`)
- [x] `src/lib/db/sql/create_booking_safe.sql` — Postgres function (advisory lock + full re-validation + insert). Returns a structured `(ok, error_code, booking)` row rather than raising an exception — sidesteps the "verify RAISE EXCEPTION messages surface usably" spike below entirely.
- [x] Applied `create_booking_safe` as a raw migration (`0003_create_booking_safe_fn.sql`, via `drizzle-kit generate --custom`)
- [x] `src/lib/availability/engine.ts` (pure functions only) + `src/lib/availability/queries.ts` (DB-fetching wrappers — split out so `engine.ts` never imports `db/client.ts`, keeping the unit tests DB-free):
  - [x] `resolveEffectiveDayRules(dateStr, weeklyRows, override)`
  - [x] `computeBookableSlots(input)` (pure function)
  - [x] `getBookableSlotsForDate` / `getBookableDates` (DB-fetching wrappers, in `queries.ts`)
- [x] `src/lib/time/business-time.ts` — fixed-timezone (Africa/Cairo, confirmed with user) date/weekday/48h helpers; `src/lib/time/format.ts` for display-only formatting
- [x] `src/lib/config/location.ts` — `DEFAULT_LOCATION_ID`
- [x] Seed script: `scripts/seed.ts` — one location, sample weekly schedule, slot definitions (with capacity), booking window, three treatments. Human-run: `npx tsx --env-file=.env scripts/seed.ts`
- [x] Test runner set up (`jest-expo`, `jest.config.js`)
- [x] `engine.test.ts` — pure-function unit tests, all 13 cases below covered (18 tests total, all passing):
  - [x] weekday closed → no slots
  - [x] override closes a normally-open day
  - [x] override opens a normally-closed day with custom hours
  - [x] override with custom hours on an already-open day uses override hours
  - [x] slot extending past close time excluded
  - [x] slot before open time excluded
  - [x] 48h boundary (47h59m excluded, 48h00m included)
  - [x] date exactly on / outside booking-window bounds
  - [x] long treatment's full interval reduces capacity for every overlapping slot (not just exact-start match)
  - [x] two partially-overlapping bookings count additively
  - [x] pending bookings count toward capacity same as confirmed
  - [x] cancelled bookings don't count
  - [x] zero slot definitions for a weekday → no slots
- [ ] Integration/concurrency tests (real Postgres — Neon branch or local) — **not attempted**, needs a live DB session (human follow-up):
  - [ ] two concurrent `create_booking_safe` calls for the last capacity unit → exactly one succeeds
  - [ ] availability re-validated at submit time even if it changed since the client's last fetch
- [ ] Early spike: verify `db.execute(sql\`select * from create_booking_safe(...)\`)` under `neon-http` returns the composite row usably — **not attempted**, needs a live DB session; N/A for `RAISE EXCEPTION` message parsing specifically, since the function returns a structured row instead (see above)

## Phase 2 — Auth & profile

- [x] Install `@clerk/expo`, `expo-secure-store`
- [x] Install `@clerk/backend` (needed for the webhook handler below; `svix` verification is handled internally by `@clerk/backend/webhooks`, no separate install needed)
- [x] `_layout.tsx`: `<ClerkProvider>` + `tokenCache` from `@clerk/expo/token-cache` (loading state gated via `useAuth().isLoaded` in `index.tsx` instead of a separate `<ClerkLoaded>` wrapper)
- [x] Combined sign-in UI — Google + Apple on one screen, by choice (`src/app/index.tsx`, not a separate `(auth)/sign-in.tsx`)
- [x] Google sign-in wired via browser SSO (`useSSO()`, `strategy: "oauth_google"`) — publishable key only, no separate Google Cloud OAuth clients or native Credential Manager
- [x] Apple sign-in wired via browser SSO (`useSSO()`, `strategy: "oauth_apple"`) — deliberately not the native `expo-apple-authentication` flow, since that requires a paid Apple Developer Program membership to provision the Sign in with Apple capability, which isn't available yet
- [x] `src/lib/auth/context.ts` — `getAuthContext(request)`. No `requireManager` — manager dashboard is out of scope for this build, so nothing needs it yet.
- [x] `src/app/index.tsx` — full role/auth router: signed-out → auth screen; signed-in + onboarding incomplete → `onboarding/profile.tsx`; signed-in + role=manager → inline placeholder (manager dashboard out of scope); signed-in + role=customer → redirects into `(customer)` Native Tabs.
- [x] `(customer)/_layout.tsx` — Native Tabs guard (signed-in safety net only; role/onboarding already resolved by `index.tsx`). No `(manager)/_layout.tsx` — out of scope.
- [x] `/api/webhooks/clerk+api.ts` — svix-verified `user.created`/`user.updated`/`user.deleted` → `inngest.send`
- [x] Inngest function: idempotent `profiles` upsert (`onConflictDoUpdate` on `clerkUserId`) + role mirror, for `user.created`/`user.updated` (`src/lib/inngest/functions/sync-user-from-clerk.ts`)
- [x] Inngest function: `profiles` row deletion on `user.deleted` (`src/lib/inngest/functions/delete-user-from-clerk.ts`)
- [x] `/api/profile+api.ts` (GET/PUT)
- [x] `onboarding/profile.tsx` — first-time name/phone capture. Deviation: moved from `(customer)/onboarding/profile.tsx` to a top-level `onboarding/profile.tsx` — it's rendered inline as a plain component by `index.tsx` (never routed to directly either way), moved purely so it isn't implicitly swept into the new `(customer)` Native Tabs route table.

## Phase 3 — Customer booking flow

- [x] `/api/treatments+api.ts` (GET active treatments)
- [x] `/api/availability/dates+api.ts` (GET)
- [x] `/api/availability/slots+api.ts` (GET)
- [x] `/api/bookings+api.ts` (POST → calls `create_booking_safe`, maps `error_code` to 409/422)
- [x] `/api/bookings/me+api.ts` (GET)
- [x] `(customer)/index.tsx` — home (current booking or CTA). Folds in what would've been a separate `booking-status.tsx` (see below).
- [x] `booking/treatment.tsx` — step 1: choose treatment
- [x] `booking/date.tsx` — step 2: choose date
- [x] `booking/slot.tsx` — step 3: choose slot
- [x] `booking/confirm.tsx` — step 4: confirm/edit name+phone, submit
- [x] `booking/success.tsx` — booking created (pending)
- [x] `(customer)/profile.tsx` — read-only account info + sign out (not in the original Phase 3 list, added since the old placeholder's sign-out affordance needed a new home once Home became real)
- Deviation: the whole booking wizard (`treatment`/`date`/`slot`/`confirm`/`success`) lives at a **top-level** `src/app/booking/*.tsx`, not nested under `(customer)/booking/*.tsx` — keeps it a sibling stack to the Native Tabs group so it can never be mistaken for an extra tab. No separate `booking-status.tsx` — folded into `(customer)/index.tsx` per the resolution above.

## Phase 4 — Manager dashboard

- [ ] `/api/manager/appointments+api.ts` (GET, filter/search)
- [ ] `/api/manager/appointments/[id]+api.ts` (GET)
- [ ] `/api/manager/appointments/[id]/confirm+api.ts` (POST)
- [ ] `/api/manager/appointments/[id]/cancel+api.ts` (POST, with reason)
- [ ] `/api/manager/schedule/weekly+api.ts` (GET/PUT)
- [ ] `/api/manager/schedule/overrides+api.ts` (GET/POST) + `[id]+api.ts` (DELETE)
- [ ] `/api/manager/schedule/slots+api.ts` (GET/PUT)
- [ ] `/api/manager/capacity+api.ts` (GET/PUT)
- [ ] `/api/manager/treatments+api.ts` (GET/POST) + `[id]+api.ts` (PATCH)
- [ ] `/api/manager/booking-window+api.ts` (GET/PUT)
- [ ] `(manager)/index.tsx` — overview
- [ ] `(manager)/appointments/index.tsx` — list, filter, search
- [ ] `(manager)/appointments/[id].tsx` — detail + confirm/cancel
- [ ] `(manager)/schedule/weekly.tsx` — weekly open/close + hours editor
- [ ] `(manager)/schedule/overrides.tsx` — date overrides editor
- [ ] `(manager)/schedule/slots.tsx` — slot times + capacity editor
- [ ] `(manager)/treatments/index.tsx` — treatments CRUD
- [ ] `(manager)/booking-window.tsx` — open/extend bookable range

## Phase 5 — Export, Sentry, polish

- [ ] Install `xlsx` from SheetJS's own CDN tarball (not the stale npm registry package)
- [ ] `src/lib/export/xlsx.ts` — build workbook from bookings + treatments join
- [ ] `/api/manager/export+api.ts` (GET, streams xlsx, `Content-Disposition: attachment`)
- [ ] `(manager)/export.tsx` — date range picker + download link
- [ ] `src/lib/sentry.ts` — client init
- [ ] Sentry wired into Workers/API-route side (verify wrappable Workers fetch entry; fall back to manual `captureException` per handler if not)
- [ ] Loading / empty / error states across customer + manager screens

## Phase 6 — First EAS Hosting deploy & E2E verification

- [ ] EAS Hosting project set up
- [ ] Production env vars set (Neon prod `DATABASE_URL`, Clerk keys, Sentry DSN, Inngest keys)
- [ ] Inngest Cloud account created, `INNGEST_EVENT_KEY`/`INNGEST_SIGNING_KEY` set, `inngest/cloudflare` serve handler confirmed against Cloud (not just Dev Server)
- [ ] Clerk webhook URL pointed at deployed domain
- [ ] Deploy to EAS Hosting
- [ ] Repeat Phase 3/4 manual walkthroughs against the deployed URL
- [ ] Confirm export streams correctly through the Workers/CDN path

---

## Testing plan (reference — tracked as checklist items under Phase 1)

Pure-function unit tests and integration/concurrency tests are listed under Phase 1 above.

## Verification (per phase)

- [ ] **Phase 1**: unit tests green; hand-test `create_booking_safe` via `psql`/Neon SQL editor (happy path + each rejection reason); concurrency test passes against a real Neon branch
- [ ] **Phase 2**: dev build on device, sign in with Google and Apple, confirm `profiles` row appears, confirm role-based redirect for manager vs customer
- [ ] **Phase 3**: full booking flow walkthrough on device against seeded data; booking lands as `pending`; slots disappear once capacity exhausted; raw `curl`/Postman POST bypassing UI still rejected for 48h/window violations
- [ ] **Phase 4**: `expo start --web` walkthrough of every manager screen; edits reflected in `/api/availability/*`; confirm/cancel updates `bookings.status` and timestamps
- [ ] **Phase 5**: downloaded xlsx opens correctly in Excel/Numbers/Sheets; deliberate server error surfaces in Sentry
- [ ] **Phase 6**: Phase 3/4 walkthroughs repeated against deployed EAS Hosting URL; Clerk webhook + Inngest events work against the live domain

### Critical files
- `src/lib/db/schema.ts`
- `src/lib/db/sql/create_booking_safe.sql`
- `src/lib/availability/engine.ts`
- `src/app/api/bookings+api.ts`
- `src/lib/auth/context.ts`
