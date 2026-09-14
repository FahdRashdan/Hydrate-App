# Hydrate Booking App

A full-stack, universal treatment-booking application built for high-end IV therapy and scalp wellness clinics. Built with **Expo SDK 57**, **React 19.2**, **NativeWind v4**, **Neon Postgres**, and **Clerk**.

---

## Tech Stack

| Layer                 | Technology                                                                                           | Details                                                         |
| :-------------------- | :--------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------- |
| **Framework**         | [Expo SDK 57](https://docs.expo.dev/) / [Expo Router 57](https://docs.expo.dev/router/introduction/) | Universal app routing, React Compiler, typed routes             |
| **Frontend Core**     | React 19.2, React Native 0.86                                                                        | Strict TypeScript (`.ts` and `.tsx`)                            |
| **Styling**           | [NativeWind v4](https://www.nativewind.dev/) (TailwindCSS)                                           | Clean utility classes via `className`, zero `StyleSheet.create` |
| **Native Components** | Native Tabs (`unstable-native-tabs`) & Apple SF Symbols                                              | Native tab bar and vector iconography via `expo-symbols`        |
| **Database**          | [Postgres on Neon](https://neon.tech/)                                                               | Serverless Postgres connected via HTTP                          |
| **ORM**               | [Drizzle ORM](https://orm.drizzle.team/)                                                             | Type-safe queries using `drizzle-orm/neon-http`                 |
| **Authentication**    | [Clerk](https://clerk.com/)                                                                          | Google & Apple native OAuth only (no email/password)            |
| **Backend API**       | Expo Router API Routes (`+api.ts`)                                                                   | Serverless route endpoints co-located in the same repository    |
| **Background Jobs**   | [Inngest](https://www.inngest.com/)                                                                  | Webhook ingestion and asynchronous user profile syncing         |
| **Monitoring**        | [Sentry](https://sentry.io/)                                                                         | `@sentry/react-native` for real-time error tracking             |
| **Deployment Target** | EAS Hosting / Cloudflare Workers                                                                     | Edge-compatible serverless build targets                        |

---

## Core Features

### 1. Customer Experience (Mobile App)

* **Fluid Booking Flow**: Step-by-step wizard (*Treatment Selection → Date Picker → Real-time Slot Availability → Instant Reservation Hold*).
* **Home Dashboard**: Dynamic time-of-day greetings, active upcoming visit status card, and signature treatment showcase.
* **Appointments Management**: Segregated tabs for **Upcoming** and **Past Visits**, live booking status pills (`Pending`, `Confirmed`, `Cancelled`), and 1-tap rebooking.
* **Account & Privacy**: Profile contact management, customer account deletion with cascading database cleanup, and privacy policy advisories.
* **Refined Aesthetics**: Tailored luxury wellness UI matching Figma design specifications with zero emojis and 100% native vector SF Symbols.

### 2. Concurrency-Safe Booking Engine

* **Capacity & Availability Calculation**: Pure business logic engine ([`src/lib/availability/engine.ts`](file:///Users/fahdrashdan/Desktop/Hydrate_App/src/lib/availability/engine.ts)) computing bookable slots considering operating schedules, 48-hour minimum lead times, date overrides, and active booking windows.
* **Double-Booking Prevention**: Because serverless HTTP database drivers (`neon-http`) do not support multi-query client-side transactions, atomic reservations are handled directly inside Postgres via the custom database function `create_booking_safe` utilizing transaction locks (`pg_advisory_xact_lock`).
* **100% Unit Test Coverage**: Verified mathematical correctness with full Jest test suite for overlapping bookings, capacity constraints, and edge intervals.

### 3. Identity, Webhooks & Profiles

* **Passwordless Authentication**: Google and Apple OAuth through `@clerk/expo`.
* **Event-Driven Profile Sync**: When a user registers or deletes their account, Clerk webhooks dispatch events to Inngest background functions ([`src/lib/inngest/functions/`](file:///Users/fahdrashdan/Desktop/Hydrate_App/src/lib/inngest/functions/)) to sync customer records with Neon Postgres.
* **First-Time Onboarding**: Captures verified customer name and mobile number required for clinical appointments.

---

## Project Structure

```text
├── assets/                       # Static brand logos, fonts, and splash assets
├── design/                       # UI/UX design mockups and Figma inspirations
├── drizzle/                      # Generated SQL migration files
├── src/
│   ├── app/                      # Expo Router screens and API routes
│   │   ├── (customer)/           # Customer layout with Native Tabs
│   │   │   ├── index.tsx         # Home dashboard & treatment showcase
│   │   │   ├── bookings.tsx      # My Bookings (Upcoming & History)
│   │   │   └── profile.tsx       # Account settings, Privacy, Delete account
│   │   ├── booking/              # Modal booking wizard flow
│   │   │   ├── treatment.tsx     # Step 1: Select treatment
│   │   │   ├── date.tsx          # Step 2: Select date
│   │   │   ├── slot.tsx          # Step 3: Select time slot
│   │   │   ├── confirm.tsx       # Step 4: Review and submit
│   │   │   └── success.tsx       # Step 5: Booking confirmation state
│   │   ├── onboarding/           # First-time profile completion
│   │   ├── api/                  # Expo Router backend API routes (+api.ts)
│   │   │   ├── availability/     # Slot and date computation endpoints
│   │   │   ├── bookings/         # Booking creation and customer query endpoints
│   │   │   ├── profile/          # Profile GET, PUT, and DELETE handlers
│   │   │   ├── treatments/       # Active treatment catalog
│   │   │   ├── webhooks/clerk/   # Clerk authentication webhooks
│   │   │   └── inngest+api.ts    # Inngest serverless event handler
│   │   ├── _layout.tsx           # Global Root layout with ClerkProvider
│   │   └── index.tsx             # Root auth router and splash gateway
│   └── lib/
│       ├── api/                  # Authenticated client-side fetcher
│       ├── auth/                 # Backend Clerk authentication utilities
│       ├── availability/         # Availability engine & availability queries
│       ├── config/               # Location and business configuration
│       ├── db/                   # Neon connection and Drizzle schema
│       ├── inngest/              # Inngest client and event functions
│       ├── theme/                # Curated brand color tokens
│       ├── time/                 # Display and business time utilities
│       └── ui/                   # Reusable UI components & Apple SF Symbols
├── AGENTS.md                     # Architectural rules & project constraints
├── PLAN.md                       # Execution plan & development tracker
└── package.json                  # Dependencies, scripts, and build metadata
```

---

## Environment Variables

Create a `.env` file in the root directory:

```env
# Database (Neon Serverless Postgres)
DATABASE_URL=postgresql://<user>:<password>@<ep-project-id>.us-east-2.aws.neon.tech/neondb?sslmode=require

# Clerk Authentication
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SIGNING_SECRET=whsec_...

# Sentry Observability
EXPO_PUBLIC_SENTRY_DSN=https://...
SENTRY_AUTH_TOKEN=sntrys_...

# Inngest Background Jobs
INNGEST_DEV=true
```

---

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Database Migrations & Seeding

Ensure your database tables, procedures, and seed catalog are up to date:

```bash
# Generate migrations
npm run db:generate

# Apply migrations to Neon Postgres
npm run db:migrate

# Seed initial treatments, schedules, and chair capacity
npx tsx scripts/seed.ts
```

### 3. Start Background Workers

Run the local Inngest development server in a separate terminal:

```bash
npm run inngest:dev
```

### 4. Run the Development Client

Because Clerk native Google/Apple authentication requires native credentials, run the project in a development build:

```bash
# Start Metro bundler with cache cleared
npx expo start --clear

# Run directly on iOS Simulator
npm run ios

# Run directly on Android Emulator
npm run android
```

---

## Verification & Testing

Verify codebase correctness and stability using non-interactive checks:

```bash
# Type check all TypeScript files
npx tsc --noEmit

# Lint the codebase
npm run lint

# Run availability engine unit tests
npm test
```

---

## Architectural Rules & Decisions

* **Single Universal Repo**: Customer booking flow and API routes exist together in one codebase.
* **No Client Transactions**: Neon HTTP does not support client-managed transactions; all concurrent reservations use the `create_booking_safe` Postgres routine.
* **Zero Inline Styles**: Styling strictly utilizes NativeWind Tailwind classes; dynamic theme tokens are imported from `src/lib/theme/colors.ts`.
* **Native Tabs Only**: Navigation uses Expo Router's Native Tabs (`@expo/ui` / `unstable-native-tabs`) for native performance and look on iOS and Android.

---

## App Demo

<div align="center">

<video src="https://github.com/user-attachments/assets/94596507-d6b2-498b-8682-42eadd5ca5f7" width="700" controls muted></video>

</div>

---

<p align="center">
  <strong>Hydrate Booking App</strong> — Premium IV Therapy & Medical Wellness
</p>
```

**One caveat:** `muted` only works if GitHub actually renders that URL as an HTML `<video>` element. GitHub's normal uploaded-video renderer doesn't give you control over the audio state. If you want it **guaranteed silent**, the best solution is to remove the audio track from the actual video file and re-upload the muted version.
