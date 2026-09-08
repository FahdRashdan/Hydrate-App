import { Inngest } from "inngest";

// Dev-only setup: no `eventKey`/`signingKey` here. With `INNGEST_DEV=1` set
// in .env, the SDK talks to the local Inngest Dev Server
// (`npx inngest-cli@latest dev`) instead of Inngest Cloud, so no
// INNGEST_EVENT_KEY / INNGEST_SIGNING_KEY is needed until Phase 6
// (see PLAN.md).
export const inngest = new Inngest({ id: "hydrate-app" });
