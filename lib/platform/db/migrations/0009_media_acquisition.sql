CREATE TABLE "external_work" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"web_presence_id" uuid NOT NULL,
	"capability" text NOT NULL,
	"identity" text NOT NULL,
	"context_digest" text NOT NULL,
	"context" jsonb NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"template_version" text NOT NULL,
	"iteration" integer NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"retries" integer DEFAULT 0 NOT NULL,
	"lease_token" uuid,
	"lease_until" timestamp with time zone,
	"budget_micros" integer NOT NULL,
	"reserved_micros" integer DEFAULT 0 NOT NULL,
	"actual_micros" integer,
	"result" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "external_work_owner_id_unique" UNIQUE("web_presence_id","id"),
	CONSTRAINT "external_work_identity_unique" UNIQUE("web_presence_id","identity"),
	CONSTRAINT "external_work_capability" CHECK ("external_work"."capability" IN ('image-generation','editorial-reconciliation')),
	CONSTRAINT "external_work_status" CHECK ("external_work"."status" IN ('queued','running','awaiting-review','completed','failed','cancelled')),
	CONSTRAINT "external_work_digest" CHECK ("external_work"."context_digest" ~ '^[a-f0-9]{64}$' AND "external_work"."identity" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "external_work_bounds" CHECK ("external_work"."version">0 AND "external_work"."iteration" BETWEEN 1 AND 2 AND "external_work"."attempts" BETWEEN 0 AND 3 AND "external_work"."retries" BETWEEN 0 AND 2 AND "external_work"."budget_micros">0 AND "external_work"."reserved_micros" BETWEEN 0 AND "external_work"."budget_micros" AND ("external_work"."actual_micros" IS NULL OR "external_work"."actual_micros">=0)),
	CONSTRAINT "external_work_payload" CHECK (octet_length("external_work"."context"::text)<=16384 AND octet_length("external_work"."result"::text)<=8192)
);
--> statement-breakpoint
CREATE TABLE "external_work_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"web_presence_id" uuid NOT NULL,
	"work_id" uuid NOT NULL,
	"candidate_id" uuid,
	"kind" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "external_work_events_kind" CHECK ("external_work_events"."kind" IN ('queued','dispatch','result','failure','retry','stale','decision','ingestion','cancel','lease-expired','cleanup')),
	CONSTRAINT "external_work_events_payload" CHECK (octet_length("external_work_events"."payload"::text)<=8192)
);
--> statement-breakpoint
CREATE TABLE "media_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"web_presence_id" uuid NOT NULL,
	"work_id" uuid NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"state" text DEFAULT 'proposed' NOT NULL,
	"source_kind" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"quarantine_key" text NOT NULL,
	"bytes_digest" text NOT NULL,
	"subject_digest" text NOT NULL,
	"provenance_digest" text NOT NULL,
	"provenance" jsonb NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"mime_type" text NOT NULL,
	"policy_version" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_candidates_owner_id_unique" UNIQUE("web_presence_id","id"),
	CONSTRAINT "media_candidates_one_per_work_unique" UNIQUE("work_id"),
	CONSTRAINT "media_candidates_state" CHECK ("media_candidates"."state" IN ('proposed','rejected','approved','ingested','expired','revoked')),
	CONSTRAINT "media_candidates_format" CHECK ("media_candidates"."source_kind"='generated-illustrated' AND "media_candidates"."mime_type" IN ('image/png','image/jpeg','image/webp') AND "media_candidates"."width">0 AND "media_candidates"."height">0 AND "media_candidates"."width"::bigint*"media_candidates"."height"<=40000000 AND "media_candidates"."revision">0 AND "media_candidates"."version">0),
	CONSTRAINT "media_candidates_digests" CHECK ("media_candidates"."bytes_digest" ~ '^[a-f0-9]{64}$' AND "media_candidates"."subject_digest" ~ '^[a-f0-9]{64}$' AND "media_candidates"."provenance_digest" ~ '^[a-f0-9]{64}$' AND "media_candidates"."quarantine_key"='objects/'||"media_candidates"."bytes_digest"),
	CONSTRAINT "media_candidates_provenance" CHECK (octet_length("media_candidates"."provenance"::text)<=16384)
);
--> statement-breakpoint
ALTER TABLE "external_work" ADD CONSTRAINT "external_work_web_presence_id_web_presences_id_fk" FOREIGN KEY ("web_presence_id") REFERENCES "public"."web_presences"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_work_events" ADD CONSTRAINT "external_work_events_owned_work_fk" FOREIGN KEY ("web_presence_id","work_id") REFERENCES "public"."external_work"("web_presence_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_work_events" ADD CONSTRAINT "external_work_events_owned_candidate_fk" FOREIGN KEY ("web_presence_id","candidate_id") REFERENCES "public"."media_candidates"("web_presence_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_candidates" ADD CONSTRAINT "media_candidates_owned_work_fk" FOREIGN KEY ("web_presence_id","work_id") REFERENCES "public"."external_work"("web_presence_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "external_work_queue_idx" ON "external_work" USING btree ("status","lease_until");--> statement-breakpoint
CREATE INDEX "external_work_need_idx" ON "external_work" USING btree ("web_presence_id","context_digest");--> statement-breakpoint
CREATE INDEX "external_work_events_work_idx" ON "external_work_events" USING btree ("web_presence_id","work_id","created_at");--> statement-breakpoint
CREATE INDEX "external_work_events_candidate_idx" ON "external_work_events" USING btree ("web_presence_id","candidate_id","created_at");--> statement-breakpoint
CREATE INDEX "media_candidates_retention_idx" ON "media_candidates" USING btree ("web_presence_id","state","expires_at");
--> statement-breakpoint
-- Lifecycle guards are explicit SQL beyond Drizzle's catalog snapshot.
CREATE FUNCTION acquisition_work_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Retain work audit'; END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.status<>'queued' OR NEW.version<>1 OR NEW.attempts<>0 OR NEW.reserved_micros<>0 THEN RAISE EXCEPTION 'Invalid initial work'; END IF;
    RETURN NEW;
  END IF;
  IF NEW.version<>OLD.version+1 OR
    (to_jsonb(NEW)-ARRAY['status','version','attempts','retries','lease_token','lease_until','reserved_micros','actual_micros','result','updated_at']) <>
    (to_jsonb(OLD)-ARRAY['status','version','attempts','retries','lease_token','lease_until','reserved_micros','actual_micros','result','updated_at']) OR
    NEW.attempts<OLD.attempts OR NEW.retries<OLD.retries OR NEW.reserved_micros<OLD.reserved_micros THEN RAISE EXCEPTION 'Invalid work revision'; END IF;
  IF NOT ((OLD.status='queued' AND NEW.status IN ('running','failed','cancelled')) OR
    (OLD.status='running' AND NEW.status IN ('awaiting-review','failed','cancelled')) OR
    (OLD.status='failed' AND NEW.status='queued' AND OLD.result->>'code' IN ('rate-limit','transient') AND NEW.retries=OLD.retries+1) OR
    (OLD.status='awaiting-review' AND NEW.status IN ('completed','cancelled'))) THEN RAISE EXCEPTION 'Invalid work transition'; END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER acquisition_work_guard BEFORE INSERT OR UPDATE OR DELETE ON external_work FOR EACH ROW EXECUTE FUNCTION acquisition_work_guard();
