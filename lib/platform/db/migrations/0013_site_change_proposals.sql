CREATE TABLE "site_change_events" (
	"proposal_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"request_id" uuid NOT NULL,
	"request_digest" text NOT NULL,
	"operation" text NOT NULL,
	"revision" integer NOT NULL,
	"proposal_digest" text NOT NULL,
	"base_fingerprint" text NOT NULL,
	"previous" text,
	"digest" text NOT NULL,
	"preview_digest" text,
	"preview_event" text,
	"renderer" text,
	"actor" text NOT NULL,
	"authority_reference" text NOT NULL,
	"customer" jsonb,
	"approval_reference" text,
	"at" timestamp with time zone NOT NULL,
	"data" jsonb NOT NULL,
	CONSTRAINT "site_change_events_proposal_id_sequence_pk" PRIMARY KEY("proposal_id","sequence"),
	CONSTRAINT "site_event_request" UNIQUE("proposal_id","request_id"),
	CONSTRAINT "site_event_hash" UNIQUE("proposal_id","digest"),
	CONSTRAINT "site_event_bounds" CHECK ("site_change_events"."sequence" BETWEEN 1 AND 128 AND "site_change_events"."operation" IN ('revise','preview','approve') AND "site_change_events"."request_digest" ~ '^[a-f0-9]{64}$' AND "site_change_events"."digest" ~ '^[a-f0-9]{64}$' AND ("site_change_events"."previous" IS NULL OR "site_change_events"."previous" ~ '^[a-f0-9]{64}$') AND length("site_change_events"."actor") BETWEEN 1 AND 200 AND length("site_change_events"."authority_reference") BETWEEN 1 AND 300 AND jsonb_typeof("site_change_events"."data")='object' AND octet_length("site_change_events"."data"::text)<=32768)
);
--> statement-breakpoint
CREATE TABLE "site_change_proposals" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"web_presence_id" uuid NOT NULL,
	"managed_site_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_change_revisions" (
	"proposal_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"digest" text NOT NULL,
	"base_fingerprint" text NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "site_change_revisions_proposal_id_revision_pk" PRIMARY KEY("proposal_id","revision"),
	CONSTRAINT "site_revision_binding" UNIQUE("proposal_id","revision","digest","base_fingerprint"),
	CONSTRAINT "site_revision_bounds" CHECK ("site_change_revisions"."revision" BETWEEN 1 AND 128 AND "site_change_revisions"."digest" ~ '^[a-f0-9]{64}$' AND "site_change_revisions"."base_fingerprint" ~ '^[a-f0-9]{64}$' AND jsonb_typeof("site_change_revisions"."data")='object' AND octet_length("site_change_revisions"."data"::text)<=2097152)
);
--> statement-breakpoint
ALTER TABLE "site_change_events" ADD CONSTRAINT "site_event_revision_fk" FOREIGN KEY ("proposal_id","revision","proposal_digest","base_fingerprint") REFERENCES "public"."site_change_revisions"("proposal_id","revision","digest","base_fingerprint") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_change_proposals" ADD CONSTRAINT "site_change_proposals_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_change_proposals" ADD CONSTRAINT "site_change_proposals_web_presence_id_web_presences_id_fk" FOREIGN KEY ("web_presence_id") REFERENCES "public"."web_presences"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_change_proposals" ADD CONSTRAINT "site_change_proposals_managed_site_id_managed_sites_id_fk" FOREIGN KEY ("managed_site_id") REFERENCES "public"."managed_sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_change_revisions" ADD CONSTRAINT "site_change_revisions_proposal_id_site_change_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."site_change_proposals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "site_approval_once" ON "site_change_events" USING btree ("proposal_id","revision") WHERE "site_change_events"."operation"='approve';--> statement-breakpoint
CREATE INDEX "site_proposal_owner" ON "site_change_proposals" USING btree ("web_presence_id","managed_site_id");
--> statement-breakpoint
-- Bounded integrity guards beyond the generated Drizzle catalog. No content writer.
CREATE FUNCTION site_proposal_identity_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Site proposal identity/history is immutable'; END IF;
  IF NOT EXISTS (SELECT 1 FROM activation_customer_bindings b
    JOIN organizations o ON o.id=b.organization_id JOIN web_presences w ON w.id=b.web_presence_id AND w.organization_id=o.id
    JOIN managed_sites m ON m.id=b.managed_site_id AND m.web_presence_id=w.id
    WHERE b.organization_id=NEW.organization_id AND b.web_presence_id=NEW.web_presence_id AND b.managed_site_id=NEW.managed_site_id
    AND o.status='inactive' AND w.status='inactive' AND m.status='inactive')
  THEN RAISE EXCEPTION 'Exact bound inactive proposal owner required'; END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER site_proposal_identity_guard BEFORE INSERT OR UPDATE OR DELETE ON site_change_proposals FOR EACH ROW EXECUTE FUNCTION site_proposal_identity_guard();
