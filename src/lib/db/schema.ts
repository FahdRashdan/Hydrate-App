import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  smallint,
  text,
  time,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

// Synced from Clerk via `user.created`/`user.updated`/`user.deleted`
// webhooks -> Inngest functions (see src/app/api/webhooks/clerk+api.ts,
// src/lib/inngest/functions/sync-user-from-clerk.ts, and
// src/lib/inngest/functions/delete-user-from-clerk.ts). `clerkUserId` is the
// source of truth's primary key, so upserts key off it.
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  clerkUserId: text("clerk_user_id").notNull().unique(),
  email: text("email").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  // Collected once in onboarding (`onboarding/profile.tsx`), not
  // synced from Clerk — Clerk sign-in here is Google/Apple only, neither of
  // which reliably hands back a phone number.
  phone: text("phone"),
  imageUrl: text("image_url"),
  // Mirrors Clerk `publicMetadata.role` (set manually in the Clerk dashboard
  // for v1) so the app can role-gate without an extra Clerk API call.
  role: text("role").notNull().default("customer"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;

// ---------------------------------------------------------------------------
// Booking domain (PLAN.md Phase 1). Data model is location-scoped even
// though v1 seeds exactly one location (see src/lib/config/location.ts) —
// every table below carries a `locationId` FK for that reason.
// ---------------------------------------------------------------------------

export const locations = pgTable("locations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  address: text("address"),
  // IANA id, kept for future multi-location use. The engine and
  // `create_booking_safe` currently use the hardcoded BUSINESS_TIMEZONE
  // constant (src/lib/time/business-time.ts) rather than reading this
  // column — see that file's comment for why a fixed single-timezone
  // constant is deliberate for v1.
  timezone: text("timezone").notNull().default("Africa/Cairo"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Location = typeof locations.$inferSelect;

// Which weekdays a location is open, and the default hours for each. A
// `dateOverrides` row for a specific date takes precedence over this — see
// resolveEffectiveDayRules in src/lib/availability/engine.ts.
export const weeklySchedules = pgTable(
  "weekly_schedules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id),
    // 0 = Sunday .. 6 = Saturday, matching JS Date#getUTCDay() so date-string
    // math in business-time.ts needs no day-index translation.
    dayOfWeek: smallint("day_of_week").notNull(),
    isOpen: boolean("is_open").notNull().default(false),
    openTime: time("open_time"),
    closeTime: time("close_time"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("weekly_schedules_location_day_unique").on(t.locationId, t.dayOfWeek),
    check(
      "weekly_schedules_open_hours_check",
      sql`(${t.isOpen} = false) OR (${t.openTime} IS NOT NULL AND ${t.closeTime} IS NOT NULL AND ${t.openTime} < ${t.closeTime})`,
    ),
  ],
);

export type WeeklySchedule = typeof weeklySchedules.$inferSelect;

// A manager-set exception for one specific date — can close a normally-open
// day, open a normally-closed day with custom hours, or override the hours
// on an already-open day. Always wins over weeklySchedules for that date.
export const dateOverrides = pgTable(
  "date_overrides",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id),
    date: date("date", { mode: "string" }).notNull(),
    isOpen: boolean("is_open").notNull(),
    openTime: time("open_time"),
    closeTime: time("close_time"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("date_overrides_location_date_unique").on(t.locationId, t.date),
    check(
      "date_overrides_open_hours_check",
      sql`(${t.isOpen} = false) OR (${t.openTime} IS NOT NULL AND ${t.closeTime} IS NOT NULL AND ${t.openTime} < ${t.closeTime})`,
    ),
  ],
);

export type DateOverride = typeof dateOverrides.$inferSelect;

// Treatment availability is a simple active/inactive toggle in v1 — no
// per-treatment schedule or capacity (that's explicitly out of scope, see
// AGENTS.md / PLAN.md). Capacity is shared across all treatments via
// slotDefinitions below.
export const treatments = pgTable(
  "treatments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id),
    name: text("name").notNull(),
    description: text("description"),
    durationMinutes: integer("duration_minutes").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("treatments_location_active_idx").on(t.locationId, t.isActive)],
);

export type Treatment = typeof treatments.$inferSelect;

// Fixed time-of-day anchors (e.g. 9:00, 9:30, ...) with a shared capacity
// pool across all treatments — not a separate capacity_configs table, since
// capacity is a property of the slot anchor itself (single shared pool per
// the confirmed product decision in PLAN.md).
export const slotDefinitions = pgTable(
  "slot_definitions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id),
    startTime: time("start_time").notNull(),
    capacity: integer("capacity").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("slot_definitions_location_start_unique").on(t.locationId, t.startTime),
    index("slot_definitions_location_active_idx").on(t.locationId, t.isActive),
  ],
);

export type SlotDefinition = typeof slotDefinitions.$inferSelect;

// The manager-controlled bookable date range. One active window per
// location (no history table in v1 — a manager "opens/extends" it by
// updating this same row).
export const bookingWindows = pgTable(
  "booking_windows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id),
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("booking_windows_location_unique").on(t.locationId),
    check("booking_windows_range_check", sql`${t.endDate} >= ${t.startDate}`),
  ],
);

export type BookingWindow = typeof bookingWindows.$inferSelect;

export const bookingStatus = pgEnum("booking_status", ["pending", "confirmed", "cancelled"]);

// Created as "pending" (holds capacity immediately), manager manually
// confirms/cancels (no manager UI yet — see PLAN.md Phase 4, out of scope
// for this build). No auto-expiry, no customer self-cancel in v1.
//
// All concurrency-safe writes to this table go through the
// `create_booking_safe` Postgres function (src/lib/db/sql/create_booking_safe.sql)
// via `pg_advisory_xact_lock` — never a plain `db.insert()` from app code —
// because `drizzle-orm/neon-http` has no `db.transaction()` support (see
// AGENTS.md hard constraints).
export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => profiles.id),
    treatmentId: uuid("treatment_id")
      .notNull()
      .references(() => treatments.id),
    status: bookingStatus("status").notNull().default("pending"),
    date: date("date", { mode: "string" }).notNull(),
    startTime: time("start_time").notNull(),
    // Snapshotted as startTime + treatment.durationMinutes at booking time
    // (inside create_booking_safe), so a later treatment duration edit never
    // retroactively changes an existing booking's interval.
    endTime: time("end_time").notNull(),
    // Snapshotted from the confirm-step form, decoupled from `profiles` —
    // editing a profile later must not retroactively change past bookings.
    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("bookings_location_date_status_idx").on(t.locationId, t.date, t.status),
    index("bookings_customer_idx").on(t.customerId),
  ],
);

export type Booking = typeof bookings.$inferSelect;
export type NewBooking = typeof bookings.$inferInsert;
