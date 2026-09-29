CREATE TABLE "asset_usages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"web_presence_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"role" text NOT NULL,
	"configuration" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "asset_usages_reference_unique" UNIQUE("web_presence_id","entity_type","entity_id","role","asset_id"),
	CONSTRAINT "asset_usages_entity_type_nonempty" CHECK (btrim("asset_usages"."entity_type") <> ''),
	CONSTRAINT "asset_usages_role_nonempty" CHECK (btrim("asset_usages"."role") <> ''),
	CONSTRAINT "asset_usages_version_positive" CHECK ("asset_usages"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"web_presence_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'image' NOT NULL,
	"mime_type" text NOT NULL,
	"width" integer,
	"height" integer,
	"alt_text" text,
	"status" text DEFAULT 'active' NOT NULL,
	"source_type" text NOT NULL,
	"source_reference" text NOT NULL,
	"configuration" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assets_web_presence_id_id_unique" UNIQUE("web_presence_id","id"),
	CONSTRAINT "assets_name_nonempty" CHECK (btrim("assets"."name") <> ''),
	CONSTRAINT "assets_type_nonempty" CHECK (btrim("assets"."type") <> ''),
	CONSTRAINT "assets_mime_type_nonempty" CHECK (btrim("assets"."mime_type") <> ''),
	CONSTRAINT "assets_source_type_nonempty" CHECK (btrim("assets"."source_type") <> ''),
	CONSTRAINT "assets_source_reference_nonempty" CHECK (btrim("assets"."source_reference") <> ''),
	CONSTRAINT "assets_width_positive" CHECK ("assets"."width" IS NULL OR "assets"."width" > 0),
	CONSTRAINT "assets_height_positive" CHECK ("assets"."height" IS NULL OR "assets"."height" > 0),
	CONSTRAINT "assets_version_positive" CHECK ("assets"."version" > 0)
);
--> statement-breakpoint
ALTER TABLE "asset_usages" ADD CONSTRAINT "asset_usages_same_web_presence_asset_fk" FOREIGN KEY ("web_presence_id","asset_id") REFERENCES "public"."assets"("web_presence_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_web_presence_id_web_presences_id_fk" FOREIGN KEY ("web_presence_id") REFERENCES "public"."web_presences"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "asset_usages_web_presence_asset_idx" ON "asset_usages" USING btree ("web_presence_id","asset_id");