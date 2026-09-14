import { businessInstant } from "@/lib/time/business-time";

import { computeBookableSlots, resolveEffectiveDayRules, type BookingLike, type SlotDefinitionLike } from "./engine";

// Fixtures mirror scripts/seed.ts: closed Sunday, open Mon-Sat 09:00-18:00,
// 30-minute slot anchors 09:00..17:30, capacity 2 each. Dates below are
// fixed calendar dates with known weekdays: 2026-01-04 = Sunday,
// 2026-01-05 = Monday, 2026-01-06 = Tuesday, 2026-01-07 = Wednesday.
const WEEKLY_ROWS = [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
  dayOfWeek,
  isOpen: dayOfWeek !== 0,
  openTime: dayOfWeek !== 0 ? "09:00" : null,
  closeTime: dayOfWeek !== 0 ? "18:00" : null,
}));

function defaultSlotDefs(): SlotDefinitionLike[] {
  const slots: SlotDefinitionLike[] = [];
  for (let totalMinutes = 9 * 60; totalMinutes < 18 * 60; totalMinutes += 30) {
    const hh = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
    const mm = String(totalMinutes % 60).padStart(2, "0");
    slots.push({ startTime: `${hh}:${mm}`, capacity: 2 });
  }
  return slots;
}

const DEFAULT_WINDOW = { startDate: "2026-01-01", endDate: "2026-03-01" };
// Far enough in the past that the 48h lead-time check never blocks a test
// unless that test is specifically exercising it.
const FAR_PAST_NOW = new Date("2020-01-01T00:00:00Z");

function openDayRules(dateStr: string) {
  return resolveEffectiveDayRules(dateStr, WEEKLY_ROWS, null);
}

describe("resolveEffectiveDayRules", () => {
  test("weekday closed (Sunday) -> isOpen: false", () => {
    expect(resolveEffectiveDayRules("2026-01-04", WEEKLY_ROWS, null)).toEqual({
      isOpen: false,
      openTime: null,
      closeTime: null,
    });
  });

  test("no weekly row at all for that weekday -> isOpen: false", () => {
    expect(resolveEffectiveDayRules("2026-01-05", [], null)).toEqual({
      isOpen: false,
      openTime: null,
      closeTime: null,
    });
  });

  test("override closes a normally-open day", () => {
    const rules = resolveEffectiveDayRules("2026-01-05", WEEKLY_ROWS, {
      isOpen: false,
      openTime: null,
      closeTime: null,
    });
    expect(rules.isOpen).toBe(false);
  });

  test("override opens a normally-closed day with custom hours", () => {
    const rules = resolveEffectiveDayRules("2026-01-04", WEEKLY_ROWS, {
      isOpen: true,
      openTime: "10:00",
      closeTime: "14:00",
    });
    expect(rules).toEqual({ isOpen: true, openTime: "10:00", closeTime: "14:00" });
  });

  test("override with custom hours on an already-open day uses override hours, not weekly", () => {
    const rules = resolveEffectiveDayRules("2026-01-05", WEEKLY_ROWS, {
      isOpen: true,
      openTime: "08:00",
      closeTime: "12:00",
    });
    expect(rules).toEqual({ isOpen: true, openTime: "08:00", closeTime: "12:00" });
  });
});

