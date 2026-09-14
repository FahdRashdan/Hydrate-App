import { and, asc, eq } from "drizzle-orm";

import { getAuthContext } from "@/lib/auth/context";
import { DEFAULT_LOCATION_ID } from "@/lib/config/location";
import { db } from "@/lib/db/client";
import { treatments } from "@/lib/db/schema";

// Active treatments for the (single, v1) location — step 1 of the customer
// booking flow (`booking/treatment.tsx`).
export async function GET(request: Request) {
  const auth = await getAuthContext(request);
  if (!auth) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const rows = await db
    .select()
    .from(treatments)
    .where(and(eq(treatments.locationId, DEFAULT_LOCATION_ID), eq(treatments.isActive, true)))
    .orderBy(asc(treatments.name));

  return Response.json(rows);
}
