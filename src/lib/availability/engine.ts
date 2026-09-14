import {
  addMinutesToTime,
  dayOfWeekForDate,
  isAtLeastLeadTime,
  overflowsPastMidnight,
} from "@/lib/time/business-time";

// ---------------------------------------------------------------------------
// Pure functions only — no DB import anywhere in this file (deliberately,
// so it can be imported by engine.test.ts and run without a live database
// or DATABASE_URL). DB-fetching wrappers live in ./queries.ts instead,
// which import these functions rather than the other way around. Every
// time-of-day string passed in MUST already be normalized to "HH:MM" (see
// normalizeTime in business-time.ts) — ./queries.ts takes care of that at
// the DB boundary.
// ---------------------------------------------------------------------------

export type DayRules = {
  isOpen: boolean;
  openTime: string | null;
  closeTime: string | null;
};

type WeeklyRow = {
  dayOfWeek: number;
  isOpen: boolean;
  openTime: string | null;
  closeTime: string | null;
};

type OverrideRow = {
  isOpen: boolean;
  openTime: string | null;
  closeTime: string | null;
};

/**
 * A date override, when present for `dateStr`, always wins outright over the
 * weekly schedule — it can close a normally-open day, open a
 * normally-closed day with custom hours, or override the hours on an
 * already-open day.
 */
export function resolveEffectiveDayRules(
  dateStr: string,
  weeklyRows: WeeklyRow[],
  override: OverrideRow | null,
): DayRules {
  if (override) {
    return { isOpen: override.isOpen, openTime: override.openTime, closeTime: override.closeTime };
  }

  const dow = dayOfWeekForDate(dateStr);
  const weekly = weeklyRows.find((row) => row.dayOfWeek === dow);
  if (!weekly) return { isOpen: false, openTime: null, closeTime: null };

  return { isOpen: weekly.isOpen, openTime: weekly.openTime, closeTime: weekly.closeTime };
}

export type BookableSlot = {
  startTime: string;
  endTime: string;
  remainingCapacity: number;
};

export type BookingLike = {
  startTime: string;
  endTime: string;
  status: "pending" | "confirmed" | "cancelled";
};

export type SlotDefinitionLike = {
  startTime: string;
  capacity: number;
};

/**
 * Computes which slot-definition start times are actually bookable for one
 * date, for one treatment. A candidate start is excluded if: the day is
 * closed, the date falls outside the booking window, the treatment's
 * duration would roll the booking past midnight or past closing time, the
 * candidate starts before opening time, it's under the 48h minimum lead
 * time, or any slot-definition instant the booking's interval overlaps is
 * already at capacity (pending + confirmed bookings count identically;
 * cancelled bookings never count).
 */
export function computeBookableSlots(input: {
  dateStr: string;
  dayRules: DayRules;
  bookingWindow: { startDate: string; endDate: string } | null;
  treatmentDurationMinutes: number;
  /** Active slot definitions only — inactive ones are never candidates. */
  slotDefinitions: SlotDefinitionLike[];
  existingBookings: BookingLike[];
  now: Date;
}): BookableSlot[] {
  const { dateStr, dayRules, bookingWindow, treatmentDurationMinutes, slotDefinitions, existingBookings, now } =
    input;

  if (!dayRules.isOpen || !dayRules.openTime || !dayRules.closeTime) return [];
  if (!bookingWindow || dateStr < bookingWindow.startDate || dateStr > bookingWindow.endDate) return [];

  const activeBookings = existingBookings.filter((b) => b.status !== "cancelled");

  const result: BookableSlot[] = [];

  for (const candidate of slotDefinitions) {
    const startTime = candidate.startTime;

    if (overflowsPastMidnight(startTime, treatmentDurationMinutes)) continue;
    const endTime = addMinutesToTime(startTime, treatmentDurationMinutes);

    if (startTime < dayRules.openTime) continue;
    if (endTime > dayRules.closeTime) continue;
    if (!isAtLeastLeadTime(dateStr, startTime, now)) continue;

    // Every slot-definition instant this booking's interval would cover —
    // not just the exact start — must have remaining capacity.
    const covered = slotDefinitions.filter((sd) => sd.startTime >= startTime && sd.startTime < endTime);

    let remainingCapacity = Infinity;
    for (const sd of covered) {
      const overlapping = activeBookings.filter(
        (b) => b.startTime <= sd.startTime && b.endTime > sd.startTime,
      ).length;
      remainingCapacity = Math.min(remainingCapacity, sd.capacity - overlapping);
    }

    if (remainingCapacity > 0) {
      result.push({ startTime, endTime, remainingCapacity });
    }
  }

  result.sort((a, b) => a.startTime.localeCompare(b.startTime));
  return result;
}
