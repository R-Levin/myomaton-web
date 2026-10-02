-- Historical Microsite identifiers become Managed Site identifiers; no row DML.
-- One atomic statement, also when rehearsed without a migration-runner transaction.
DO $$
DECLARE
  column_name text;
BEGIN
  -- Prevent a concurrent legacy visibility write between preflight and cutover.
  LOCK TABLE "public"."navigations", "public"."navigation_items",
    "public"."microsites", "public"."pages" IN ACCESS EXCLUSIVE MODE;
  IF EXISTS (SELECT 1 FROM "public"."navigations" WHERE configuration -> 'surfaces' ? 'microsite')
    OR EXISTS (SELECT 1 FROM "public"."navigation_items" WHERE configuration -> 'surfaces' ? 'microsite') THEN
    RAISE EXCEPTION 'Legacy surfaces.microsite configuration exists. Review and explicitly migrate visibility to surfaces.managedSite before this rename; no automatic customer-state rewrite.';
  END IF;

  ALTER TABLE "public"."microsites" RENAME TO "managed_sites";
  ALTER TABLE "public"."pages" RENAME COLUMN "microsite_id" TO "managed_site_id";
  ALTER TABLE "public"."managed_sites" RENAME CONSTRAINT "microsites_pkey" TO "managed_sites_pkey";
  ALTER TABLE "public"."managed_sites" RENAME CONSTRAINT "microsites_web_presence_id_web_presences_id_fk" TO "managed_sites_web_presence_id_web_presences_id_fk";
  ALTER TABLE "public"."pages" RENAME CONSTRAINT "pages_microsite_id_microsites_id_fk" TO "pages_managed_site_id_managed_sites_id_fk";
  ALTER TABLE "public"."pages" RENAME CONSTRAINT "pages_microsite_id_slug_unique" TO "pages_managed_site_id_slug_unique";

  -- PostgreSQL 18 stores named NOT NULL constraints independently of indexes.
  FOREACH column_name IN ARRAY ARRAY['id', 'web_presence_id', 'name', 'status',
    'configuration', 'metadata', 'version', 'created_at', 'updated_at'] LOOP
    EXECUTE format('ALTER TABLE "public"."managed_sites" RENAME CONSTRAINT %I TO %I',
      'microsites_' || column_name || '_not_null', 'managed_sites_' || column_name || '_not_null');
  END LOOP;
  ALTER TABLE "public"."pages" RENAME CONSTRAINT "pages_microsite_id_not_null" TO "pages_managed_site_id_not_null";
END $$;
