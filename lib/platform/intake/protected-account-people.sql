-- The Account's Client people (Principal, Nov 25): update 0004 in the protected account update
-- sequence (scripts/db/protected-account-updates.ts), applied after people.sql in the same step.
-- Creates no grants and no people: a reviewed enrollment adds the permission row and the list.
ALTER TABLE miopages_core_account.account_people_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE miopages_core_account.account_people_events FORCE ROW LEVEL SECURITY;
CREATE POLICY exact_account_people ON miopages_core_account.account_people_events TO miopages_core_development
USING (EXISTS (SELECT 1 FROM miopages_core_account.activation_customer_bindings b WHERE b.web_presence_id=account_people_events.web_presence_id))
WITH CHECK (EXISTS (SELECT 1 FROM miopages_core_account.activation_customer_bindings b WHERE b.web_presence_id=account_people_events.web_presence_id));
REVOKE ALL ON miopages_core_account.account_people_events FROM PUBLIC;
REVOKE ALL ON FUNCTION miopages_core_account.account_people_guard() FROM PUBLIC;
GRANT SELECT,INSERT ON miopages_core_account.account_people_events TO miopages_core_development;

-- Extend the permission vocabulary; keeping the list needs no customer mandate.
ALTER TABLE miopages_wp.wordpress_operator_grants DROP CONSTRAINT wordpress_operator_grants_permission_check;
ALTER TABLE miopages_wp.wordpress_operator_grants ADD CONSTRAINT wordpress_operator_grants_permission_check CHECK(permission IN (
 'prepare-site-proposal','inspect-site-proposal','revise-site-proposal','preview-site-proposal','approve-site-proposal',
 'review-private-stage','enroll','rotate','revoke','issue','authorize-native-draft',
 'confirm-business-information','inspect-inquiry-outcomes','record-inquiry-outcome','manage-account-people'));
CREATE OR REPLACE VIEW miopages_wp.core_development_grants AS
SELECT g.id,g.operator_id,g.web_presence_id,g.managed_site_id,g.permission,g.customer,g.revoked_at
FROM miopages_wp.wordpress_operator_grants g JOIN miopages_wp.core_development_scope s USING(web_presence_id,managed_site_id)
WHERE g.permission IN ('inspect-site-proposal','prepare-site-proposal',
 'confirm-business-information','inspect-inquiry-outcomes','record-inquiry-outcome','manage-account-people');
