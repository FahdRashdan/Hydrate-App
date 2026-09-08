import { eq } from "drizzle-orm";

import { getAuthContext } from "@/lib/auth/context";
import { db } from "@/lib/db/client";
import { profiles } from "@/lib/db/schema";

// First-time name/phone capture posts here from
// `(customer)/onboarding/profile.tsx` (PLAN.md Phase 2 — `/api/profile+api.ts`).
// The row itself is created by the Clerk `user.created` webhook
// (sync-user-from-clerk.ts) before this ever runs, so PUT only updates.
export async function GET(request: Request) {
  const auth = await getAuthContext(request);
  if (!auth) return new Response("Unauthorized", { status: 401 });

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.clerkUserId, auth.userId),
  });

  if (!profile) return new Response("Profile not found", { status: 404 });

  return Response.json(profile);
}

export async function PUT(request: Request) {
  const auth = await getAuthContext(request);
  if (!auth) return new Response("Unauthorized", { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const { firstName, lastName, phone } = (body ?? {}) as Record<string, unknown>;
  if (
    typeof firstName !== "string" ||
    !firstName.trim() ||
    typeof lastName !== "string" ||
    !lastName.trim() ||
    typeof phone !== "string" ||
    !phone.trim()
  ) {
    return new Response("firstName, lastName, and phone are required", { status: 422 });
  }

  const [updated] = await db
    .update(profiles)
    .set({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone.trim(),
      updatedAt: new Date(),
    })
    .where(eq(profiles.clerkUserId, auth.userId))
    .returning();

  // Row should already exist from the Clerk webhook sync; a miss here means
  // the webhook hasn't landed yet rather than a real 404 for the client.
  if (!updated) return new Response("Profile not found — try again shortly", { status: 404 });

  return Response.json(updated);
}