describe("computeBookableSlots", () => {
  test("weekday closed (Sunday) -> no slots", () => {
    const slots = computeBookableSlots({
      dateStr: "2026-01-04",
      dayRules: openDayRules("2026-01-04"),
      bookingWindow: DEFAULT_WINDOW,
      treatmentDurationMinutes: 30,
      slotDefinitions: defaultSlotDefs(),
      existingBookings: [],
      now: FAR_PAST_NOW,
    });
    expect(slots).toEqual([]);
  });

  test("override closes a normally-open day -> no slots", () => {
    const dateStr = "2026-01-05";
    const dayRules = resolveEffectiveDayRules(dateStr, WEEKLY_ROWS, {
      isOpen: false,
      openTime: null,
      closeTime: null,
    });
    const slots = computeBookableSlots({
      dateStr,
      dayRules,
      bookingWindow: DEFAULT_WINDOW,
      treatmentDurationMinutes: 30,
      slotDefinitions: defaultSlotDefs(),
      existingBookings: [],
      now: FAR_PAST_NOW,
    });
    expect(slots).toEqual([]);
  });

  test("override opens a normally-closed day with custom hours -> only slots within those hours", () => {
    const dateStr = "2026-01-04"; // Sunday, normally closed
    const dayRules = resolveEffectiveDayRules(dateStr, WEEKLY_ROWS, {
      isOpen: true,
      openTime: "10:00",
      closeTime: "14:00",
    });
    const slots = computeBookableSlots({
      dateStr,
      dayRules,
      bookingWindow: DEFAULT_WINDOW,
      treatmentDurationMinutes: 30,
      slotDefinitions: defaultSlotDefs(),
      existingBookings: [],
      now: FAR_PAST_NOW,
    });
    expect(slots.length).toBeGreaterThan(0);
    expect(slots.every((s) => s.startTime >= "10:00" && s.endTime <= "14:00")).toBe(true);
    expect(slots.some((s) => s.startTime === "09:30")).toBe(false);
    expect(slots.some((s) => s.startTime === "10:00")).toBe(true);
  });

  test("override with custom hours on an already-open day uses override hours", () => {
    const dateStr = "2026-01-05"; // Monday, normally 09:00-18:00
    const dayRules = resolveEffectiveDayRules(dateStr, WEEKLY_ROWS, {
      isOpen: true,
      openTime: "08:00",
      closeTime: "12:00",
    });
    const slots = computeBookableSlots({
      dateStr,
      dayRules,
      bookingWindow: DEFAULT_WINDOW,
      treatmentDurationMinutes: 30,
      slotDefinitions: defaultSlotDefs(),
      existingBookings: [],
      now: FAR_PAST_NOW,
    });
    // Weekly hours would allow up to 17:30; the override's 12:00 close must win.
    expect(slots.some((s) => s.startTime >= "12:00")).toBe(false);
    expect(slots.some((s) => s.startTime === "11:30")).toBe(true);
  });

  test("slot extending past close time is excluded", () => {
    const dateStr = "2026-01-05"; // Monday, 09:00-18:00
    const slots = computeBookableSlots({
      dateStr,
      dayRules: openDayRules(dateStr),
      bookingWindow: DEFAULT_WINDOW,
      treatmentDurationMinutes: 90,
      slotDefinitions: defaultSlotDefs(),
      existingBookings: [],
      now: FAR_PAST_NOW,
    });
    // 17:00 + 90min = 18:30, past the 18:00 close.
    expect(slots.some((s) => s.startTime === "17:00")).toBe(false);
    // 16:30 + 90min = 18:00, exactly at close, still allowed.
    expect(slots.some((s) => s.startTime === "16:30")).toBe(true);
  });

  test("slot before open time is excluded", () => {
    const dateStr = "2026-01-05"; // Monday, opens 09:00
    const slotDefs: SlotDefinitionLike[] = [{ startTime: "08:30", capacity: 2 }, ...defaultSlotDefs()];
    const slots = computeBookableSlots({
      dateStr,
      dayRules: openDayRules(dateStr),
      bookingWindow: DEFAULT_WINDOW,
      treatmentDurationMinutes: 30,
      slotDefinitions: slotDefs,
      existingBookings: [],
      now: FAR_PAST_NOW,
    });
    expect(slots.some((s) => s.startTime === "08:30")).toBe(false);
    expect(slots.some((s) => s.startTime === "09:00")).toBe(true);
  });

  test("48h lead time: 47h59m out is excluded, exactly 48h00m is included", () => {
    const dateStr = "2026-01-07"; // Wednesday, 09:00-18:00
    const target = businessInstant(dateStr, "10:00");
    const oneMinuteShortOf48h = new Date(target.getTime() - (48 * 60 * 60 * 1000 - 60 * 1000));
    const exactly48h = new Date(target.getTime() - 48 * 60 * 60 * 1000);
    const slotDefs: SlotDefinitionLike[] = [{ startTime: "10:00", capacity: 2 }];

    const tooSoon = computeBookableSlots({
      dateStr,
      dayRules: openDayRules(dateStr),
      bookingWindow: DEFAULT_WINDOW,
      treatmentDurationMinutes: 30,
      slotDefinitions: slotDefs,
      existingBookings: [],
      now: oneMinuteShortOf48h,
    });
    expect(tooSoon).toEqual([]);

    const exactlyOnTime = computeBookableSlots({
      dateStr,
      dayRules: openDayRules(dateStr),
      bookingWindow: DEFAULT_WINDOW,
      treatmentDurationMinutes: 30,
      slotDefinitions: slotDefs,
      existingBookings: [],
      now: exactly48h,
    });
    expect(exactlyOnTime.some((s) => s.startTime === "10:00")).toBe(true);
  });

  test("date exactly on booking-window end is included; one day past is excluded", () => {
    const window = { startDate: "2026-01-01", endDate: "2026-01-05" }; // ends on a Monday (open)
    const onEnd = computeBookableSlots({
      dateStr: "2026-01-05",
      dayRules: openDayRules("2026-01-05"),
      bookingWindow: window,
      treatmentDurationMinutes: 30,
      slotDefinitions: defaultSlotDefs(),
      existingBookings: [],
      now: FAR_PAST_NOW,
    });
    expect(onEnd.length).toBeGreaterThan(0);

    const pastEnd = computeBookableSlots({
      dateStr: "2026-01-06", // Tuesday, also normally open, but past the window
      dayRules: openDayRules("2026-01-06"),
      bookingWindow: window,
      treatmentDurationMinutes: 30,
      slotDefinitions: defaultSlotDefs(),
      existingBookings: [],
      now: FAR_PAST_NOW,
    });
    expect(pastEnd).toEqual([]);
  });

  test("a long treatment reduces capacity for every slot instant it overlaps, not just its exact start", () => {
    const dateStr = "2026-01-05"; // Monday
    const existingBookings: BookingLike[] = [
      { startTime: "09:00", endTime: "10:30", status: "confirmed" },
    ];

    const slots = computeBookableSlots({
      dateStr,
      dayRules: openDayRules(dateStr),
      bookingWindow: DEFAULT_WINDOW,
      treatmentDurationMinutes: 30,
      slotDefinitions: defaultSlotDefs(),
      existingBookings,
      now: FAR_PAST_NOW,
    });

    // 09:30 and 10:00 never appear as an exact booking start, but the 90-minute
    // booking above covers both — capacity there must still be reduced.
    const at0930 = slots.find((s) => s.startTime === "09:30");
    expect(at0930?.remainingCapacity).toBe(1);
    const at1000 = slots.find((s) => s.startTime === "10:00");
    expect(at1000?.remainingCapacity).toBe(1);
    // 10:30 is not covered by the existing booking (end is exclusive) -> untouched.
    const at1030 = slots.find((s) => s.startTime === "10:30");
    expect(at1030?.remainingCapacity).toBe(2);
  });

  test("two partially-overlapping bookings count additively", () => {
    const dateStr = "2026-01-05";
    const existingBookings: BookingLike[] = [
      { startTime: "09:00", endTime: "09:45", status: "confirmed" },
      { startTime: "09:15", endTime: "10:00", status: "confirmed" },
    ];

    const slots = computeBookableSlots({
      dateStr,
      dayRules: openDayRules(dateStr),
      bookingWindow: DEFAULT_WINDOW,
      treatmentDurationMinutes: 30,
      slotDefinitions: defaultSlotDefs(),
      existingBookings,
      now: FAR_PAST_NOW,
    });

    // 09:30 is covered by both bookings -> capacity 2 fully consumed -> excluded.
    expect(slots.some((s) => s.startTime === "09:30")).toBe(false);
    // 09:00 is covered by only the first booking -> 1 remaining.
    expect(slots.find((s) => s.startTime === "09:00")?.remainingCapacity).toBe(1);
  });

  test("pending bookings count toward capacity the same as confirmed", () => {
    const dateStr = "2026-01-05";
    const existingBookings: BookingLike[] = [{ startTime: "09:00", endTime: "09:30", status: "pending" }];

    const slots = computeBookableSlots({
      dateStr,
      dayRules: openDayRules(dateStr),
      bookingWindow: DEFAULT_WINDOW,
      treatmentDurationMinutes: 30,
      slotDefinitions: defaultSlotDefs(),
      existingBookings,
      now: FAR_PAST_NOW,
    });

    expect(slots.find((s) => s.startTime === "09:00")?.remainingCapacity).toBe(1);
  });

  test("cancelled bookings don't count toward capacity", () => {
    const dateStr = "2026-01-05";
    const existingBookings: BookingLike[] = [{ startTime: "09:00", endTime: "09:30", status: "cancelled" }];

    const slots = computeBookableSlots({
      dateStr,
      dayRules: openDayRules(dateStr),
      bookingWindow: DEFAULT_WINDOW,
      treatmentDurationMinutes: 30,
      slotDefinitions: defaultSlotDefs(),
      existingBookings,
      now: FAR_PAST_NOW,
    });

    expect(slots.find((s) => s.startTime === "09:00")?.remainingCapacity).toBe(2);
  });

  test("zero slot definitions -> no slots", () => {
    const dateStr = "2026-01-05";
    const slots = computeBookableSlots({
      dateStr,
      dayRules: openDayRules(dateStr),
      bookingWindow: DEFAULT_WINDOW,
      treatmentDurationMinutes: 30,
      slotDefinitions: [],
      existingBookings: [],
      now: FAR_PAST_NOW,
    });
    expect(slots).toEqual([]);
  });
});
