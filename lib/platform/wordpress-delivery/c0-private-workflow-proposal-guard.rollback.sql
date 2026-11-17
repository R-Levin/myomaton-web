-- Restore only the exact C0 private-staging proposal guard for manifest
-- 36f5dbffa00da0a8a407fa268adb83177def9adeb21b219b62f0cded2eb8b28d.
-- Standalone guarded change for the existing migration-role procedure.
-- Preserve the paired rollback file and verify its checksum before use.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '15s';
SET LOCAL search_path = pg_catalog, public;

DO $guard_change$
DECLARE before_state jsonb; after_state jsonb; installed text;
BEGIN
  IF current_database() <> 'postgres' OR current_user <> 'miopages_migration' OR session_user <> current_user THEN
    RAISE EXCEPTION 'Exact protected migration role and database required';
  END IF;
  IF NOT pg_try_advisory_xact_lock(hashtextextended('miopages-c0-site-proposal-guard',0)) THEN
    RAISE EXCEPTION 'Proposal guard change already in progress';
  END IF;
  LOCK TABLE public.site_change_revisions IN SHARE ROW EXCLUSIVE MODE NOWAIT;
  SELECT jsonb_build_object('function',to_jsonb(p)-'prosrc','trigger',to_jsonb(t)),
         encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex')
    INTO STRICT before_state, installed
    FROM pg_proc p JOIN pg_trigger t ON t.tgfoid=p.oid
    WHERE p.oid='public.site_proposal_revision_guard()'::regprocedure
      AND t.tgrelid='public.site_change_revisions'::regclass
      AND t.tgname='site_proposal_revision_guard' AND NOT t.tgisinternal;
  IF installed IS DISTINCT FROM '2e1c3df2dfd9fbf0ddc4db184e81ba649f7655d0beb03f6c1b01f72a6b603a97'
    OR before_state->'trigger'->>'tgenabled' IS DISTINCT FROM 'O'
    OR before_state->'function'->>'prosecdef' IS DISTINCT FROM 'false'
    OR before_state->'function'->'proconfig' IS DISTINCT FROM 'null'::jsonb
    OR pg_get_userbyid((before_state->'function'->>'proowner')::oid) IS DISTINCT FROM current_user::text
  THEN RAISE EXCEPTION 'Proposal guard baseline differs from the reviewed definition'; END IF;

  EXECUTE $replacement$
CREATE OR REPLACE FUNCTION public.site_proposal_revision_guard()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
END $function$
$replacement$;

  SELECT jsonb_build_object('function',to_jsonb(p)-'prosrc','trigger',to_jsonb(t)),
         encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex')
    INTO STRICT after_state, installed
    FROM pg_proc p JOIN pg_trigger t ON t.tgfoid=p.oid
    WHERE p.oid='public.site_proposal_revision_guard()'::regprocedure
      AND t.tgrelid='public.site_change_revisions'::regclass
      AND t.tgname='site_proposal_revision_guard' AND NOT t.tgisinternal;
  IF installed IS DISTINCT FROM '8d3f2dc8666ddf9a3d41087982e4556745fa4475e117b652cf5d8cacc71fa91c' OR after_state IS DISTINCT FROM before_state THEN
    RAISE EXCEPTION 'Proposal guard identity, privileges or resulting definition changed';
  END IF;
END
$guard_change$;
COMMIT;
