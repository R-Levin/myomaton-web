CREATE TABLE "site_content_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"web_presence_id" uuid NOT NULL,
	"managed_site_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"operation" text NOT NULL,
	"request_id" uuid NOT NULL,
	"request_digest" text NOT NULL,
	"proposal_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"proposal_digest" text NOT NULL,
	"base_fingerprint" text NOT NULL,
	"approval_event" text NOT NULL,
	"preview_digest" text NOT NULL,
	"rollback_of" uuid,
	"page_id" uuid NOT NULL,
	"before_fingerprint" text NOT NULL,
	"after_fingerprint" text NOT NULL,
	"before_content" jsonb NOT NULL,
	"after_content" jsonb NOT NULL,
	"actor" jsonb NOT NULL,
	"reference" text NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"previous_digest" text,
	"digest" text NOT NULL,
	CONSTRAINT "site_content_sequence" UNIQUE("managed_site_id","sequence"),
	CONSTRAINT "site_content_request" UNIQUE("managed_site_id","request_id"),
	CONSTRAINT "site_content_digest" UNIQUE("managed_site_id","digest"),
	CONSTRAINT "site_content_bounds" CHECK ("site_content_events"."sequence" BETWEEN 1 AND 256 AND "site_content_events"."operation" IN ('release','rollback') AND ("site_content_events"."operation"='release' AND "site_content_events"."rollback_of" IS NULL OR "site_content_events"."operation"='rollback' AND "site_content_events"."rollback_of" IS NOT NULL) AND "site_content_events"."request_digest" ~ '^[a-f0-9]{64}$' AND "site_content_events"."before_fingerprint" ~ '^[a-f0-9]{64}$' AND "site_content_events"."after_fingerprint" ~ '^[a-f0-9]{64}$' AND "site_content_events"."digest" ~ '^[a-f0-9]{64}$' AND ("site_content_events"."previous_digest" IS NULL OR "site_content_events"."previous_digest" ~ '^[a-f0-9]{64}$') AND length("site_content_events"."reference") BETWEEN 1 AND 500 AND jsonb_typeof("site_content_events"."actor")='object' AND octet_length("site_content_events"."before_content"::text)<=1048576 AND octet_length("site_content_events"."after_content"::text)<=1048576)
);
--> statement-breakpoint
ALTER TABLE "site_content_events" ADD CONSTRAINT "site_content_events_web_presence_id_web_presences_id_fk" FOREIGN KEY ("web_presence_id") REFERENCES "public"."web_presences"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_content_events" ADD CONSTRAINT "site_content_events_managed_site_id_managed_sites_id_fk" FOREIGN KEY ("managed_site_id") REFERENCES "public"."managed_sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_content_events" ADD CONSTRAINT "site_content_events_rollback_of_site_content_events_id_fk" FOREIGN KEY ("rollback_of") REFERENCES "public"."site_content_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_content_events" ADD CONSTRAINT "site_content_revision_fk" FOREIGN KEY ("proposal_id","revision","proposal_digest","base_fingerprint") REFERENCES "public"."site_change_revisions"("proposal_id","revision","digest","base_fingerprint") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_content_events" ADD CONSTRAINT "site_content_approval_fk" FOREIGN KEY ("proposal_id","approval_event") REFERENCES "public"."site_change_events"("proposal_id","digest") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "site_content_release_once" ON "site_content_events" USING btree ("proposal_id","revision") WHERE "site_content_events"."operation"='release';--> statement-breakpoint
CREATE UNIQUE INDEX "site_content_rollback_once" ON "site_content_events" USING btree ("rollback_of") WHERE "site_content_events"."operation"='rollback';
--> statement-breakpoint
CREATE FUNCTION site_content_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p site_change_proposals%ROWTYPE; r site_change_revisions%ROWTYPE; a site_change_events%ROWTYPE;
  prior site_content_events%ROWTYPE; released site_content_events%ROWTYPE; current_content jsonb; part jsonb; candidate jsonb; baseline jsonb; i integer;
