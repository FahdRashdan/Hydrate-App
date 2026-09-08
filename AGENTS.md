# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

## Tech stack

- Expo SDK 57 / Expo Router 57 (typedRoutes + reactCompiler experiments on)
- React 19.2, React Native 0.86
- Styling: NativeWind v4 (Tailwind classes via `className`) — not StyleSheet
- Native UI: `@expo/ui` for platform-native components (SwiftUI on iOS, Jetpack Compose on Android)
- Database: Postgres, hosted on Neon
- ORM: Drizzle (`drizzle-orm/neon-http` driver)
- Auth: Clerk — Google + Apple sign-in only, no email/password
- Background jobs: Inngest
- Error tracking & monitoring: Sentry (`@sentry/react-native`)
- Hosting target: EAS Hosting on Cloudflare Workers (partial Node compat, no raw TCP)

## Architecture

- One Expo Router app, universal: mobile customer booking flow + web-optimized manager
  dashboard, role-gated in the same codebase (Clerk `publicMetadata.role`).
- Backend = Expo Router API routes (`+api.ts`) in this same repo, not a separate server.
- Data model is location-scoped (`Location` FK everywhere) even though v1 seeds one location.
- Full rationale lives in `PLAN.md` (execution checklist) — check it before assuming a
  feature is in scope.

## Hard constraints (don't "fix" these)

- `drizzle-orm/neon-http` does **not** support `db.transaction()`. Concurrency-safe writes
  go through a single Postgres function call (`create_booking_safe`, `pg_advisory_xact_lock`),
  not a multi-query transaction.
- `+api.ts` routes must bundle to a single CommonJS file per route — no dynamic imports,
  no ESM, inside those files (Cloudflare Workers constraint).
- Clerk native Google/Apple sign-in requires a development build — it will not work in Expo Go.

## Conventions

- Navigation: **always use native tabs.** Never a JavaScript-rendered tab bar — use Expo
  Router's Native Tabs / the `@expo/ui` equivalent for this SDK version (confirm the exact
  API against the versioned docs above before implementing).
- Path aliases: `@/*` → `src/*`, `@/assets/*` → `assets/*`.
- Styling goes through NativeWind classes, not inline `StyleSheet.create`.
- Testing bar: automated tests are for the availability engine only; everything else is
  manual QA — don't add UI test suites unless asked.

## Out of scope for v1

Payments, customer self-cancel, notifications/reminders, Arabic/RTL, per-treatment
schedules/capacity, auto-expiring pending bookings, multi-location UI. Don't build these
speculatively — see `PLAN.md` for the confirmed decision list.

## Never run the app

Claude must never start or run the app (`expo start`, `npm run ios`/`android`/`web`,
`eas build`, etc.) or any dev/build servers. Verify changes by reading code, running
non-interactive checks (typecheck, lint, unit tests), or asking the user to run/check
the app themselves.