--> statement-breakpoint
CREATE FUNCTION site_proposal_revision_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p site_change_proposals%ROWTYPE; source jsonb; snapshot jsonb; entry jsonb; expected jsonb;
BEGIN
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Site proposal identity/history is immutable'; END IF;
  SELECT * INTO p FROM site_change_proposals WHERE id=NEW.proposal_id FOR UPDATE;
  expected=jsonb_build_object('proposalId',p.id,'scope',jsonb_build_object('webPresenceId',p.web_presence_id,'managedSiteId',p.managed_site_id),
    'revision',NEW.revision,'digest',NEW.digest,'baseFingerprint',NEW.base_fingerprint);
  IF p.id IS NULL OR NEW.revision<>(SELECT coalesce(max(revision),0)+1 FROM site_change_revisions WHERE proposal_id=NEW.proposal_id)
    OR NEW.data->'binding' IS DISTINCT FROM expected OR (NEW.data->>'at')::timestamptz IS DISTINCT FROM NEW.created_at
    OR NOT (NEW.data ?& ARRAY['binding','at','author','page','resolved','candidate','base'])
    OR (NEW.data - ARRAY['binding','at','author','page','resolved','candidate','base'])<>'{}'::jsonb
    OR jsonb_typeof(NEW.data->'resolved') IS DISTINCT FROM 'array'
    OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(NEW.data->'resolved') x WHERE x->'origin'->>'kind'='canonical')
  THEN RAISE EXCEPTION 'Site proposal revision/destination conflict'; END IF;
  FOR entry IN SELECT value FROM jsonb_array_elements(NEW.data->'resolved') LOOP
    IF entry->'origin'->>'kind'='canonical' THEN
      source=entry->'origin'->'source'; snapshot=NULL;
      IF source->>'domain'='knowledge' THEN
        SELECT r.snapshot INTO snapshot FROM business_knowledge_revisions r JOIN business_knowledge k ON k.id=r.knowledge_id AND k.version=r.revision_version
          WHERE r.knowledge_id=(source->>'recordId')::uuid AND r.web_presence_id=p.web_presence_id AND r.revision_version=(source->>'revision')::integer;
        SELECT value INTO expected FROM jsonb_array_elements(snapshot->'payload'->'entries') WHERE value->>'key'=source->>'field';
        IF expected IS NULL OR expected->'evidence'->>'confirmation' IS DISTINCT FROM 'confirmed' OR expected->>'value' IS DISTINCT FROM entry->>'value'
          THEN RAISE EXCEPTION 'Confirmed owned Knowledge revision required'; END IF;
      ELSIF source->>'domain'='offering' THEN
        SELECT r.snapshot INTO snapshot FROM offering_revisions r JOIN offerings o ON o.id=r.offering_id AND o.version=r.revision_version
          WHERE r.offering_id=(source->>'recordId')::uuid AND r.web_presence_id=p.web_presence_id AND r.revision_version=(source->>'revision')::integer;
        IF snapshot IS NULL OR snapshot->'payload'->'evidence'->>'confirmation' IS DISTINCT FROM 'confirmed'
          OR source->>'field' NOT IN ('name','summary','detail')
          OR (CASE WHEN source->>'field'='name' THEN snapshot->>'name' ELSE snapshot->'payload'->>(source->>'field') END) IS DISTINCT FROM entry->>'value'
          THEN RAISE EXCEPTION 'Confirmed owned Offering revision required'; END IF;
      ELSE RAISE EXCEPTION 'Only canonical facts are supported'; END IF;
    ELSIF entry->'origin'->>'kind' IS DISTINCT FROM 'editorial' THEN RAISE EXCEPTION 'Unsupported proposal copy origin'; END IF;
  END LOOP;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER site_proposal_revision_guard BEFORE INSERT OR UPDATE OR DELETE ON site_change_revisions FOR EACH ROW EXECUTE FUNCTION site_proposal_revision_guard();
