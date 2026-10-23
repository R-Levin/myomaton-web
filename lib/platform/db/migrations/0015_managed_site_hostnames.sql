ALTER TABLE "managed_sites" ADD CONSTRAINT "managed_sites_owner_identity" UNIQUE("web_presence_id","id");
--> statement-breakpoint
CREATE TABLE "managed_site_hostnames" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hostname" text NOT NULL,
	"web_presence_id" uuid NOT NULL,
	"managed_site_id" uuid NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "managed_site_hostname_unique" UNIQUE("hostname"),
	CONSTRAINT "hostname_status" CHECK ("managed_site_hostnames"."status" IN ('active','inactive')),
	CONSTRAINT "hostname_normalized" CHECK (length("managed_site_hostnames"."hostname") >= 3 AND length("managed_site_hostnames"."hostname") <= 253 AND "managed_site_hostnames"."hostname" = lower("managed_site_hostnames"."hostname") AND "managed_site_hostnames"."hostname" ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$' AND "managed_site_hostnames"."hostname" !~ '(^|\.)xn--' AND "managed_site_hostnames"."hostname" !~ '^[0-9.]+$')
);
--> statement-breakpoint
ALTER TABLE "managed_site_hostnames" ADD CONSTRAINT "hostname_site_owner_fk" FOREIGN KEY ("web_presence_id","managed_site_id") REFERENCES "public"."managed_sites"("web_presence_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hostname_owner_site" ON "managed_site_hostnames" USING btree ("web_presence_id","managed_site_id");--> statement-breakpoint
