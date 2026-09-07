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
- [ ] Create Neon project, get `DATABASE_URL` (needed to actually run migrations/tests against a real DB)
- [ ] Create Clerk project, enable Google + Apple providers, configure session-token claim customization to include `role`
- [ ] Install `expo-dev-client`; produce first development build (`eas build --profile development`)
- [ ] Create Sentry project(s) (client + Workers)
- [ ] Install & run Inngest Dev Server locally (`npx inngest-cli@latest dev`) — no Inngest Cloud account needed yet

## Phase 1 — Schema + availability engine + tests (highest risk, do first)

- [ ] `src/lib/db/schema.ts` — Drizzle schema: `locations`, `profiles`, `weekly_schedules`, `date_overrides`, `treatments`, `slot_definitions`, `capacity_configs`, `booking_windows`, `bookings` (+ indexes)
- [ ] `src/lib/db/client.ts` — `neon()` + `drizzle(neon-http)` instance
- [ ] `drizzle.config.ts` + first migration generated (`drizzle-kit generate`)
- [ ] `src/lib/db/sql/create_booking_safe.sql` — Postgres function (advisory lock + full re-validation + insert)
- [ ] Apply `create_booking_safe` as a raw migration
- [ ] `src/lib/availability/engine.ts`:
  - [ ] `resolveEffectiveDayRules(dayOfWeek, weeklyRows, override)`
  - [ ] `computeBookableSlots(input)` (pure function)
  - [ ] `getBookableSlotsForDate` / `getBookableDates` (DB-fetching wrappers)
- [ ] `src/lib/time/business-time.ts` — tz-aware date/weekday/48h helpers
- [ ] `src/lib/config/location.ts` — `DEFAULT_LOCATION_ID` + seed helpers
- [ ] Seed script: one location, sample weekly schedule, slot definitions, capacity config, booking window, a couple treatments
- [ ] Test runner set up (jest-expo)
- [ ] `engine.test.ts` — pure-function unit tests:
  - [ ] weekday closed → no slots
  - [ ] override closes a normally-open day
  - [ ] override opens a normally-closed day with custom hours
  - [ ] override with custom hours on an already-open day uses override hours
  - [ ] slot extending past close time excluded
  - [ ] slot before open time excluded
  - [ ] 48h boundary (47h59m excluded, 48h00m included)
  - [ ] date exactly on / outside booking-window bounds
  - [ ] long treatment's full interval reduces capacity for every overlapping slot (not just exact-start match)
  - [ ] two partially-overlapping bookings count additively
  - [ ] pending bookings count toward capacity same as confirmed
  - [ ] cancelled bookings don't count
  - [ ] zero slot definitions for a weekday → no slots
- [ ] Integration/concurrency tests (real Postgres — Neon branch or local):
  - [ ] two concurrent `create_booking_safe` calls for the last capacity unit → exactly one succeeds
  - [ ] availability re-validated at submit time even if it changed since the client's last fetch
- [ ] Early spike: verify `db.execute(sql\`select * from create_booking_safe(...)\`)` under `neon-http` returns the composite row and surfaces `RAISE EXCEPTION` messages usably

## Phase 2 — Auth & profile

- [ ] Install `@clerk/expo`, `expo-secure-store`, `expo-apple-authentication`, `expo-crypto`, `@clerk/backend`, `svix`
- [ ] `_layout.tsx`: `<ClerkProvider tokenCache={secureStoreTokenCache}>` + `<ClerkLoaded>`
- [ ] `(auth)/sign-in.tsx` — native Google + Apple buttons
- [ ] Google native sign-in wired (Credential Manager / `EXPO_PUBLIC_CLERK_GOOGLE_IOS_URL_SCHEME`)
- [ ] Apple native sign-in wired (`useSignInWithApple()` + config plugin entitlements)
- [ ] `src/lib/auth/context.ts` — `getAuthContext(request)`, `requireManager(request)`
- [ ] `src/app/index.tsx` — role/auth router (signed-out → auth, manager → manager, customer incomplete profile → onboarding, else → customer)
- [ ] `(customer)/_layout.tsx` and `(manager)/_layout.tsx` guards mirroring the router
- [ ] `/api/webhooks/clerk+api.ts` — svix-verified `user.created`/`user.updated` → `inngest.send`
- [ ] Inngest function: idempotent `profiles` upsert (`onConflictDoUpdate` on `clerkUserId`) + role mirror
- [ ] `/api/profile+api.ts` (GET/PUT)
- [ ] `(customer)/onboarding/profile.tsx` — first-time name/phone capture

## Phase 3 — Customer booking flow

- [ ] `/api/treatments+api.ts` (GET active treatments)
- [ ] `/api/availability/dates+api.ts` (GET)
- [ ] `/api/availability/slots+api.ts` (GET)
- [ ] `/api/bookings+api.ts` (POST → calls `create_booking_safe`, maps exceptions to 409/422)
- [ ] `/api/bookings/me+api.ts` (GET)
- [ ] `(customer)/index.tsx` — home (current booking or CTA)
- [ ] `(customer)/booking/treatment.tsx` — step 1: choose treatment
- [ ] `(customer)/booking/date.tsx` — step 2: choose date
- [ ] `(customer)/booking/slot.tsx` — step 3: choose slot
- [ ] `(customer)/booking/confirm.tsx` — step 4: confirm/edit name+phone, submit
- [ ] `(customer)/booking/success.tsx` — booking created (pending)
- [ ] `(customer)/booking-status.tsx` — view-only status

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
