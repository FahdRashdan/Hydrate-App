import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// Synced from Clerk via `user.created`/`user.updated`/`user.deleted`
// webhooks -> Inngest functions (see src/app/api/webhooks/clerk+api.ts,
// src/lib/inngest/functions/sync-user-from-clerk.ts, and
// src/lib/inngest/functions/delete-user-from-clerk.ts). `clerkUserId` is the
// source of truth's primary key, so upserts key off it.
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  clerkUserId: text("clerk_user_id").notNull().unique(),
  email: text("email").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  imageUrl: text("image_url"),
  // Mirrors Clerk `publicMetadata.role` (set manually in the Clerk dashboard
  // for v1) so the app can role-gate without an extra Clerk API call.
  role: text("role").notNull().default("customer"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
