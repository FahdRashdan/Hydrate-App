import { verifyWebhook } from "@clerk/backend/webhooks";

import { inngest } from "@/lib/inngest/client";

// Clerk has no official Expo Router (`+api.ts`) integration, so this is
// verified directly with `@clerk/backend/webhooks` (reads
// CLERK_WEBHOOK_SIGNING_SECRET from .env) rather than a framework adapter.
// Point the Clerk Dashboard endpoint at <ngrok-url>/api/webhooks/clerk.
export async function POST(request: Request) {
  let event;
  try {
    event = await verifyWebhook(request);
  } catch (err) {
    console.error("Clerk webhook verification failed:", err);
    return new Response("Webhook verification failed", { status: 400 });
  }

  if (event.type === "user.created" || event.type === "user.updated") {
    // Hand off to Inngest so the DB write happens in the background function
    // (src/lib/inngest/functions/sync-user-from-clerk.ts), not on the
    // webhook request itself.
    await inngest.send({
      name: `clerk/${event.type}`,
      data: event.data,
    });
  }

  if (event.type === "user.deleted") {
    // Hand off to Inngest (src/lib/inngest/functions/delete-user-from-clerk.ts)
    // to remove the mirrored profile row.
    await inngest.send({
      name: "clerk/user.deleted",
      data: event.data,
    });
  }

  // Ack everything else too so Svix doesn't retry event types we don't handle.
  return new Response("OK", { status: 200 });
}
