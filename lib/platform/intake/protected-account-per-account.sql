-- Protected database rules per Account (safeguards review item 2, Principal, Nov 25).
-- The first install named C0's exact activation case and Knowledge record. These rules cover
-- every Account Core is scoped to (core_development_scope), so a new Client needs no new rules.
-- The same columns, privileges and check options as before; only the C0-only filters go.
CREATE OR REPLACE VIEW miopages_core_account.activation_customer_bindings AS
SELECT b.* FROM public.activation_customer_bindings b
JOIN miopages_wp.core_development_scope s USING (web_presence_id,managed_site_id);
CREATE OR REPLACE VIEW miopages_core_account.business_knowledge AS
SELECT k.* FROM public.business_knowledge k WHERE k.contract_version=1 AND EXISTS
 (SELECT 1 FROM miopages_core_account.activation_customer_bindings b WHERE b.web_presence_id=k.web_presence_id)
WITH LOCAL CHECK OPTION;
