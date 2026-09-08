import { serve } from "inngest/edge";

import { inngest } from "@/lib/inngest/client";
import { deleteUserFromClerk } from "@/lib/inngest/functions/delete-user-from-clerk";
import { syncUserFromClerk } from "@/lib/inngest/functions/sync-user-from-clerk";

// `inngest/edge` is a generic Web-standard Request/Response handler, which is
// what `+api.ts` routes expect — this is what the local Inngest Dev Server
// (`npx inngest-cli@latest dev`) introspects and invokes.
const handler = serve({
  client: inngest,
  functions: [syncUserFromClerk, deleteUserFromClerk],
});

export { handler as GET, handler as POST, handler as PUT };
