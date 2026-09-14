// Single fixed business timezone for v1 (confirmed with the user: Egypt).
// No DST handling — Egypt currently does not observe daylight saving, so a
// constant UTC offset is safe. If that ever changes, or the business
// expands to a DST-observing timezone, this whole module needs a real
// tz-aware date library (e.g. Temporal / date-fns-tz) instead of manual
// offset math.
//
// IMPORTANT: `create_booking_safe.sql` hardcodes the same
// `'Africa/Cairo'` timezone name in its 48h lead-time check (Postgres can't
// import this constant). These are two sources of truth for one fact — if
// this ever changes, that SQL function must be edited too.
export const BUSINESS_TIMEZONE = "Africa/Cairo";
export const BUSINESS_UTC_OFFSET_MINUTES = 120; // UTC+2, no DST
export const MIN_LEAD_TIME_HOURS = 48;

/** Current instant — a thin wrapper so call sites can inject `now` for tests. */
export function businessNow(): Date {
  return new Date();
}

/** Formats a UTC instant as the business-local "YYYY-MM-DD" calendar date. */
export function toBusinessDateString(instant: Date): string {
  const local = new Date(instant.getTime() + BUSINESS_UTC_OFFSET_MINUTES * 60_000);
  const y = local.getUTCFullYear();
  const m = String(local.getUTCMonth() + 1).padStart(2, "0");
  const d = String(local.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Combines a business-local "YYYY-MM-DD" date and "HH:MM" (or "HH:MM:SS")
 * time into the absolute UTC instant it represents.
 */
export function businessInstant(dateStr: string, timeStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [h, min, s] = timeStr.split(":").map(Number);
  const utcMs =
    Date.UTC(y, m - 1, d, h, min ?? 0, s ?? 0) - BUSINESS_UTC_OFFSET_MINUTES * 60_000;
  return new Date(utcMs);
}

/**
 * Normalizes a "HH:MM" or "HH:MM:SS" time-of-day string (Postgres `time`
 * columns round-trip as "HH:MM:SS") to zero-padded "HH:MM", so plain string
 * comparisons (`a < b`) are equivalent to numeric time-of-day comparisons.
 * The availability engine (engine.ts) requires every time string it's given
 * to already be in this normalized form.
 */
export function normalizeTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Adds `days` (may be negative) to a "YYYY-MM-DD" date string. */
export function addDaysToDateString(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/**
 * Adds `minutes` to an "HH:MM" (or "HH:MM:SS") time-of-day string. Does NOT
 * wrap past 24:00 — callers that need to detect a midnight rollover (e.g.
 * "does this booking extend past close?") must check the returned hour
 * themselves; this just returns whatever "HH:MM" the arithmetic produces,
 * clamped to a 0-23 hour by the caller's own overflow check.
 */
export function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const hh = String(Math.floor(total / 60) % 24).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

/** True if adding `minutes` to `time` would roll past 24:00 (into the next day). */
export function overflowsPastMidnight(time: string, minutes: number): boolean {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m + minutes >= 24 * 60;
}

/** 0 = Sunday .. 6 = Saturday for a business-local "YYYY-MM-DD" calendar date. */
export function dayOfWeekForDate(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** True if `dateStr`+`timeStr` is at least MIN_LEAD_TIME_HOURS after `now`. */
export function isAtLeastLeadTime(dateStr: string, timeStr: string, now: Date): boolean {
  const slotInstant = businessInstant(dateStr, timeStr);
  return slotInstant.getTime() - now.getTime() >= MIN_LEAD_TIME_HOURS * 60 * 60 * 1000;
}
