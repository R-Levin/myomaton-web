-- Local proof only. Hosted role, retention and installation bindings remain pending.
CREATE TABLE first_party_events (
  web_presence_id uuid NOT NULL REFERENCES web_presences(id),
  managed_site_id uuid NOT NULL REFERENCES managed_sites(id),
  source_id uuid NOT NULL,
  environment text NOT NULL CHECK (environment IN ('synthetic', 'development', 'live')),
  revision text NOT NULL CHECK (revision ~ '^[a-f0-9]{64}$'),
  event_id uuid NOT NULL,
  observed_at timestamptz NOT NULL,
  kind text NOT NULL CHECK (kind IN ('page-observed', 'action-selected', 'contact-accepted')),
  page text NOT NULL,
  action text,
  attribution text CHECK (attribution IN ('direct-or-unattributed', 'search', 'referral', 'campaign')),
  digest text NOT NULL CHECK (digest ~ '^[a-f0-9]{64}$'),
  PRIMARY KEY (web_presence_id,managed_site_id,source_id,environment,revision,event_id)
);
CREATE INDEX first_party_events_period ON first_party_events
  (web_presence_id,managed_site_id,source_id,environment,revision,observed_at);
