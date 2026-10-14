CREATE TABLE "prospect_intake_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"web_presence_id" uuid NOT NULL,
	"intake_id" uuid NOT NULL,
	"entry_intent" text NOT NULL,
	"questionnaire_version" text NOT NULL,
	"draft_version" integer NOT NULL,
	"state" text DEFAULT 'submitted' NOT NULL,
	"answers" jsonb NOT NULL,
	"provenance" jsonb NOT NULL,
	"digest" text NOT NULL,
	"submitted_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "prospect_submissions_once" UNIQUE("intake_id"),
	CONSTRAINT "prospect_submissions_state" CHECK ("prospect_intake_submissions"."state"='submitted' AND "prospect_intake_submissions"."draft_version">0 AND "prospect_intake_submissions"."digest" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "prospect_submissions_payload" CHECK (octet_length("prospect_intake_submissions"."answers"::text)<=32768 AND octet_length("prospect_intake_submissions"."provenance"::text)<=16384)
);
--> statement-breakpoint
CREATE TABLE "prospect_intakes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"web_presence_id" uuid NOT NULL,
	"managed_site_id" uuid NOT NULL,
	"entry_intent" text NOT NULL,
	"questionnaire_version" text NOT NULL,
	"state" text DEFAULT 'draft' NOT NULL,
	"resume_hash" text NOT NULL,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"provenance" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"step" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"resume_expires_at" timestamp with time zone NOT NULL,
	"submitted_at" timestamp with time zone,
	CONSTRAINT "prospect_intakes_owned_id" UNIQUE("web_presence_id","id"),
	CONSTRAINT "prospect_intakes_resume_hash" UNIQUE("resume_hash"),
	CONSTRAINT "prospect_intakes_intent" CHECK ("prospect_intakes"."entry_intent" IN ('FREE_REVIEW','DIRECT_START')),
	CONSTRAINT "prospect_intakes_state" CHECK ("prospect_intakes"."state" IN ('draft','needs_operator_review')),
	CONSTRAINT "prospect_intakes_hash" CHECK ("prospect_intakes"."resume_hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "prospect_intakes_bounds" CHECK ("prospect_intakes"."version">0 AND "prospect_intakes"."step" BETWEEN 0 AND 12 AND octet_length("prospect_intakes"."answers"::text)<=32768 AND octet_length("prospect_intakes"."provenance"::text)<=16384 AND jsonb_typeof("prospect_intakes"."answers")='object' AND jsonb_typeof("prospect_intakes"."provenance")='object'),
	CONSTRAINT "prospect_intakes_submission" CHECK (("prospect_intakes"."state"='draft' AND "prospect_intakes"."submitted_at" IS NULL) OR ("prospect_intakes"."state"='needs_operator_review' AND "prospect_intakes"."submitted_at" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "prospect_intake_submissions" ADD CONSTRAINT "prospect_submissions_owned_intake" FOREIGN KEY ("web_presence_id","intake_id") REFERENCES "public"."prospect_intakes"("web_presence_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospect_intakes" ADD CONSTRAINT "prospect_intakes_web_presence_id_web_presences_id_fk" FOREIGN KEY ("web_presence_id") REFERENCES "public"."web_presences"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospect_intakes" ADD CONSTRAINT "prospect_intakes_managed_site_id_managed_sites_id_fk" FOREIGN KEY ("managed_site_id") REFERENCES "public"."managed_sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "prospect_intakes_queue" ON "prospect_intakes" USING btree ("web_presence_id","state","submitted_at");--> statement-breakpoint
CREATE INDEX "prospect_intakes_retention" ON "prospect_intakes" USING btree ("expires_at");
--> statement-breakpoint
-- Deliberate SQL guards beyond the Drizzle catalog; scoped to the current schema.
CREATE FUNCTION prospect_intake_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM managed_sites m WHERE m.id=NEW.managed_site_id AND m.web_presence_id=NEW.web_presence_id) THEN
    RAISE EXCEPTION 'Intake owner mismatch';
  END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.state<>'draft' OR NEW.version<>1 OR NEW.answers<>'{}'::jsonb OR NEW.provenance<>'{}'::jsonb OR NEW.step<>0 THEN RAISE EXCEPTION 'Invalid initial intake'; END IF;
  ELSE
    IF OLD.state<>'draft' THEN RAISE EXCEPTION 'Submitted intake is immutable'; END IF;
    IF (NEW.id,NEW.web_presence_id,NEW.managed_site_id,NEW.entry_intent,NEW.questionnaire_version,NEW.resume_hash,NEW.created_at,NEW.resume_expires_at)
      IS DISTINCT FROM (OLD.id,OLD.web_presence_id,OLD.managed_site_id,OLD.entry_intent,OLD.questionnaire_version,OLD.resume_hash,OLD.created_at,OLD.resume_expires_at)
      OR NEW.version<>OLD.version+1 THEN RAISE EXCEPTION 'Intake identity/version conflict'; END IF;
    IF NEW.state='draft' AND NEW.expires_at IS DISTINCT FROM OLD.expires_at THEN RAISE EXCEPTION 'Draft expiration is fixed'; END IF;
    IF NEW.state='needs_operator_review' AND NOT EXISTS (
      SELECT 1 FROM prospect_intake_submissions s WHERE s.intake_id=NEW.id AND s.web_presence_id=NEW.web_presence_id
      AND s.answers=NEW.answers AND s.provenance=NEW.provenance AND s.draft_version=OLD.version
      AND s.submitted_at=NEW.submitted_at AND s.expires_at=NEW.expires_at
    ) THEN RAISE EXCEPTION 'Matching submission required'; END IF;
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER prospect_intake_guard BEFORE INSERT OR UPDATE ON prospect_intakes FOR EACH ROW EXECUTE FUNCTION prospect_intake_guard();
--> statement-breakpoint
CREATE FUNCTION prospect_submission_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'Submission snapshot is immutable'; END IF;
  IF NOT EXISTS (SELECT 1 FROM prospect_intakes i WHERE i.id=NEW.intake_id AND i.web_presence_id=NEW.web_presence_id
    AND i.state='draft' AND i.version=NEW.draft_version AND i.entry_intent=NEW.entry_intent
    AND i.questionnaire_version=NEW.questionnaire_version AND i.answers=NEW.answers AND i.provenance=NEW.provenance)
    THEN RAISE EXCEPTION 'Submission must match owned draft'; END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER prospect_submission_guard BEFORE INSERT OR UPDATE ON prospect_intake_submissions FOR EACH ROW EXECUTE FUNCTION prospect_submission_guard();
--> statement-breakpoint
CREATE FUNCTION prospect_retention_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.expires_at>now() THEN RAISE EXCEPTION 'Active intake/submission cannot be deleted'; END IF;
  RETURN OLD;
END $$;
--> statement-breakpoint
CREATE TRIGGER prospect_intake_retention_guard BEFORE DELETE ON prospect_intakes FOR EACH ROW EXECUTE FUNCTION prospect_retention_guard();
--> statement-breakpoint
CREATE TRIGGER prospect_submission_retention_guard BEFORE DELETE ON prospect_intake_submissions FOR EACH ROW EXECUTE FUNCTION prospect_retention_guard();
