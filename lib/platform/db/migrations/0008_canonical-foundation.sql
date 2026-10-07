CREATE TABLE "business_knowledge" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"web_presence_id" uuid NOT NULL,
	"contract_version" integer DEFAULT 1 NOT NULL,
	"payload" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "business_knowledge_presence_unique" UNIQUE("web_presence_id"),
	CONSTRAINT "business_knowledge_owner_identity" UNIQUE("web_presence_id","id"),
	CONSTRAINT "business_knowledge_versions" CHECK ("business_knowledge"."version">0 AND "business_knowledge"."contract_version"=1),
	CONSTRAINT "business_knowledge_payload" CHECK (jsonb_typeof("business_knowledge"."payload")='object')
);
--> statement-breakpoint
CREATE TABLE "business_knowledge_revisions" (
	"web_presence_id" uuid NOT NULL,
	"revision_version" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"change_reason" text NOT NULL,
	"responsible_identity" text NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"knowledge_id" uuid NOT NULL,
	CONSTRAINT "knowledge_revision_unique" UNIQUE("knowledge_id","revision_version"),
	CONSTRAINT "knowledge_revision_version" CHECK ("business_knowledge_revisions"."revision_version">0),
	CONSTRAINT "knowledge_revision_snapshot" CHECK (jsonb_typeof("business_knowledge_revisions"."snapshot")='object'),
	CONSTRAINT "knowledge_revision_attestation" CHECK (length(btrim("business_knowledge_revisions"."change_reason")) BETWEEN 1 AND 1000 AND length(btrim("business_knowledge_revisions"."responsible_identity")) BETWEEN 1 AND 200)
);
--> statement-breakpoint
CREATE TABLE "offering_revisions" (
	"web_presence_id" uuid NOT NULL,
	"revision_version" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"change_reason" text NOT NULL,
	"responsible_identity" text NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"offering_id" uuid NOT NULL,
	CONSTRAINT "offering_revision_unique" UNIQUE("offering_id","revision_version"),
	CONSTRAINT "offering_revision_version" CHECK ("offering_revisions"."revision_version">0),
	CONSTRAINT "offering_revision_snapshot" CHECK (jsonb_typeof("offering_revisions"."snapshot")='object'),
	CONSTRAINT "offering_revision_attestation" CHECK (length(btrim("offering_revisions"."change_reason")) BETWEEN 1 AND 1000 AND length(btrim("offering_revisions"."responsible_identity")) BETWEEN 1 AND 200)
);
--> statement-breakpoint
CREATE TABLE "offerings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"web_presence_id" uuid NOT NULL,
	"contract_version" integer DEFAULT 1 NOT NULL,
	"payload" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"key" text NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"status" text NOT NULL,
	CONSTRAINT "offerings_presence_key" UNIQUE("web_presence_id","key"),
	CONSTRAINT "offerings_owner_identity" UNIQUE("web_presence_id","id"),
	CONSTRAINT "offerings_versions" CHECK ("offerings"."version">0 AND "offerings"."contract_version"=1),
	CONSTRAINT "offerings_payload" CHECK (jsonb_typeof("offerings"."payload")='object'),
	CONSTRAINT "offerings_type" CHECK ("offerings"."type" IN ('service','product')),
	CONSTRAINT "offerings_status" CHECK ("offerings"."status" IN ('active','inactive')),
	CONSTRAINT "offerings_key" CHECK ("offerings"."key" ~ '^[a-z][a-z0-9_-]{0,63}$'),
	CONSTRAINT "offerings_name" CHECK (length(btrim("offerings"."name")) BETWEEN 1 AND 200)
);
--> statement-breakpoint
ALTER TABLE "business_knowledge" ADD CONSTRAINT "business_knowledge_web_presence_id_web_presences_id_fk" FOREIGN KEY ("web_presence_id") REFERENCES "public"."web_presences"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_knowledge_revisions" ADD CONSTRAINT "business_knowledge_revisions_web_presence_id_knowledge_id_business_knowledge_web_presence_id_id_fk" FOREIGN KEY ("web_presence_id","knowledge_id") REFERENCES "public"."business_knowledge"("web_presence_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offering_revisions" ADD CONSTRAINT "offering_revisions_web_presence_id_offering_id_offerings_web_presence_id_id_fk" FOREIGN KEY ("web_presence_id","offering_id") REFERENCES "public"."offerings"("web_presence_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offerings" ADD CONSTRAINT "offerings_web_presence_id_web_presences_id_fk" FOREIGN KEY ("web_presence_id") REFERENCES "public"."web_presences"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE FUNCTION "public"."canonical_revision_immutable"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Canonical revisions are immutable; reviewed retention requires privileged administration'; END; $$;
--> statement-breakpoint
CREATE TRIGGER knowledge_revision_immutable BEFORE UPDATE OR DELETE ON "business_knowledge_revisions" FOR EACH ROW EXECUTE FUNCTION "public"."canonical_revision_immutable"();
--> statement-breakpoint
CREATE TRIGGER offering_revision_immutable BEFORE UPDATE OR DELETE ON "offering_revisions" FOR EACH ROW EXECUTE FUNCTION "public"."canonical_revision_immutable"();

--> statement-breakpoint
ALTER TABLE "business_knowledge_revisions" ADD CONSTRAINT "knowledge_revision_identity" CHECK (snapshot ? 'id' AND snapshot ? 'web_presence_id' AND snapshot ? 'version' AND snapshot->>'id'=knowledge_id::text AND snapshot->>'web_presence_id'=web_presence_id::text AND (snapshot->>'version')::integer=revision_version);
--> statement-breakpoint
ALTER TABLE "offering_revisions" ADD CONSTRAINT "offering_revision_identity" CHECK (snapshot ? 'id' AND snapshot ? 'web_presence_id' AND snapshot ? 'version' AND snapshot->>'id'=offering_id::text AND snapshot->>'web_presence_id'=web_presence_id::text AND (snapshot->>'version')::integer=revision_version);