--> statement-breakpoint
CREATE FUNCTION acquisition_candidate_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Retain candidate audit'; END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.state<>'proposed' OR NEW.version<>1 OR NEW.revision<>1 THEN RAISE EXCEPTION 'Invalid initial candidate'; END IF;
    RETURN NEW;
  END IF;
  IF NEW.version<>OLD.version+1 OR
    (to_jsonb(NEW)-ARRAY['state','version','updated_at'])<>(to_jsonb(OLD)-ARRAY['state','version','updated_at']) THEN RAISE EXCEPTION 'Immutable candidate representation'; END IF;
  IF NOT ((OLD.state='proposed' AND NEW.state IN ('approved','rejected','expired','revoked')) OR
    (OLD.state='approved' AND NEW.state IN ('ingested','revoked','expired')) OR
    (OLD.state='ingested' AND NEW.state IN ('revoked','expired'))) THEN RAISE EXCEPTION 'Invalid candidate transition'; END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER acquisition_candidate_guard BEFORE INSERT OR UPDATE OR DELETE ON media_candidates FOR EACH ROW EXECUTE FUNCTION acquisition_candidate_guard();
--> statement-breakpoint
CREATE FUNCTION acquisition_event_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Append-only acquisition evidence'; END IF;
  IF NEW.candidate_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM media_candidates WHERE id=NEW.candidate_id AND work_id=NEW.work_id AND web_presence_id=NEW.web_presence_id) THEN RAISE EXCEPTION 'Candidate work mismatch'; END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER acquisition_event_guard BEFORE INSERT OR UPDATE OR DELETE ON external_work_events FOR EACH ROW EXECUTE FUNCTION acquisition_event_guard();
