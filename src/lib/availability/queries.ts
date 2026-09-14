import { and, eq, gte, lte } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { bookingWindows, bookings, dateOverrides, slotDefinitions, treatments, weeklySchedules } from "@/lib/db/schema";
import { addDaysToDateString, businessNow, dayOfWeekForDate, normalizeTime } from "@/lib/time/business-time";

import { computeBookableSlots, resolveEffectiveDayRules, type BookableSlot, type BookingLike, type SlotDefinitionLike } from "./engine";

// DB-fetching wrappers around the pure engine (./engine.ts) — deliberately
// kept in a separate module (not engine.ts itself) so engine.test.ts can
// import the pure functions without pulling in `db/client.ts`, which throws
// if `DATABASE_URL` isn't set (a live database is never needed to run the
// engine's unit tests). Each function below does one query per table (not
// one per candidate date) and normalizes every time string before handing
// it to the pure functions.

async function loadTreatment(locationId: string, treatmentId: string) {
  const [treatment] = await db
    .select()
    .from(treatments)
    .where(and(eq(treatments.id, treatmentId), eq(treatments.locationId, locationId), eq(treatments.isActive, true)));
  return treatment ?? null;
}

async function loadBookingWindow(locationId: string) {
  const [window] = await db.select().from(bookingWindows).where(eq(bookingWindows.locationId, locationId));
  return window ?? null;
}

async function loadActiveSlotDefinitions(locationId: string): Promise<SlotDefinitionLike[]> {
  const rows = await db
    .select()
    .from(slotDefinitions)
    .where(and(eq(slotDefinitions.locationId, locationId), eq(slotDefinitions.isActive, true)));
  return rows.map((r) => ({ startTime: normalizeTime(r.startTime), capacity: r.capacity }));
}

export async function getBookableSlotsForDate(
  locationId: string,
  treatmentId: string,
  dateStr: string,
): Promise<BookableSlot[]> {
  const treatment = await loadTreatment(locationId, treatmentId);
  if (!treatment) return [];

  const window = await loadBookingWindow(locationId);
  if (!window) return [];

  const dow = dayOfWeekForDate(dateStr);
  const [weeklyRow] = await db
    .select()
    .from(weeklySchedules)
    .where(and(eq(weeklySchedules.locationId, locationId), eq(weeklySchedules.dayOfWeek, dow)));
  const [overrideRow] = await db
    .select()
    .from(dateOverrides)
    .where(and(eq(dateOverrides.locationId, locationId), eq(dateOverrides.date, dateStr)));

  const dayRules = resolveEffectiveDayRules(dateStr, weeklyRow ? [weeklyRow] : [], overrideRow ?? null);
  const slotDefs = await loadActiveSlotDefinitions(locationId);

  const dayBookings = await db
    .select()
    .from(bookings)
    .where(and(eq(bookings.locationId, locationId), eq(bookings.date, dateStr)));

  return computeBookableSlots({
    dateStr,
    dayRules,
    bookingWindow: { startDate: window.startDate, endDate: window.endDate },
    treatmentDurationMinutes: treatment.durationMinutes,
    slotDefinitions: slotDefs,
    existingBookings: dayBookings.map((b) => ({
      startTime: normalizeTime(b.startTime),
      endTime: normalizeTime(b.endTime),
      status: b.status,
    })),
    now: businessNow(),
  });
}

export async function getBookableDates(locationId: string, treatmentId: string): Promise<string[]> {
  const treatment = await loadTreatment(locationId, treatmentId);
  if (!treatment) return [];

  const window = await loadBookingWindow(locationId);
  if (!window) return [];

  const weeklyRows = await db.select().from(weeklySchedules).where(eq(weeklySchedules.locationId, locationId));
  const overrideRows = await db
    .select()
    .from(dateOverrides)
    .where(
      and(
        eq(dateOverrides.locationId, locationId),
        gte(dateOverrides.date, window.startDate),
        lte(dateOverrides.date, window.endDate),
      ),
    );
  const overridesByDate = new Map(overrideRows.map((o) => [o.date, o]));

  const slotDefs = await loadActiveSlotDefinitions(locationId);

  const windowBookings = await db
    .select()
    .from(bookings)
    .where(
      and(
        eq(bookings.locationId, locationId),
        gte(bookings.date, window.startDate),
        lte(bookings.date, window.endDate),
      ),
    );
  const bookingsByDate = new Map<string, BookingLike[]>();
  for (const b of windowBookings) {
    const list = bookingsByDate.get(b.date) ?? [];
    list.push({ startTime: normalizeTime(b.startTime), endTime: normalizeTime(b.endTime), status: b.status });
    bookingsByDate.set(b.date, list);
  }

  const now = businessNow();
  const bookableDates: string[] = [];
  let cursor = window.startDate;
  while (cursor <= window.endDate) {
    const dow = dayOfWeekForDate(cursor);
    const weeklyRow = weeklyRows.find((r) => r.dayOfWeek === dow);
    const dayRules = resolveEffectiveDayRules(cursor, weeklyRow ? [weeklyRow] : [], overridesByDate.get(cursor) ?? null);

    const slots = computeBookableSlots({
      dateStr: cursor,
      dayRules,
      bookingWindow: { startDate: window.startDate, endDate: window.endDate },
      treatmentDurationMinutes: treatment.durationMinutes,
      slotDefinitions: slotDefs,
      existingBookings: bookingsByDate.get(cursor) ?? [],
      now,
    });
    if (slots.length > 0) bookableDates.push(cursor);

    cursor = addDaysToDateString(cursor, 1);
  }

  return bookableDates;
}
