import { getAuthContext } from "@/lib/auth/context";
import { getBookableDates } from "@/lib/availability/queries";
import { DEFAULT_LOCATION_ID } from "@/lib/config/location";

// Step 2 of the booking flow (`booking/date.tsx`) — every bookable date for
// the chosen treatment, within the manager's open booking window.
export async function GET(request: Request) {
  const auth = await getAuthContext(request);
  if (!auth) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const treatmentId = new URL(request.url).searchParams.get("treatmentId");
  if (!treatmentId) return Response.json({ error: "MISSING_TREATMENT_ID" }, { status: 400 });

  const dates = await getBookableDates(DEFAULT_LOCATION_ID, treatmentId);
  return Response.json({ dates });
}
