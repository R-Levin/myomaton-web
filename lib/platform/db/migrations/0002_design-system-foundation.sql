CREATE TABLE "design_systems" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"web_presence_id" uuid NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"configuration" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "design_systems" ADD CONSTRAINT "design_systems_web_presence_id_web_presences_id_fk" FOREIGN KEY ("web_presence_id") REFERENCES "public"."web_presences"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "design_systems_web_presence_active_unique" ON "design_systems" USING btree ("web_presence_id") WHERE "design_systems"."status" = 'active';