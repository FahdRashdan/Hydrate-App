import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";

// `neon-http` is required (not `node-postgres`) because this also runs on
// EAS Hosting / Cloudflare Workers, which has no raw TCP — see AGENTS.md.
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "Missing DATABASE_URL — add it to your .env file (Neon dashboard → Connection string).",
  );
}

const sql = neon(databaseUrl);

export const db = drizzle(sql, { schema });
