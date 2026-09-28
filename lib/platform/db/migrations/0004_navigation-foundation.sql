CREATE TABLE "navigation_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"navigation_id" uuid NOT NULL,
	"parent_id" uuid,
	"name" text NOT NULL,
	"label" text NOT NULL,
	"target_type" text NOT NULL,
	"target_reference" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"configuration" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "navigation_items_navigation_id_name_unique" UNIQUE("navigation_id","name"),
	CONSTRAINT "navigation_items_navigation_id_id_unique" UNIQUE("navigation_id","id"),
	CONSTRAINT "navigation_items_not_own_parent" CHECK ("navigation_items"."parent_id" IS NULL OR "navigation_items"."parent_id" <> "navigation_items"."id")
);
--> statement-breakpoint
CREATE TABLE "navigations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"web_presence_id" uuid NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"configuration" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "navigations_web_presence_id_name_unique" UNIQUE("web_presence_id","name")
);
--> statement-breakpoint
ALTER TABLE "navigation_items" ADD CONSTRAINT "navigation_items_navigation_id_navigations_id_fk" FOREIGN KEY ("navigation_id") REFERENCES "public"."navigations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "navigation_items" ADD CONSTRAINT "navigation_items_same_navigation_parent_fk" FOREIGN KEY ("navigation_id","parent_id") REFERENCES "public"."navigation_items"("navigation_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "navigations" ADD CONSTRAINT "navigations_web_presence_id_web_presences_id_fk" FOREIGN KEY ("web_presence_id") REFERENCES "public"."web_presences"("id") ON DELETE no action ON UPDATE no action;