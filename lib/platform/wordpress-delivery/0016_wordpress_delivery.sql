CREATE TABLE "wordpress_deliveries" (
	"installation_id" uuid PRIMARY KEY NOT NULL,
	"release_id" uuid NOT NULL,
	"generation" integer NOT NULL,
	"source_digest" text NOT NULL,
  "projection_digest" text NOT NULL,
	"envelope" text NOT NULL,
	"envelope_sha256" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"staged_at" timestamp with time zone,
	CONSTRAINT "wordpress_delivery_bounds" CHECK (octet_length("wordpress_deliveries"."envelope") <= 1048576
    AND "wordpress_deliveries"."source_digest" ~ '^[0-9a-f]{64}$' AND "wordpress_deliveries"."projection_digest" ~ '^[0-9a-f]{64}$' AND "wordpress_deliveries"."envelope_sha256" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "wordpress_delivery_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"installation_id" uuid NOT NULL,
	"action" text NOT NULL,
	"actor" text NOT NULL,
	"release_id" uuid,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wordpress_installation_keys" (
	"installation_id" uuid NOT NULL,
	"generation" integer NOT NULL,
	"key_id" text NOT NULL,
	"public_key" text NOT NULL,
	"credential_id" uuid NOT NULL,
	CONSTRAINT "wordpress_installation_keys_installation_id_generation_pk" PRIMARY KEY("installation_id","generation"),
	CONSTRAINT "wordpress_installation_signing_key" UNIQUE("installation_id","key_id"),
	CONSTRAINT "wordpress_installation_credential" UNIQUE("credential_id")
);
--> statement-breakpoint
CREATE TABLE "wordpress_installations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"web_presence_id" uuid NOT NULL,
	"managed_site_id" uuid NOT NULL,
	"origin" text NOT NULL,
	"generation" integer NOT NULL,
	"status" text NOT NULL,
	CONSTRAINT "wordpress_installation_origin" UNIQUE("origin"),
	CONSTRAINT "wordpress_installation_status" CHECK ("wordpress_installations"."generation" > 0 AND "wordpress_installations"."status" IN ('active','revoked'))
);
--> statement-breakpoint
CREATE TABLE "wordpress_request_nonces" (
	"installation_id" uuid NOT NULL,
	"nonce" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "wordpress_request_nonces_installation_id_nonce_pk" PRIMARY KEY("installation_id","nonce")
);
--> statement-breakpoint
ALTER TABLE "wordpress_deliveries" ADD CONSTRAINT "wordpress_deliveries_installation_id_wordpress_installations_id_fk" FOREIGN KEY ("installation_id") REFERENCES "wordpress_installations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wordpress_deliveries" ADD CONSTRAINT "wordpress_deliveries_release_id_site_content_events_id_fk" FOREIGN KEY ("release_id") REFERENCES "site_content_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wordpress_deliveries" ADD CONSTRAINT "wordpress_delivery_key_fk" FOREIGN KEY ("installation_id","generation") REFERENCES "wordpress_installation_keys"("installation_id","generation") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wordpress_delivery_events" ADD CONSTRAINT "wordpress_delivery_events_installation_id_wordpress_installations_id_fk" FOREIGN KEY ("installation_id") REFERENCES "wordpress_installations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wordpress_installation_keys" ADD CONSTRAINT "wordpress_installation_keys_installation_id_wordpress_installations_id_fk" FOREIGN KEY ("installation_id") REFERENCES "wordpress_installations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wordpress_installations" ADD CONSTRAINT "wordpress_installations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wordpress_installations" ADD CONSTRAINT "wordpress_installation_site_fk" FOREIGN KEY ("web_presence_id","managed_site_id") REFERENCES "managed_sites"("web_presence_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wordpress_request_nonces" ADD CONSTRAINT "wordpress_request_nonces_installation_id_wordpress_installations_id_fk" FOREIGN KEY ("installation_id") REFERENCES "wordpress_installations"("id") ON DELETE no action ON UPDATE no action;