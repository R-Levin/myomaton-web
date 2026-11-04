-- Run after 0016 in the same protected application schema and as its owner.
CREATE TABLE wordpress_operator_credentials (
  id uuid PRIMARY KEY,
  token_sha256 text NOT NULL UNIQUE CHECK (token_sha256 ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);

CREATE TABLE wordpress_operator_grants (
  id uuid PRIMARY KEY,
  operator_id uuid NOT NULL REFERENCES wordpress_operator_credentials(id),
  web_presence_id uuid NOT NULL,
  managed_site_id uuid NOT NULL,
  permission text NOT NULL CHECK (permission IN (
    'prepare-site-proposal','inspect-site-proposal','revise-site-proposal','preview-site-proposal',
    'approve-site-proposal','review-private-stage','enroll','rotate','revoke','issue')),
  customer jsonb,
  revoked_at timestamptz,
  FOREIGN KEY (web_presence_id, managed_site_id) REFERENCES managed_sites(web_presence_id,id),
  CHECK ((permission='approve-site-proposal') = (customer IS NOT NULL))
);

CREATE UNIQUE INDEX wordpress_operator_grant_active
  ON wordpress_operator_grants(operator_id,web_presence_id,managed_site_id,permission) WHERE revoked_at IS NULL;

CREATE TABLE wordpress_proposal_approvals (
  proposal_id uuid NOT NULL,
  approval_digest text NOT NULL,
  grant_id uuid NOT NULL REFERENCES wordpress_operator_grants(id),
  PRIMARY KEY (proposal_id, approval_digest),
  FOREIGN KEY (proposal_id, approval_digest) REFERENCES site_change_events(proposal_id,digest)
);

CREATE TABLE wordpress_private_releases (
  id uuid PRIMARY KEY,
  web_presence_id uuid NOT NULL,
  managed_site_id uuid NOT NULL,
  proposal_id uuid NOT NULL REFERENCES site_change_proposals(id),
  approval_digest text NOT NULL,
  projection_digest text NOT NULL CHECK (projection_digest ~ '^[a-f0-9]{64}$'),
  reviewer_grant_id uuid NOT NULL REFERENCES wordpress_operator_grants(id),
  reviewed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY (web_presence_id, managed_site_id) REFERENCES managed_sites(web_presence_id,id),
  FOREIGN KEY (proposal_id, approval_digest) REFERENCES wordpress_proposal_approvals(proposal_id,approval_digest)
);
CREATE INDEX wordpress_private_releases_site ON wordpress_private_releases(web_presence_id,managed_site_id,reviewed_at DESC,id DESC);

ALTER TABLE wordpress_installations ADD COLUMN request_epoch bigint NOT NULL DEFAULT 0;

ALTER TABLE wordpress_deliveries DROP CONSTRAINT wordpress_deliveries_release_id_site_content_events_id_fk;
ALTER TABLE wordpress_deliveries
  ADD COLUMN canonical_release_id uuid REFERENCES site_content_events(id),
  ADD COLUMN private_release_id uuid REFERENCES wordpress_private_releases(id);
UPDATE wordpress_deliveries SET canonical_release_id=release_id;
ALTER TABLE wordpress_deliveries ADD CONSTRAINT wordpress_delivery_exact_release CHECK (
  (canonical_release_id IS NOT NULL AND canonical_release_id=release_id AND private_release_id IS NULL)
  OR (private_release_id IS NOT NULL AND private_release_id=release_id AND canonical_release_id IS NULL)
);

-- Old rehearsal code uses only release_id. Keep its insert contract.
CREATE FUNCTION wordpress_delivery_release_reference() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.private_release_id IS NULL AND NEW.canonical_release_id IS NULL THEN
    NEW.canonical_release_id := NEW.release_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER wordpress_delivery_release_reference BEFORE INSERT ON wordpress_deliveries
  FOR EACH ROW EXECUTE FUNCTION wordpress_delivery_release_reference();
