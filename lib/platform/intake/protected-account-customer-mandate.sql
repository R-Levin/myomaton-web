-- Proposed compatibility amendment; NOT covered by the original forward checksum.
-- Apply in the SAME guarded transaction as the approved account policy/enrollment.
-- Keep every original permission's customer requirement unchanged. Only the two
-- already approved new confirmation permissions also require a customer mandate.
ALTER TABLE miopages_wp.wordpress_operator_grants DROP CONSTRAINT wordpress_operator_grants_check;
ALTER TABLE miopages_wp.wordpress_operator_grants ADD CONSTRAINT wordpress_operator_grants_check
CHECK ((permission IN ('approve-site-proposal','confirm-business-information','record-inquiry-outcome')) = (customer IS NOT NULL));
-- Rollback withdraws access and revokes the exact new grants, retaining audit rows.
-- Like the additive permission vocabulary, this compatibility check stays so that
-- retained revoked mandate-bearing rows are not deleted or stripped of evidence.
