import type { UserJSON } from "@clerk/backend";

import { db } from "@/lib/db/client";
import { profiles } from "@/lib/db/schema";
import { inngest } from "@/lib/inngest/client";

// Idempotent profile upsert keyed on `clerkUserId`, so retried webhook
// deliveries (Svix retries on failure) never create duplicates. Handles both
// `user.created` and `user.updated` — Clerk sends the same `UserJSON` shape
// for each, and "insert if missing, else update" is the correct behavior for
// both cases.
export const syncUserFromClerk = inngest.createFunction(
  {
    id: "sync-clerk-user",
    triggers: [{ event: "clerk/user.created" }, { event: "clerk/user.updated" }],
  },
  async ({ event, step }) => {
    const user = event.data as UserJSON;

    const primaryEmail =
      user.email_addresses.find((address) => address.id === user.primary_email_address_id)
        ?.email_address ?? user.email_addresses[0]?.email_address;

    if (!primaryEmail) {
      throw new Error(`Clerk user ${user.id} has no email address`);
    }

    const role =
      typeof user.public_metadata?.role === "string" ? user.public_metadata.role : "customer";

    await step.run("upsert-profile", async () => {
      await db
        .insert(profiles)
        .values({
          clerkUserId: user.id,
          email: primaryEmail,
          firstName: user.first_name,
          lastName: user.last_name,
          imageUrl: user.image_url,
          role,
        })
        .onConflictDoUpdate({
          target: profiles.clerkUserId,
          set: {
            email: primaryEmail,
            firstName: user.first_name,
            lastName: user.last_name,
            imageUrl: user.image_url,
            role,
            updatedAt: new Date(),
          },
        });
    });
  },
);
