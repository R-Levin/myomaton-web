-- Install after protected-account-policy.sql, in the SAME reviewed transaction.
-- Reuse the existing outcome journal DDL with schema-qualified public FKs.
-- Do not grant access to raw Contact fields or creation of purported live leads.
CREATE VIEW miopages_core_account.contact_submissions AS
SELECT s.id,s.web_presence_id,s.managed_site_id,s.created_at,s.delivery_status,s.page_id,s.expires_at
FROM public.contact_submissions s WHERE EXISTS
 (SELECT 1 FROM miopages_core_account.activation_customer_bindings b
  WHERE b.web_presence_id=s.web_presence_id AND b.managed_site_id=s.managed_site_id);
CREATE TRIGGER inquiry_metadata_readonly INSTEAD OF UPDATE ON miopages_core_account.contact_submissions
FOR EACH ROW EXECUTE FUNCTION miopages_core_account.reject_identity_update();
REVOKE ALL ON miopages_core_account.contact_submissions FROM PUBLIC;
GRANT SELECT,UPDATE ON miopages_core_account.contact_submissions TO miopages_core_development;

ALTER TABLE miopages_core_account.contact_outcome_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE miopages_core_account.contact_outcome_events FORCE ROW LEVEL SECURITY;
CREATE POLICY exact_account_development ON miopages_core_account.contact_outcome_events TO miopages_core_development
USING (environment='development' AND EXISTS
 (SELECT 1 FROM miopages_core_account.activation_customer_bindings b
 WHERE b.web_presence_id=contact_outcome_events.web_presence_id AND b.managed_site_id=contact_outcome_events.managed_site_id))
WITH CHECK (environment='development' AND EXISTS
 (SELECT 1 FROM miopages_core_account.activation_customer_bindings b
 WHERE b.web_presence_id=contact_outcome_events.web_presence_id AND b.managed_site_id=contact_outcome_events.managed_site_id));
REVOKE ALL ON miopages_core_account.contact_outcome_events FROM PUBLIC;
REVOKE ALL ON FUNCTION miopages_core_account.contact_outcome_guard() FROM PUBLIC;
GRANT SELECT,INSERT ON miopages_core_account.contact_outcome_events TO miopages_core_development;