--> statement-breakpoint
CREATE FUNCTION site_proposal_event_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p site_change_proposals%ROWTYPE; r site_change_revisions%ROWTYPE; last_event site_change_events%ROWTYPE; rendered site_change_events%ROWTYPE; expected jsonb;
BEGIN
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Site proposal identity/history is immutable'; END IF;
  SELECT * INTO p FROM site_change_proposals WHERE id=NEW.proposal_id FOR UPDATE;
  SELECT * INTO last_event FROM site_change_events WHERE proposal_id=NEW.proposal_id ORDER BY sequence DESC LIMIT 1;
  SELECT * INTO r FROM site_change_revisions WHERE proposal_id=NEW.proposal_id AND revision=NEW.revision;
  IF p.id IS NULL OR r.proposal_id IS NULL OR NEW.sequence<>coalesce(last_event.sequence,0)+1 OR NEW.previous IS DISTINCT FROM last_event.digest
    OR NEW.revision<>(SELECT max(revision) FROM site_change_revisions WHERE proposal_id=NEW.proposal_id)
    OR (NEW.operation='revise' AND NEW.revision<>coalesce(last_event.revision,0)+1)
    OR (NEW.operation<>'revise' AND NEW.revision IS DISTINCT FROM last_event.revision)
  THEN RAISE EXCEPTION 'Site proposal event sequence/revision conflict'; END IF;
  expected=jsonb_build_object('sequence',NEW.sequence,'previous',NEW.previous,'requestId',NEW.request_id,'requestDigest',NEW.request_digest,
    'action',NEW.operation,'at',NEW.data->>'at','actor',jsonb_build_object('operatorId',NEW.actor,'authorityReference',NEW.authority_reference),'hash',NEW.digest);
  IF (NEW.data->>'at')::timestamptz IS DISTINCT FROM NEW.at THEN RAISE EXCEPTION 'Site event time conflict'; END IF;
  IF NEW.operation='revise' THEN
    IF NEW.preview_digest IS NOT NULL OR NEW.preview_event IS NOT NULL OR NEW.renderer IS NOT NULL OR NEW.customer IS NOT NULL OR NEW.approval_reference IS NOT NULL
      OR r.data->'author' IS DISTINCT FROM expected->'actor' OR r.created_at IS DISTINCT FROM NEW.at
    THEN RAISE EXCEPTION 'Site revision authority mismatch'; END IF;
  ELSE
    IF NEW.preview_digest IS NULL OR NEW.preview_digest !~ '^[a-f0-9]{64}$' OR NEW.renderer IS NULL OR NEW.renderer !~ '^site-proposal-section-renderer/[1-9][0-9]*$'
    THEN RAISE EXCEPTION 'Exact rendered preview identity required'; END IF;
    IF NEW.operation='preview' THEN
      IF NEW.preview_event IS NOT NULL OR NEW.customer IS NOT NULL OR NEW.approval_reference IS NOT NULL THEN RAISE EXCEPTION 'Preview cannot approve'; END IF;
      expected=expected||jsonb_build_object('preview',jsonb_build_object('binding',r.data->'binding','digest',NEW.preview_digest));
    ELSIF NEW.operation='approve' THEN
      SELECT * INTO rendered FROM site_change_events WHERE proposal_id=NEW.proposal_id AND digest=NEW.preview_event AND operation='preview';
      IF rendered.proposal_id IS NULL OR rendered.revision<>NEW.revision OR rendered.proposal_digest<>NEW.proposal_digest OR rendered.base_fingerprint<>NEW.base_fingerprint
        OR rendered.preview_digest<>NEW.preview_digest OR rendered.renderer<>NEW.renderer
        OR jsonb_typeof(NEW.customer) IS DISTINCT FROM 'object' OR NOT (NEW.customer ?& ARRAY['kind','subjectId','authorityReference'])
        OR (NEW.customer - ARRAY['kind','subjectId','authorityReference'])<>'{}'::jsonb
        OR coalesce(NEW.customer->>'kind','') NOT IN ('business-representative','accepted-authority')
        OR coalesce(length(NEW.customer->>'subjectId'),0) NOT BETWEEN 1 AND 200
        OR coalesce(length(NEW.customer->>'authorityReference'),0) NOT BETWEEN 1 AND 500 OR coalesce(length(NEW.approval_reference),0) NOT BETWEEN 1 AND 500
      THEN RAISE EXCEPTION 'Exact preview and customer approval authority required'; END IF;
      expected=expected||jsonb_build_object('approval',jsonb_build_object('binding',r.data->'binding','previewDigest',NEW.preview_digest,'previewEvent',NEW.preview_event,
        'recordedBy',expected->'actor','customer',NEW.customer,'reference',NEW.approval_reference,'at',NEW.data->>'at'));
    END IF;
  END IF;
  IF NEW.data IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Site event substance/binding mismatch'; END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER site_proposal_event_guard BEFORE INSERT OR UPDATE OR DELETE ON site_change_events FOR EACH ROW EXECUTE FUNCTION site_proposal_event_guard();
