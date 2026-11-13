-- Install in one reviewed transaction after protected-core-policy.sql.
-- No active site, hostname, public Contact form or delivery route is changed.
INSERT INTO public.contact_definitions (id, web_presence_id, name, configuration)
SELECT 'e113a3ed-ca49-4f23-9c25-2ffd40443c55', web_presence_id, 'Protected development inquiry',
  '{"fields":[{"key":"message","label":"Synthetic inquiry","required":true}]}'::jsonb
FROM miopages_wp.core_development_scope;

CREATE VIEW miopages_wp.core_development_inquiries AS
SELECT id, web_presence_id, managed_site_id, page_id, section_id,
  contact_definition_id, contact_definition_version, fields, delivery_route_key,
  delivery_status, idempotency_key, created_at, updated_at, expires_at
FROM public.contact_submissions
WHERE (web_presence_id, managed_site_id) IN (
  SELECT web_presence_id, managed_site_id FROM miopages_wp.core_development_scope
)
AND contact_definition_id = 'e113a3ed-ca49-4f23-9c25-2ffd40443c55'
AND contact_definition_version = 1
AND EXISTS (
  SELECT 1 FROM public.contact_definitions d
  WHERE d.id = contact_submissions.contact_definition_id
  AND d.web_presence_id = contact_submissions.web_presence_id AND d.version = 1
  AND d.status = 'active' AND d.delivery_route_key IS NULL
)
AND page_id IS NULL AND section_id IS NULL
AND fields = '{"message":"Before I get in touch, what should I bring if I already have a website?"}'::jsonb
AND delivery_status = 'disabled' AND delivery_route_key IS NULL
AND created_at <= now() + interval '1 minute'
AND expires_at = created_at + interval '24 hours'
AND idempotency_key = 'dev_c820bc1af081e6401a57de0fd745d4205f2f2947d79af2fe7554dd8e7a8c8c0b'
WITH LOCAL CHECK OPTION;

REVOKE ALL ON miopages_wp.core_development_inquiries FROM PUBLIC;
GRANT SELECT (id, web_presence_id, managed_site_id, page_id, section_id, contact_definition_id,
  contact_definition_version, fields, delivery_status, idempotency_key, created_at, expires_at),
INSERT (web_presence_id, managed_site_id, page_id, section_id, contact_definition_id,
  contact_definition_version, fields, delivery_route_key, delivery_status, idempotency_key, created_at, updated_at, expires_at)
ON miopages_wp.core_development_inquiries TO miopages_core_development;
