-- Extends the protected WordPress adapter only. Keep launch approval separate.
ALTER TABLE wordpress_operator_grants DROP CONSTRAINT wordpress_operator_grants_permission_check;
ALTER TABLE wordpress_operator_grants ADD CONSTRAINT wordpress_operator_grants_permission_check CHECK (permission IN (
  'prepare-site-proposal','inspect-site-proposal','revise-site-proposal','preview-site-proposal',
  'approve-site-proposal','review-private-stage','enroll','rotate','revoke','issue','authorize-native-draft'
));

CREATE TABLE wordpress_native_draft_authorizations (
  installation_id uuid NOT NULL REFERENCES wordpress_installations(id),
  site_proposal_id uuid NOT NULL,
  revision integer NOT NULL CHECK (revision > 0),
  candidate_digest text NOT NULL CHECK (candidate_digest ~ '^[0-9a-f]{64}$'),
  previous_digest text CHECK (previous_digest ~ '^[0-9a-f]{64}$'),
  reviewer_grant_id uuid NOT NULL REFERENCES wordpress_operator_grants(id),
  authorizer_grant_id uuid NOT NULL REFERENCES wordpress_operator_grants(id),
  authorized_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (installation_id, site_proposal_id, revision),
  UNIQUE (installation_id, candidate_digest),
  CHECK ((revision = 1) = (previous_digest IS NULL)),
  CHECK (reviewer_grant_id <> authorizer_grant_id)
);

