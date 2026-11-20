-- Stop the protected account build/use first; restore the matching old artifact
-- and withdraw account-cycle-scope.json into protected recovery custody.
-- Preserve all new canonical versions, grant rows, history and outcome evidence.
-- This rollback removes authority; it never rewinds business facts or deletes data.
REVOKE ALL ON ALL TABLES IN SCHEMA miopages_core_account FROM miopages_core_development;
REVOKE USAGE ON SCHEMA miopages_core_account FROM miopages_core_development;
CREATE OR REPLACE VIEW miopages_wp.core_development_grants AS
SELECT g.id,g.operator_id,g.web_presence_id,g.managed_site_id,g.permission,g.customer,g.revoked_at
FROM miopages_wp.wordpress_operator_grants g JOIN miopages_wp.core_development_scope s USING(web_presence_id,managed_site_id)
WHERE g.permission IN ('inspect-site-proposal','prepare-site-proposal');
-- The additive permission vocabulary stays for audit rows; it creates no grants.
-- Revoke exactly the enrollment receipt's newly installed grants separately.
