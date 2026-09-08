import type { UserDeletedJSON } from "@clerk/backend";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { profiles } from "@/lib/db/schema";
import { inngest } from "@/lib/inngest/client";

// Deletes the mirrored profile when the Clerk user is deleted. Idempotent by
// nature (deleting a row that's already gone is a no-op), so retried webhook
// deliveries are safe.
export const deleteUserFromClerk = inngest.createFunction(
  { id: "delete-clerk-user", triggers: [{ event: "clerk/user.deleted" }] },
  async ({ event, step }) => {
    const user = event.data as UserDeletedJSON;

    if (!user.id) {
      throw new Error("Clerk user.deleted event missing user id");
    }

    await step.run("delete-profile", async () => {
      await db.delete(profiles).where(eq(profiles.clerkUserId, user.id as string));
    });
  },
);