BEGIN
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Content release/rollback history is immutable'; END IF;
  PERFORM 1 FROM managed_sites m JOIN web_presences w ON w.id=m.web_presence_id JOIN organizations o ON o.id=w.organization_id
    JOIN activation_customer_bindings b ON b.managed_site_id=m.id AND b.web_presence_id=w.id AND b.organization_id=o.id
    WHERE m.id=NEW.managed_site_id AND w.id=NEW.web_presence_id AND m.status='inactive' AND w.status='inactive' AND o.status='inactive' FOR UPDATE OF m;
  IF NOT FOUND THEN RAISE EXCEPTION 'Exact inactive bound release owner required'; END IF;
  SELECT * INTO p FROM site_change_proposals WHERE id=NEW.proposal_id;
  SELECT * INTO r FROM site_change_revisions WHERE proposal_id=NEW.proposal_id AND revision=NEW.revision;
  SELECT * INTO a FROM site_change_events WHERE proposal_id=NEW.proposal_id AND digest=NEW.approval_event AND operation='approve';
  SELECT * INTO prior FROM site_content_events WHERE managed_site_id=NEW.managed_site_id ORDER BY sequence DESC LIMIT 1;
  IF p.managed_site_id IS DISTINCT FROM NEW.managed_site_id OR p.web_presence_id IS DISTINCT FROM NEW.web_presence_id
    OR a.proposal_id IS NULL OR a.revision IS DISTINCT FROM NEW.revision OR a.proposal_digest IS DISTINCT FROM NEW.proposal_digest
    OR a.base_fingerprint IS DISTINCT FROM NEW.base_fingerprint OR a.preview_digest IS DISTINCT FROM NEW.preview_digest
    OR NEW.sequence<>coalesce(prior.sequence,0)+1 OR NEW.previous_digest IS DISTINCT FROM prior.digest
    OR r.data->'page'->>'pageId' IS DISTINCT FROM NEW.page_id::text
    OR jsonb_typeof(NEW.actor) IS DISTINCT FROM 'object' OR NOT(NEW.actor ?& ARRAY['operatorId','authorityReference'])
    OR NEW.actor-ARRAY['operatorId','authorityReference']<>'{}'::jsonb
    OR coalesce(length(NEW.actor->>'operatorId'),0) NOT BETWEEN 1 AND 200 OR coalesce(length(NEW.actor->>'authorityReference'),0) NOT BETWEEN 1 AND 300
  THEN RAISE EXCEPTION 'Exact release approval/destination/history binding required'; END IF;
  FOR part IN SELECT NEW.before_content UNION ALL SELECT NEW.after_content LOOP
    IF NOT(part ?& ARRAY['page','sections']) OR part-ARRAY['page','sections']<>'{}'::jsonb
      OR jsonb_typeof(part->'sections') IS DISTINCT FROM 'array' OR jsonb_array_length(part->'sections')>24
      OR (part->'page'<>'null'::jsonb AND (part->'page'->>'id' IS DISTINCT FROM NEW.page_id::text OR part->'page'->>'managed_site_id' IS DISTINCT FROM NEW.managed_site_id::text))
      OR EXISTS(SELECT 1 FROM jsonb_array_elements(part->'sections') s WHERE s->>'page_id' IS DISTINCT FROM NEW.page_id::text)
    THEN RAISE EXCEPTION 'Bounded owned content snapshot required'; END IF;
  END LOOP;
  IF NEW.operation='release' THEN
    SELECT value INTO baseline FROM jsonb_array_elements(r.data->'base'->'pages') WHERE value->>'id'=NEW.page_id::text;
    IF (NEW.before_content->'page'='null'::jsonb) IS DISTINCT FROM (baseline IS NULL)
      OR (baseline IS NOT NULL AND (baseline-ARRAY['created_at','updated_at']) IS DISTINCT FROM ((NEW.before_content->'page')-ARRAY['created_at','updated_at']))
      OR (baseline IS NOT NULL AND (date_trunc('milliseconds',(NEW.before_content->'page'->>'created_at')::timestamptz) IS DISTINCT FROM (baseline->>'created_at')::timestamptz
        OR date_trunc('milliseconds',(NEW.before_content->'page'->>'updated_at')::timestamptz) IS DISTINCT FROM (baseline->>'updated_at')::timestamptz))
      OR jsonb_array_length(NEW.before_content->'sections')<>(SELECT count(*) FROM jsonb_array_elements(r.data->'base'->'sections') s WHERE s->>'page_id'=NEW.page_id::text)
    THEN RAISE EXCEPTION 'Prior content must match approved baseline'; END IF;
    FOR part IN SELECT value FROM jsonb_array_elements(NEW.before_content->'sections') LOOP
      SELECT value INTO baseline FROM jsonb_array_elements(r.data->'base'->'sections') s WHERE s->>'id'=part->>'id' AND s->>'page_id'=NEW.page_id::text;
      IF baseline IS NULL OR baseline-ARRAY['created_at','updated_at'] IS DISTINCT FROM part-ARRAY['created_at','updated_at']
        OR date_trunc('milliseconds',(part->>'created_at')::timestamptz) IS DISTINCT FROM (baseline->>'created_at')::timestamptz
        OR date_trunc('milliseconds',(part->>'updated_at')::timestamptz) IS DISTINCT FROM (baseline->>'updated_at')::timestamptz
      THEN RAISE EXCEPTION 'Prior Sections must match approved baseline'; END IF;
    END LOOP;
    IF NEW.revision<>(SELECT max(revision) FROM site_change_revisions WHERE proposal_id=NEW.proposal_id)
      OR NEW.after_content->'page'->>'title' IS DISTINCT FROM r.data->'candidate'->>'title'
      OR NEW.after_content->'page'->>'slug' IS DISTINCT FROM r.data->'page'->>'slug'
      OR NEW.after_content->'page'->>'status' IS DISTINCT FROM 'active'
      OR jsonb_array_length(NEW.after_content->'sections')<>jsonb_array_length(r.data->'candidate'->'sections')
    THEN RAISE EXCEPTION 'Exact latest approved candidate required'; END IF;
    FOR candidate,i IN SELECT value,ordinality::integer-1 FROM jsonb_array_elements(r.data->'candidate'->'sections') WITH ORDINALITY LOOP
      SELECT value INTO part FROM jsonb_array_elements(NEW.after_content->'sections') WHERE value->>'id'=candidate->>'id';
      IF part IS NULL OR part->>'type' IS DISTINCT FROM candidate->>'type' OR part->>'variant' IS DISTINCT FROM candidate->>'variant'
        OR part->>'name' IS DISTINCT FROM candidate->>'name' OR part->'content' IS DISTINCT FROM candidate->'content'
        OR part->'configuration' IS DISTINCT FROM candidate->'configuration' OR (part->>'sort_order')::integer<>i OR part->>'status' IS DISTINCT FROM 'active'
      THEN RAISE EXCEPTION 'Released Sections differ from exact approved candidate'; END IF;
    END LOOP;
  ELSE
    SELECT * INTO released FROM site_content_events WHERE id=NEW.rollback_of AND operation='release';
    IF released.id IS NULL OR prior.id IS DISTINCT FROM released.id OR released.managed_site_id IS DISTINCT FROM NEW.managed_site_id
      OR released.proposal_id IS DISTINCT FROM NEW.proposal_id OR released.revision IS DISTINCT FROM NEW.revision OR released.approval_event IS DISTINCT FROM NEW.approval_event
      OR NEW.before_content IS DISTINCT FROM released.after_content OR NEW.after_content IS DISTINCT FROM released.before_content
      OR NEW.before_fingerprint IS DISTINCT FROM released.after_fingerprint OR NEW.after_fingerprint IS DISTINCT FROM released.before_fingerprint
    THEN RAISE EXCEPTION 'Rollback must restore exact current release predecessor'; END IF;
  END IF;
  SELECT jsonb_build_object('page',(SELECT to_jsonb(current_page)||jsonb_build_object('created_at',to_char(current_page.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'updated_at',to_char(current_page.updated_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')) FROM pages current_page WHERE id=NEW.page_id),
    'sections',coalesce((SELECT jsonb_agg(to_jsonb(s)||jsonb_build_object('created_at',to_char(s.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'updated_at',to_char(s.updated_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')) ORDER BY s.id) FROM sections s WHERE page_id=NEW.page_id),'[]'::jsonb)) INTO current_content;
  IF current_content IS DISTINCT FROM NEW.after_content THEN RAISE EXCEPTION 'Canonical content and successful release record must agree'; END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER site_content_guard BEFORE INSERT OR UPDATE OR DELETE ON site_content_events FOR EACH ROW EXECUTE FUNCTION site_content_guard();
--> statement-breakpoint
CREATE TRIGGER site_content_truncate_guard BEFORE TRUNCATE ON site_content_events FOR EACH STATEMENT EXECUTE FUNCTION site_content_guard();
