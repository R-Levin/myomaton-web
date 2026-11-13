-- Run only after reviewing the existing recovery point. The role is created
-- separately through the provider-owner connection with protected custody.
-- These views leave all existing table policies and role behavior intact.
CREATE VIEW miopages_wp.core_development_drafts AS
SELECT * FROM public.prospect_intakes
WHERE web_presence_id = '819d007a-595d-4374-a2f0-96b900d46559'
  AND managed_site_id = '1d92a248-416f-4e22-baaf-d2f1fca70352'
  AND questionnaire_version = 'paid-onboarding/2' AND entry_intent = 'DIRECT_START'
  AND state = 'draft'
WITH LOCAL CHECK OPTION;

CREATE VIEW miopages_wp.core_development_scope AS
SELECT m.id AS managed_site_id, w.id AS web_presence_id
FROM public.managed_sites m
JOIN public.web_presences w ON w.id=m.web_presence_id
JOIN public.organizations o ON o.id=w.organization_id
JOIN public.activation_customer_bindings b
  ON b.managed_site_id=m.id AND b.web_presence_id=w.id AND b.organization_id=o.id
WHERE m.id = '1d92a248-416f-4e22-baaf-d2f1fca70352'
  AND w.id = '819d007a-595d-4374-a2f0-96b900d46559'
  AND m.status='inactive' AND w.status='inactive' AND o.status='inactive';

CREATE VIEW miopages_wp.core_development_grants AS
SELECT g.id, g.operator_id, g.web_presence_id, g.managed_site_id, g.permission, g.customer, g.revoked_at
FROM miopages_wp.wordpress_operator_grants g
JOIN miopages_wp.core_development_scope s USING (web_presence_id, managed_site_id)
WHERE g.permission IN ('inspect-site-proposal','prepare-site-proposal');

CREATE VIEW miopages_wp.core_development_credentials AS
SELECT c.id, c.token_sha256, c.expires_at, c.revoked_at
FROM miopages_wp.wordpress_operator_credentials c
WHERE EXISTS (SELECT 1 FROM miopages_wp.core_development_grants g WHERE g.operator_id=c.id);

REVOKE ALL ON miopages_wp.core_development_drafts, miopages_wp.core_development_scope,
  miopages_wp.core_development_grants, miopages_wp.core_development_credentials FROM PUBLIC;
GRANT USAGE ON SCHEMA miopages_wp TO miopages_core_development;
GRANT SELECT ON miopages_wp.core_development_drafts, miopages_wp.core_development_scope,
  miopages_wp.core_development_grants, miopages_wp.core_development_credentials TO miopages_core_development;
GRANT INSERT (web_presence_id,managed_site_id,entry_intent,questionnaire_version,resume_hash,expires_at,resume_expires_at),
  UPDATE (answers,provenance,step,version,updated_at) ON miopages_wp.core_development_drafts TO miopages_core_development;

-- The existing intake trigger reads managed_sites using the caller's
-- search path. Give only this role a scoped view of that dependency.
CREATE SCHEMA miopages_core_guard;
REVOKE ALL ON SCHEMA miopages_core_guard FROM PUBLIC;
CREATE VIEW miopages_core_guard.managed_sites AS
SELECT managed_site_id AS id, web_presence_id FROM miopages_wp.core_development_scope;
REVOKE ALL ON miopages_core_guard.managed_sites FROM PUBLIC;
GRANT USAGE ON SCHEMA miopages_core_guard TO miopages_core_development;
GRANT SELECT ON miopages_core_guard.managed_sites TO miopages_core_development;
