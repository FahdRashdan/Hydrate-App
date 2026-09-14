import { desc, eq } from "drizzle-orm";

import { getAuthContext } from "@/lib/auth/context";
import { db } from "@/lib/db/client";
import { bookings, profiles, treatments } from "@/lib/db/schema";

// The customer's own bookings, newest-date-first — powers the Home tab's
// "current booking" status card (`(customer)/index.tsx`).
export async function GET(request: Request) {
  const auth = await getAuthContext(request);
  if (!auth) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const profile = await db.query.profiles.findFirst({ where: eq(profiles.clerkUserId, auth.userId) });
  // No profile row yet (webhook sync hasn't landed) — no bookings possible either way.
  if (!profile) return Response.json([]);

  try {
    const rows = await db
      .select({
        id: bookings.id,
        status: bookings.status,
        date: bookings.date,
        startTime: bookings.startTime,
        endTime: bookings.endTime,
        treatmentId: bookings.treatmentId,
        treatmentName: treatments.name,
        createdAt: bookings.createdAt,
      })
      .from(bookings)
      .innerJoin(treatments, eq(treatments.id, bookings.treatmentId))
      .where(eq(bookings.customerId, profile.id))
      .orderBy(desc(bookings.date), desc(bookings.startTime));

    return Response.json(rows);
  } catch (err) {
    console.error("Failed to query bookings:", err);
    return Response.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
