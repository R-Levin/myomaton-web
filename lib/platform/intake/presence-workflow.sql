-- Local proof installs these tables in its disposable PostgreSQL database only.
-- Grants, retention and migration ordering require review before hosted use.
CREATE TABLE presence_workflow_events (
  web_presence_id uuid NOT NULL,
  managed_site_id uuid NOT NULL,
  intake_id uuid NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  digest text NOT NULL CHECK (digest ~ '^[a-f0-9]{64}$'),
  PRIMARY KEY (web_presence_id, managed_site_id, intake_id, version),
  FOREIGN KEY (web_presence_id, intake_id)
    REFERENCES prospect_intakes (web_presence_id, id) ON DELETE CASCADE
);

CREATE TABLE presence_workflow_outputs (
  web_presence_id uuid NOT NULL,
  managed_site_id uuid NOT NULL,
  intake_id uuid NOT NULL,
  attempt_id uuid NOT NULL,
  retained_at timestamptz NOT NULL DEFAULT now(),
  bytes bytea NOT NULL,
  digest text NOT NULL CHECK (digest ~ '^[a-f0-9]{64}$'),
  PRIMARY KEY (web_presence_id, managed_site_id, intake_id, attempt_id),
  FOREIGN KEY (web_presence_id, intake_id)
    REFERENCES prospect_intakes (web_presence_id, id) ON DELETE CASCADE
);
