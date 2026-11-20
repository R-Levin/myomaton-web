-- PREPARATION ONLY. Install transactionally as the existing migration owner.
-- Exact retained C0 foundation; no public table privileges, activation or import.
CREATE SCHEMA miopages_core_account;
REVOKE ALL ON SCHEMA miopages_core_account FROM PUBLIC;
GRANT USAGE ON SCHEMA miopages_core_account TO miopages_core_development;

CREATE VIEW miopages_core_account.activation_customer_bindings AS
SELECT b.* FROM public.activation_customer_bindings b
JOIN miopages_wp.core_development_scope s USING (web_presence_id,managed_site_id)
WHERE b.case_id='e3e75949-f2af-4d58-9b31-d91e43862b4f'
  AND b.organization_id='b3b46645-0364-4329-83c7-86a6ea9e56c4';
CREATE VIEW miopages_core_account.organizations AS
SELECT o.* FROM public.organizations o WHERE o.status='inactive' AND EXISTS
 (SELECT 1 FROM miopages_core_account.activation_customer_bindings b WHERE b.organization_id=o.id);
CREATE VIEW miopages_core_account.web_presences AS
SELECT w.* FROM public.web_presences w WHERE w.status='inactive' AND EXISTS
 (SELECT 1 FROM miopages_core_account.activation_customer_bindings b WHERE b.web_presence_id=w.id);
CREATE VIEW miopages_core_account.managed_sites AS
SELECT m.* FROM public.managed_sites m WHERE m.status='inactive' AND EXISTS
 (SELECT 1 FROM miopages_core_account.activation_customer_bindings b WHERE b.managed_site_id=m.id);
CREATE VIEW miopages_core_account.business_knowledge AS
SELECT k.* FROM public.business_knowledge k WHERE k.contract_version=1
 AND k.id='52f23cfc-b690-447e-9475-0c3d8324d929' AND EXISTS
 (SELECT 1 FROM miopages_core_account.activation_customer_bindings b WHERE b.web_presence_id=k.web_presence_id)
WITH LOCAL CHECK OPTION;
CREATE VIEW miopages_core_account.business_knowledge_revisions AS
SELECT r.* FROM public.business_knowledge_revisions r WHERE EXISTS
 (SELECT 1 FROM miopages_core_account.business_knowledge k WHERE k.id=r.knowledge_id AND k.web_presence_id=r.web_presence_id)
WITH LOCAL CHECK OPTION;

-- Row locking requires UPDATE privilege even for SELECT FOR UPDATE. An
-- INSTEAD OF trigger denies actual identity/status mutation through this view.
CREATE FUNCTION miopages_core_account.reject_identity_update() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$ BEGIN
 RAISE EXCEPTION 'Account identity/status writes are not authorized';
END $$;
CREATE TRIGGER locked_identity_readonly INSTEAD OF UPDATE ON miopages_core_account.web_presences
FOR EACH ROW EXECUTE FUNCTION miopages_core_account.reject_identity_update();
GRANT SELECT ON miopages_core_account.activation_customer_bindings,miopages_core_account.organizations,
 miopages_core_account.web_presences,miopages_core_account.managed_sites,
 miopages_core_account.business_knowledge,miopages_core_account.business_knowledge_revisions TO miopages_core_development;
GRANT UPDATE ON miopages_core_account.web_presences TO miopages_core_development;
GRANT UPDATE(payload,version,updated_at) ON miopages_core_account.business_knowledge TO miopages_core_development;
GRANT INSERT(web_presence_id,knowledge_id,revision_version,snapshot,change_reason,responsible_identity)
 ON miopages_core_account.business_knowledge_revisions TO miopages_core_development;
REVOKE ALL ON FUNCTION miopages_core_account.reject_identity_update() FROM PUBLIC;

-- Extend the existing permission vocabulary, never reinterpret proposal authority.
ALTER TABLE miopages_wp.wordpress_operator_grants DROP CONSTRAINT wordpress_operator_grants_permission_check;
ALTER TABLE miopages_wp.wordpress_operator_grants ADD CONSTRAINT wordpress_operator_grants_permission_check CHECK(permission IN (
 'prepare-site-proposal','inspect-site-proposal','revise-site-proposal','preview-site-proposal','approve-site-proposal',
 'review-private-stage','enroll','rotate','revoke','issue','authorize-native-draft',
 'confirm-business-information','inspect-inquiry-outcomes','record-inquiry-outcome'));
CREATE OR REPLACE VIEW miopages_wp.core_development_grants AS
SELECT g.id,g.operator_id,g.web_presence_id,g.managed_site_id,g.permission,g.customer,g.revoked_at
FROM miopages_wp.wordpress_operator_grants g JOIN miopages_wp.core_development_scope s USING(web_presence_id,managed_site_id)
WHERE g.permission IN ('inspect-site-proposal','prepare-site-proposal',
 'confirm-business-information','inspect-inquiry-outcomes','record-inquiry-outcome');

-- No grants/credentials are created here. Activation separately verifies the
-- existing owner login and installs only the approved scoped permission rows.
REVOKE ALL ON ALL TABLES IN SCHEMA miopages_core_account FROM PUBLIC;
