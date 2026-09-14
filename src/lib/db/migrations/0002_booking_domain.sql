CREATE TYPE "public"."booking_status" AS ENUM('pending', 'confirmed', 'cancelled');--> statement-breakpoint
CREATE TABLE "booking_windows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_windows_location_unique" UNIQUE("location_id"),
	CONSTRAINT "booking_windows_range_check" CHECK ("booking_windows"."end_date" >= "booking_windows"."start_date")
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"treatment_id" uuid NOT NULL,
	"status" "booking_status" DEFAULT 'pending' NOT NULL,
	"date" date NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"customer_name" text NOT NULL,
	"customer_phone" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "date_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"date" date NOT NULL,
	"is_open" boolean NOT NULL,
	"open_time" time,
	"close_time" time,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "date_overrides_location_date_unique" UNIQUE("location_id","date"),
	CONSTRAINT "date_overrides_open_hours_check" CHECK (("date_overrides"."is_open" = false) OR ("date_overrides"."open_time" IS NOT NULL AND "date_overrides"."close_time" IS NOT NULL AND "date_overrides"."open_time" < "date_overrides"."close_time"))
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"timezone" text DEFAULT 'Africa/Cairo' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "slot_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"start_time" time NOT NULL,
	"capacity" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "slot_definitions_location_start_unique" UNIQUE("location_id","start_time")
);
--> statement-breakpoint
CREATE TABLE "treatments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"duration_minutes" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weekly_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"day_of_week" smallint NOT NULL,
	"is_open" boolean DEFAULT false NOT NULL,
	"open_time" time,
	"close_time" time,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "weekly_schedules_location_day_unique" UNIQUE("location_id","day_of_week"),
	CONSTRAINT "weekly_schedules_open_hours_check" CHECK (("weekly_schedules"."is_open" = false) OR ("weekly_schedules"."open_time" IS NOT NULL AND "weekly_schedules"."close_time" IS NOT NULL AND "weekly_schedules"."open_time" < "weekly_schedules"."close_time"))
);
--> statement-breakpoint
ALTER TABLE "booking_windows" ADD CONSTRAINT "booking_windows_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_id_profiles_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_treatment_id_treatments_id_fk" FOREIGN KEY ("treatment_id") REFERENCES "public"."treatments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "date_overrides" ADD CONSTRAINT "date_overrides_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slot_definitions" ADD CONSTRAINT "slot_definitions_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatments" ADD CONSTRAINT "treatments_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_schedules" ADD CONSTRAINT "weekly_schedules_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bookings_location_date_status_idx" ON "bookings" USING btree ("location_id","date","status");--> statement-breakpoint
CREATE INDEX "bookings_customer_idx" ON "bookings" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "slot_definitions_location_active_idx" ON "slot_definitions" USING btree ("location_id","is_active");--> statement-breakpoint
CREATE INDEX "treatments_location_active_idx" ON "treatments" USING btree ("location_id","is_active");