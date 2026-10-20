CREATE TABLE "activation_customer_bindings" (
	"case_id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"web_presence_id" uuid NOT NULL,
	"managed_site_id" uuid NOT NULL,
	"event_version" integer NOT NULL,
	"identity" jsonb NOT NULL,
	"identity_digest" text NOT NULL,
	CONSTRAINT "activation_binding_org_once" UNIQUE("organization_id"),
	CONSTRAINT "activation_binding_presence_once" UNIQUE("web_presence_id"),
	CONSTRAINT "activation_binding_site_once" UNIQUE("managed_site_id"),
	CONSTRAINT "activation_binding_bounds" CHECK ("activation_customer_bindings"."event_version" BETWEEN 2 AND 100 AND jsonb_typeof("activation_customer_bindings"."identity")='object' AND octet_length("activation_customer_bindings"."identity"::text)<=4096 AND "activation_customer_bindings"."identity_digest" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
ALTER TABLE "activation_case_events" DROP CONSTRAINT "activation_event_bounds";--> statement-breakpoint
ALTER TABLE "activation_customer_bindings" ADD CONSTRAINT "activation_customer_bindings_case_id_activation_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."activation_cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activation_customer_bindings" ADD CONSTRAINT "activation_customer_bindings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activation_customer_bindings" ADD CONSTRAINT "activation_customer_bindings_web_presence_id_web_presences_id_fk" FOREIGN KEY ("web_presence_id") REFERENCES "public"."web_presences"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activation_customer_bindings" ADD CONSTRAINT "activation_customer_bindings_managed_site_id_managed_sites_id_fk" FOREIGN KEY ("managed_site_id") REFERENCES "public"."managed_sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activation_customer_bindings" ADD CONSTRAINT "activation_binding_event_fk" FOREIGN KEY ("case_id","event_version") REFERENCES "public"."activation_case_events"("case_id","version") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activation_case_events" ADD CONSTRAINT "activation_event_bounds" CHECK ("activation_case_events"."version" BETWEEN 1 AND 100 AND "activation_case_events"."operation" IN ('create','confirm-commercial','assess','initialize-customer') AND octet_length("activation_case_events"."snapshot"::text)<=16384 AND "activation_case_events"."digest" ~ '^[a-f0-9]{64}$' AND "activation_case_events"."request_digest" ~ '^[a-f0-9]{64}$' AND length("activation_case_events"."actor") BETWEEN 1 AND 200 AND length("activation_case_events"."authority_reference") BETWEEN 1 AND 300);
--> statement-breakpoint
-- Deliberate SQL guards beyond the Drizzle catalog. All lookups use the current schema.
CREATE FUNCTION activation_customer_binding_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Canonical activation binding is immutable'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM activation_cases a
    JOIN activation_case_events e ON e.case_id=a.id AND e.version=NEW.event_version
    JOIN organizations o ON o.id=NEW.organization_id
    JOIN web_presences w ON w.id=NEW.web_presence_id AND w.organization_id=o.id
    JOIN managed_sites m ON m.id=NEW.managed_site_id AND m.web_presence_id=w.id
    WHERE a.id=NEW.case_id AND e.operation='initialize-customer'
    AND e.snapshot->>'status'='AUTHORIZED_FOR_ONBOARDING' AND e.snapshot->'commercial'<>'null'::jsonb
    AND o.status='inactive' AND w.status='inactive' AND m.status='inactive' AND w.primary_domain IS NULL
    AND o.name=NEW.identity->>'organizationName' AND w.name=NEW.identity->>'webPresenceName' AND m.name=NEW.identity->>'managedSiteName'
    AND NEW.identity->'confirmation'->>'confirmedBy'=e.actor
    AND o.metadata->'initialization'->>'kind'='customer-foundation/1'
    AND o.metadata->'initialization'->>'sourceReference'='activation-case:'||a.id::text
    AND o.metadata->'initialization'->'confirmation'=NEW.identity->'confirmation'
  ) OR EXISTS (SELECT 1 FROM business_knowledge WHERE web_presence_id=NEW.web_presence_id)
    OR EXISTS (SELECT 1 FROM offerings WHERE web_presence_id=NEW.web_presence_id)
  THEN RAISE EXCEPTION 'Canonical activation identity/owner/authority mismatch'; END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER activation_customer_binding_guard BEFORE INSERT OR UPDATE OR DELETE ON activation_customer_bindings FOR EACH ROW EXECUTE FUNCTION activation_customer_binding_guard();
--> statement-breakpoint
CREATE FUNCTION activation_customer_event_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM activation_customer_bindings b WHERE b.case_id=NEW.case_id AND b.event_version=NEW.version)
    OR NOT EXISTS (SELECT 1 FROM activation_case_events e WHERE e.case_id=NEW.case_id AND e.version=NEW.version-1
      AND e.snapshot=NEW.snapshot AND e.snapshot->>'status'='AUTHORIZED_FOR_ONBOARDING'
      AND e.snapshot->'commercial'<>'null'::jsonb)
  THEN RAISE EXCEPTION 'Canonical activation requires atomic binding and unchanged authorized assessment'; END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER activation_customer_event_guard AFTER INSERT ON activation_case_events DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN (NEW.operation='initialize-customer') EXECUTE FUNCTION activation_customer_event_guard();
