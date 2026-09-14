import { getAuthContext } from "@/lib/auth/context";
import { getBookableSlotsForDate } from "@/lib/availability/queries";
import { DEFAULT_LOCATION_ID } from "@/lib/config/location";

// Step 3 of the booking flow (`booking/slot.tsx`) — every bookable start
// time on one date, for one treatment, with remaining capacity per slot.
export async function GET(request: Request) {
  const auth = await getAuthContext(request);
  if (!auth) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const treatmentId = searchParams.get("treatmentId");
  const date = searchParams.get("date");
  if (!treatmentId || !date) {
    return Response.json({ error: "MISSING_PARAMS" }, { status: 400 });
  }

  const slots = await getBookableSlotsForDate(DEFAULT_LOCATION_ID, treatmentId, date);
  return Response.json({ slots });
}
