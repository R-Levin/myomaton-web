CREATE TABLE "contact_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"web_presence_id" uuid NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"configuration" jsonb NOT NULL,
	"delivery_route_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contact_definitions_owner_identity" UNIQUE("web_presence_id","id"),
	CONSTRAINT "contact_definitions_version_positive" CHECK ("contact_definitions"."version" > 0),
	CONSTRAINT "contact_definitions_name_bounded" CHECK (length(trim("contact_definitions"."name")) BETWEEN 1 AND 200),
	CONSTRAINT "contact_definitions_status" CHECK ("contact_definitions"."status" IN ('active','inactive')),
	CONSTRAINT "contact_definitions_configuration_object" CHECK (jsonb_typeof("contact_definitions"."configuration") = 'object'),
	CONSTRAINT "contact_definitions_route" CHECK ("contact_definitions"."delivery_route_key" IS NULL OR "contact_definitions"."delivery_route_key" ~ '^[a-z][a-z0-9_-]{0,63}$')
);
--> statement-breakpoint
CREATE TABLE "contact_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"web_presence_id" uuid NOT NULL,
	"managed_site_id" uuid NOT NULL,
	"page_id" uuid,
	"section_id" uuid,
	"contact_definition_id" uuid NOT NULL,
	"contact_definition_version" integer NOT NULL,
	"fields" jsonb NOT NULL,
	"delivery_route_key" text,
	"delivery_status" text NOT NULL,
	"delivery_attempts" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"delivery_error_code" text,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "contact_submissions_idempotency" UNIQUE("web_presence_id","contact_definition_id","idempotency_key"),
	CONSTRAINT "contact_submissions_version_positive" CHECK ("contact_submissions"."contact_definition_version" > 0),
	CONSTRAINT "contact_submissions_fields_object" CHECK (jsonb_typeof("contact_submissions"."fields") = 'object' AND octet_length("contact_submissions"."fields"::text) <= 16384),
	CONSTRAINT "contact_submissions_delivery_status" CHECK ("contact_submissions"."delivery_status" IN ('pending','delivered','failed','disabled')),
	CONSTRAINT "contact_submissions_attempts" CHECK ("contact_submissions"."delivery_attempts" >= 0),
	CONSTRAINT "contact_submissions_route" CHECK (("contact_submissions"."delivery_status" = 'disabled' AND "contact_submissions"."delivery_route_key" IS NULL) OR ("contact_submissions"."delivery_status" <> 'disabled' AND "contact_submissions"."delivery_route_key" IS NOT NULL AND "contact_submissions"."delivery_route_key" ~ '^[a-z][a-z0-9_-]{0,63}$')),
	CONSTRAINT "contact_submissions_error" CHECK ("contact_submissions"."delivery_error_code" IS NULL OR "contact_submissions"."delivery_error_code" ~ '^[a-z][a-z0-9_]{0,63}$'),
	CONSTRAINT "contact_submissions_key" CHECK ("contact_submissions"."idempotency_key" ~ '^[A-Za-z0-9_-]{16,100}$'),
	CONSTRAINT "contact_submissions_expiry_after_creation" CHECK ("contact_submissions"."expires_at" > "contact_submissions"."created_at")
);
--> statement-breakpoint
ALTER TABLE "contact_definitions" ADD CONSTRAINT "contact_definitions_web_presence_id_web_presences_id_fk" FOREIGN KEY ("web_presence_id") REFERENCES "public"."web_presences"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_submissions" ADD CONSTRAINT "contact_submissions_web_presence_id_web_presences_id_fk" FOREIGN KEY ("web_presence_id") REFERENCES "public"."web_presences"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_submissions" ADD CONSTRAINT "contact_submissions_managed_site_id_managed_sites_id_fk" FOREIGN KEY ("managed_site_id") REFERENCES "public"."managed_sites"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_submissions" ADD CONSTRAINT "contact_submissions_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_submissions" ADD CONSTRAINT "contact_submissions_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."sections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_submissions" ADD CONSTRAINT "contact_submissions_definition_owner_fk" FOREIGN KEY ("web_presence_id","contact_definition_id") REFERENCES "public"."contact_definitions"("web_presence_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contact_submissions_owner_created" ON "contact_submissions" USING btree ("web_presence_id","created_at");--> statement-breakpoint
CREATE INDEX "contact_submissions_expiry" ON "contact_submissions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "contact_submissions_pending" ON "contact_submissions" USING btree ("created_at") WHERE "contact_submissions"."delivery_status" = 'pending';