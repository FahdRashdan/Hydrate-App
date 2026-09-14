// One-time (and safely re-runnable) local dev seed for the booking domain —
// stands in for what a manager would otherwise configure via the manager
// dashboard (PLAN.md Phase 4, not built). Run manually:
//
//   npx tsx --env-file=.env scripts/seed.ts
//
// (`--env-file` is Node's own .env loader — no `dotenv` dependency needed.
// `db/client.ts` reads `process.env.DATABASE_URL` directly.)
//
// Every insert uses onConflictDoNothing()/upsert keyed on the same natural
// uniqueness the schema enforces, so re-running this is a no-op past the
// first successful run rather than erroring or duplicating rows.
import { db } from "@/lib/db/client";
import {
  bookingWindows,
  dateOverrides,
  locations,
  slotDefinitions,
  treatments,
  weeklySchedules,
} from "@/lib/db/schema";
import { DEFAULT_LOCATION_ID } from "@/lib/config/location";
import { addDaysToDateString, toBusinessDateString, businessNow } from "@/lib/time/business-time";

async function main() {
  await db
    .insert(locations)
    .values({
      id: DEFAULT_LOCATION_ID,
      name: "Hydrate — Main Location",
      timezone: "Africa/Cairo",
      isActive: true,
    })
    .onConflictDoNothing();

  // Placeholder hours — trivially editable later, not a real confirmed
  // schedule. Closed Sunday (day 0), open Mon-Sat (days 1-6) 09:00-18:00.
  const weeklyRows = Array.from({ length: 7 }, (_, dayOfWeek) => ({
    locationId: DEFAULT_LOCATION_ID,
    dayOfWeek,
    isOpen: dayOfWeek !== 0,
    openTime: dayOfWeek !== 0 ? "09:00" : null,
    closeTime: dayOfWeek !== 0 ? "18:00" : null,
  }));
  await db
    .insert(weeklySchedules)
    .values(weeklyRows)
    .onConflictDoNothing({ target: [weeklySchedules.locationId, weeklySchedules.dayOfWeek] });

  // 30-minute slot anchors, 09:00 .. 17:30, capacity 2 each — placeholder.
  const slotRows: { locationId: string; startTime: string; capacity: number }[] = [];
  for (let totalMinutes = 9 * 60; totalMinutes < 18 * 60; totalMinutes += 30) {
    const hh = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
    const mm = String(totalMinutes % 60).padStart(2, "0");
    slotRows.push({ locationId: DEFAULT_LOCATION_ID, startTime: `${hh}:${mm}`, capacity: 2 });
  }
  await db
    .insert(slotDefinitions)
    .values(slotRows)
    .onConflictDoNothing({ target: [slotDefinitions.locationId, slotDefinitions.startTime] });

  const startDate = toBusinessDateString(businessNow());
  const endDate = addDaysToDateString(startDate, 60);
  await db
    .insert(bookingWindows)
    .values({ locationId: DEFAULT_LOCATION_ID, startDate, endDate })
    .onConflictDoUpdate({
      target: bookingWindows.locationId,
      set: { startDate, endDate, updatedAt: new Date() },
    });

  await db
    .insert(treatments)
    .values([
      {
        locationId: DEFAULT_LOCATION_ID,
        name: "Keratin Treatment",
        description: "Smoothing keratin treatment for frizz-free, healthier-looking hair.",
        durationMinutes: 90,
        isActive: true,
      },
      {
        locationId: DEFAULT_LOCATION_ID,
        name: "Deep Conditioning",
        description: "Intensive moisture treatment for dry or damaged hair.",
        durationMinutes: 45,
        isActive: true,
      },
      {
        locationId: DEFAULT_LOCATION_ID,
        name: "Scalp Treatment",
        description: "Soothing scalp treatment to relieve dryness and irritation.",
        durationMinutes: 30,
        isActive: true,
      },
    ])
    .onConflictDoNothing();

  console.log(`Seed complete — location ${DEFAULT_LOCATION_ID}, booking window ${startDate} .. ${endDate}.`);
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
