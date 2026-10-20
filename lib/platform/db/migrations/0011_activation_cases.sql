CREATE TABLE "activation_case_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"request_id" uuid NOT NULL,
	"request_digest" text NOT NULL,
	"operation" text NOT NULL,
	"actor" text NOT NULL,
	"authority_reference" text NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"previous" text,
	"digest" text NOT NULL,
	"snapshot" jsonb NOT NULL,
	CONSTRAINT "activation_event_version" UNIQUE("case_id","version"),
	CONSTRAINT "activation_event_request" UNIQUE("case_id","request_id"),
	CONSTRAINT "activation_event_bounds" CHECK ("activation_case_events"."version" BETWEEN 1 AND 100 AND "activation_case_events"."operation" IN ('create','confirm-commercial','assess') AND octet_length("activation_case_events"."snapshot"::text)<=16384 AND "activation_case_events"."digest" ~ '^[a-f0-9]{64}$' AND "activation_case_events"."request_digest" ~ '^[a-f0-9]{64}$' AND length("activation_case_events"."actor") BETWEEN 1 AND 200 AND length("activation_case_events"."authority_reference") BETWEEN 1 AND 300)
);
--> statement-breakpoint
CREATE TABLE "activation_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"web_presence_id" uuid NOT NULL,
	"managed_site_id" uuid NOT NULL,
	"pending_customer_id" uuid NOT NULL,
	"submission_id" uuid NOT NULL,
	"source" jsonb NOT NULL,
	"review" jsonb,
	"request_id" uuid NOT NULL,
	"request_digest" text NOT NULL,
	"created_by" text NOT NULL,
	"authority_reference" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "activation_case_source_once" UNIQUE("submission_id"),
	CONSTRAINT "activation_case_pending_once" UNIQUE("pending_customer_id"),
	CONSTRAINT "activation_case_request" UNIQUE("web_presence_id","request_id"),
	CONSTRAINT "activation_case_bounds" CHECK (octet_length("activation_cases"."source"::text)<=2048 AND octet_length("activation_cases"."review"::text)<=2048 AND "activation_cases"."request_digest" ~ '^[a-f0-9]{64}$' AND length("activation_cases"."created_by") BETWEEN 1 AND 200 AND length("activation_cases"."authority_reference") BETWEEN 1 AND 300)
);
--> statement-breakpoint
ALTER TABLE "activation_case_events" ADD CONSTRAINT "activation_case_events_case_id_activation_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."activation_cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activation_cases" ADD CONSTRAINT "activation_cases_submission_id_prospect_intake_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."prospect_intake_submissions"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
-- Deliberate append-only/source guards beyond the generated Drizzle catalog.
CREATE FUNCTION activation_case_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Activation identity/history is immutable'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM prospect_intake_submissions s JOIN prospect_intakes i ON i.id=s.intake_id AND i.web_presence_id=s.web_presence_id
    WHERE s.id=NEW.submission_id AND s.web_presence_id=NEW.web_presence_id AND i.managed_site_id=NEW.managed_site_id
    AND i.state='needs_operator_review' AND s.state='submitted'
    AND NEW.source=jsonb_build_object('submissionId',s.id,'intakeId',s.intake_id,'digest',s.digest,'questionnaireVersion',s.questionnaire_version,'draftVersion',s.draft_version,'path',s.entry_intent)
  ) THEN RAISE EXCEPTION 'Activation immutable source/owner mismatch'; END IF;
  IF NEW.review IS NOT NULL AND NEW.source->>'path'<>'FREE_REVIEW' THEN RAISE EXCEPTION 'Direct Start has no Review dependency'; END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER activation_case_guard BEFORE INSERT OR UPDATE OR DELETE ON activation_cases FOR EACH ROW EXECUTE FUNCTION activation_case_guard();
--> statement-breakpoint
CREATE FUNCTION activation_event_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE last_event activation_case_events%ROWTYPE;
BEGIN
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Activation identity/history is immutable'; END IF;
  PERFORM 1 FROM activation_cases WHERE id=NEW.case_id FOR UPDATE;
  SELECT * INTO last_event FROM activation_case_events WHERE case_id=NEW.case_id ORDER BY version DESC LIMIT 1;
  IF NEW.version<>coalesce(last_event.version,0)+1 OR NEW.previous IS DISTINCT FROM last_event.digest
    OR (NEW.version=1 AND (NEW.operation<>'create' OR NEW.snapshot->>'status'<>'PENDING_COMMERCIAL' OR NEW.snapshot->'commercial'<>'null'::jsonb))
    OR (NEW.version>1 AND NEW.operation='create')
    OR NOT (NEW.snapshot ?& ARRAY['status','commercial','assessment'])
    OR (NEW.snapshot - ARRAY['status','commercial','assessment'])<>'{}'::jsonb
    OR jsonb_typeof(NEW.snapshot)<>'object' OR jsonb_typeof(NEW.snapshot->'assessment')<>'array'
    OR jsonb_array_length(NEW.snapshot->'assessment')<>5
    OR NEW.snapshot->>'status' NOT IN ('PENDING_COMMERCIAL','AUTHORIZED_FOR_ONBOARDING')
    OR ((NEW.snapshot->>'status'='PENDING_COMMERCIAL') IS DISTINCT FROM (NEW.snapshot->'commercial'='null'::jsonb))
    OR (last_event.snapshot->'commercial'<>'null'::jsonb AND NEW.snapshot->'commercial' IS DISTINCT FROM last_event.snapshot->'commercial')
    OR (NEW.operation='assess' AND NEW.snapshot->'commercial' IS DISTINCT FROM last_event.snapshot->'commercial')
    OR (NEW.operation='confirm-commercial' AND (NEW.snapshot->>'status'<>'AUTHORIZED_FOR_ONBOARDING' OR NEW.snapshot->'assessment' IS DISTINCT FROM last_event.snapshot->'assessment'))
  THEN RAISE EXCEPTION 'Activation event version/state conflict'; END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER activation_event_guard BEFORE INSERT OR UPDATE OR DELETE ON activation_case_events FOR EACH ROW EXECUTE FUNCTION activation_event_guard();
