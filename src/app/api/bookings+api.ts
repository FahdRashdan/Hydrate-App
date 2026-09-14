import { eq, sql } from "drizzle-orm";

import { getAuthContext } from "@/lib/auth/context";
import { DEFAULT_LOCATION_ID } from "@/lib/config/location";
import { db } from "@/lib/db/client";
import { profiles } from "@/lib/db/schema";

// Every rejection `create_booking_safe` can return, mapped to an HTTP
// status — see src/lib/db/sql/create_booking_safe.sql for what triggers
// each. SLOT_FULL is the only 409 (a legitimate race with another
// customer); everything else is a stale/invalid request (422).
const ERROR_STATUS: Record<string, number> = {
  SLOT_FULL: 409,
  LOCATION_INACTIVE: 422,
  TREATMENT_INACTIVE: 422,
  OUTSIDE_BOOKING_WINDOW: 422,
  LEAD_TIME_TOO_SHORT: 422,
  DAY_CLOSED: 422,
  OUTSIDE_BUSINESS_HOURS: 422,
  INVALID_SLOT: 422,
  INVALID_TIME_RANGE: 422,
};

type CreateBookingSafeRow = {
  ok: boolean;
  error_code: string | null;
  booking: unknown;
};

// Step 4 of the booking flow (`booking/confirm.tsx`) — the only place
// `bookings` rows are ever written. Delegates all validation + the actual
// insert to `create_booking_safe` (a single Postgres function call, since
// `drizzle-orm/neon-http` has no `db.transaction()` — see AGENTS.md).
export async function POST(request: Request) {
  const auth = await getAuthContext(request);
  if (!auth) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const { treatmentId, date, startTime, customerName, customerPhone } = (body ?? {}) as Record<
    string,
    unknown
  >;
  if (
    typeof treatmentId !== "string" ||
    !treatmentId ||
    typeof date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    typeof startTime !== "string" ||
    !/^\d{2}:\d{2}$/.test(startTime) ||
    typeof customerName !== "string" ||
    !customerName.trim() ||
    typeof customerPhone !== "string" ||
    !customerPhone.trim()
  ) {
    return Response.json({ error: "INVALID_BODY" }, { status: 422 });
  }

  // Row should already exist from the Clerk webhook sync (see
  // /api/profile+api.ts's identical comment) — a miss means it hasn't
  // landed yet, not that the customer genuinely has no profile.
  const profile = await db.query.profiles.findFirst({ where: eq(profiles.clerkUserId, auth.userId) });
  if (!profile) {
    return Response.json({ error: "PROFILE_NOT_FOUND" }, { status: 404 });
  }

  let row: CreateBookingSafeRow | undefined;
  try {
    const result = await db.execute<CreateBookingSafeRow>(sql`
      select * from create_booking_safe(
        ${DEFAULT_LOCATION_ID}::uuid,
        ${treatmentId}::uuid,
        ${profile.id}::uuid,
        ${customerName.trim()}::text,
        ${customerPhone.trim()}::text,
        ${date}::date,
        ${startTime}::time
      )
    `);
    row = result.rows[0];
  } catch (err) {
    console.error("create_booking_safe call failed:", err);
    return Response.json({ error: "INVALID_BODY" }, { status: 422 });
  }

  if (!row || !row.ok) {
    const code = row?.error_code ?? "UNKNOWN_ERROR";
    return Response.json({ error: code }, { status: ERROR_STATUS[code] ?? 500 });
  }

  const booking = typeof row.booking === "string" ? JSON.parse(row.booking) : row.booking;
  return Response.json(booking, { status: 201 });
}
