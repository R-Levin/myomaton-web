-- Install only the exact C0 private-staging proposal guard for manifest
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
  IF installed IS DISTINCT FROM '8d3f2dc8666ddf9a3d41087982e4556745fa4475e117b652cf5d8cacc71fa91c'
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
  THEN RAISE EXCEPTION 'Site proposal revision/destination conflict'; END IF;

  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(NEW.data->'resolved') x WHERE x->'origin'->>'kind'='canonical') THEN
    -- Exact evaluated visual packet and owner staging manifest at 63e3f51.
    -- This initial private projection cannot supply canonical facts or new copy.
    IF current_user <> 'miopages_wp_operator'
      OR NEW.revision <> 1
      OR p.organization_id <> 'b3b46645-0364-4329-83c7-86a6ea9e56c4'
      OR p.web_presence_id <> '819d007a-595d-4374-a2f0-96b900d46559'
      OR p.managed_site_id <> '1d92a248-416f-4e22-baaf-d2f1fca70352'
      OR NEW.base_fingerprint <> '8c342e25aa3c962b98a9292bfd871873aca87364b0a6d44b3be6847c09a11ebd'
    THEN RAISE EXCEPTION 'Site proposal revision/destination conflict'; END IF;

    IF NOT EXISTS (
      SELECT 1 FROM (VALUES
        ('b93f73be-bbc7-5b2c-8e0b-b0f6cc4b93c1'::uuid, '5f1d8c5d1c9aceaba1347f491b764f2031b3b29d281b68474aacc9b19cb1ab0b'),
        ('cc1db5f4-e5b8-5339-8870-ac35d58c5ea4'::uuid, '940e052ac2460a7a55a7b6933998b6a3c9cb14ec28db9248cdae29f738e82e6d'),
        ('ec988b2f-03db-55bd-82e3-ef27efd48181'::uuid, 'deb1c9e7656e0ce696ec7089cd265386ed7fcb8b93b64970ca71798d62dbbc51'),
        ('18fe640c-d1bd-5604-82aa-45d1ebde44e2'::uuid, 'eba0b2674992bdf0840f12b5e245d7948865a268bc0c3a12a0c1d0f7189f598f'),
        ('5dbe4d97-0def-5e10-8b2d-9750af52c155'::uuid, '0469f74f75cfff07093c29e0b543ad6ef5ef8e27809b89c7b62e51d6cc2ab2f6'),
        ('bab3a919-ddb6-521a-802c-82326c531309'::uuid, '50bc732384c4ef8012405299fd94e184ab49945c4daa96c7526fa7e106e058d3'),
        ('6e5844e2-b40b-5b26-89e5-71de35b3c05a'::uuid, '9586305ee85f6a61abb1193bb02a1aaee9b4779a0d4a9072133e5823901e2ecc'),
        ('c628387f-6dee-51fd-8c06-6108300719ad'::uuid, '0164b46450b048d5b7e2f217e9379dbc4ec642eae0a21d7a8aafb3b1caa0970a'),
        ('b07525f3-1eac-5c54-826e-02ac348b6a16'::uuid, 'bf48e29c88c7f1ad41dfb8061587991f26f710293ca033f27c66e73b582ee498'),
        ('7e8997f1-ca40-552a-875a-fe73bc824afa'::uuid, 'dad301f2908872faacc809da6049d28ce175a41d9582f0a028ce91d5e2ec6d67'),
        ('36f25a72-d86c-5f9a-818d-f9e9dd45bfb9'::uuid, 'abc143c70e941402550a3d30a418d4a51ac9ccb1db5f5c49b9e0bc7eb1dabc21'),
        ('9f2c8ac9-b3a9-5e48-8595-94b6dc0a2c87'::uuid, 'e68ca18483cc217c16200f08887ea20cffd4e25a97aee4973f42fece74facbb0'),
        ('181a0e70-5540-5bd2-8248-60dd099d515b'::uuid, 'e6b40dd62df1dfe2cfc6a444d276a1cb624f445c372c2aacad6e1e01c2ae5aaa')
      ) AS reviewed(proposal_id, material_sha256)
      JOIN miopages_wp.wordpress_operator_grants g ON g.web_presence_id=p.web_presence_id AND g.managed_site_id=p.managed_site_id
      JOIN miopages_wp.wordpress_operator_credentials c ON c.id=g.operator_id
      JOIN miopages_wp.wordpress_operator_grants preview ON preview.operator_id=c.id
        AND preview.web_presence_id=g.web_presence_id AND preview.managed_site_id=g.managed_site_id
      JOIN miopages_wp.wordpress_installations i ON i.web_presence_id=p.web_presence_id
        AND i.managed_site_id=p.managed_site_id AND i.organization_id=p.organization_id
      WHERE reviewed.proposal_id=p.id
        AND reviewed.material_sha256=encode(sha256(convert_to(jsonb_build_object(
          'page',NEW.data->'page','resolved',NEW.data->'resolved','candidate',NEW.data->'candidate')::text,'UTF8')),'hex')
        AND NEW.data->'author'=jsonb_build_object('operatorId',c.id,'authorityReference',g.id)
        AND g.permission='prepare-site-proposal' AND g.revoked_at IS NULL
        AND preview.permission='preview-site-proposal' AND preview.revoked_at IS NULL
        AND c.revoked_at IS NULL AND c.expires_at<>'infinity'::timestamptz AND c.expires_at>clock_timestamp()
        AND i.id='d84ebc69-46d5-4c64-adc6-ac7b87468f89' AND i.generation=1
        AND i.origin='https://miopages.org' AND i.status='active'
    ) THEN RAISE EXCEPTION 'Exact reviewed private workflow proposal required'; END IF;
  END IF;
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
  IF installed IS DISTINCT FROM '2e1c3df2dfd9fbf0ddc4db184e81ba649f7655d0beb03f6c1b01f72a6b603a97' OR after_state IS DISTINCT FROM before_state THEN
    RAISE EXCEPTION 'Proposal guard identity, privileges or resulting definition changed';
  END IF;
END
$guard_change$;
COMMIT;