--> statement-breakpoint
CREATE FUNCTION site_proposal_complete_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME='site_change_proposals' THEN
    IF NOT EXISTS (SELECT 1 FROM site_change_revisions r JOIN site_change_events e ON e.proposal_id=r.proposal_id AND e.revision=r.revision
      WHERE r.proposal_id=NEW.id AND r.revision=1 AND e.sequence=1 AND e.operation='revise' AND r.created_at=NEW.created_at)
    THEN RAISE EXCEPTION 'Proposal identity requires atomic first revision/event'; END IF;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM site_change_events e WHERE e.proposal_id=NEW.proposal_id AND e.revision=NEW.revision AND e.operation='revise')
    THEN RAISE EXCEPTION 'Proposal revision requires atomic event'; END IF;
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER site_proposal_complete_guard AFTER INSERT ON site_change_proposals DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION site_proposal_complete_guard();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER site_revision_complete_guard AFTER INSERT ON site_change_revisions DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION site_proposal_complete_guard();
--> statement-breakpoint
CREATE FUNCTION site_proposal_truncate_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Site proposal identity/history is immutable'; END $$;
--> statement-breakpoint
CREATE TRIGGER site_proposal_truncate_guard BEFORE TRUNCATE ON site_change_proposals FOR EACH STATEMENT EXECUTE FUNCTION site_proposal_truncate_guard();
--> statement-breakpoint
CREATE TRIGGER site_revision_truncate_guard BEFORE TRUNCATE ON site_change_revisions FOR EACH STATEMENT EXECUTE FUNCTION site_proposal_truncate_guard();
--> statement-breakpoint
CREATE TRIGGER site_event_truncate_guard BEFORE TRUNCATE ON site_change_events FOR EACH STATEMENT EXECUTE FUNCTION site_proposal_truncate_guard();
