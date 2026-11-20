-- Local integration schema; protected deployment requires an exact scoped policy.
CREATE TABLE contact_outcome_events (
  web_presence_id uuid NOT NULL REFERENCES web_presences(id),
  managed_site_id uuid NOT NULL REFERENCES managed_sites(id),
  submission_id uuid NOT NULL REFERENCES contact_submissions(id) ON DELETE CASCADE,
  environment text NOT NULL CHECK (environment IN ('development', 'live')),
  version integer NOT NULL CHECK (version > 0),
  request_id uuid NOT NULL,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload)='object'),
  digest text NOT NULL CHECK (digest ~ '^[a-f0-9]{64}$'),
  PRIMARY KEY (web_presence_id,managed_site_id,submission_id,environment,version),
  UNIQUE (web_presence_id,managed_site_id,environment,request_id)
);
CREATE FUNCTION contact_outcome_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' AND NOT EXISTS(SELECT 1 FROM contact_submissions WHERE id=OLD.submission_id) THEN RETURN OLD; END IF;
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Outcome history is append only'; END IF;
  IF NOT EXISTS(SELECT 1 FROM contact_submissions WHERE id=NEW.submission_id AND web_presence_id=NEW.web_presence_id AND managed_site_id=NEW.managed_site_id AND expires_at>now())
    THEN RAISE EXCEPTION 'Owned unexpired inquiry required'; END IF;
  IF NEW.version<>1+COALESCE((SELECT max(version) FROM contact_outcome_events WHERE web_presence_id=NEW.web_presence_id AND managed_site_id=NEW.managed_site_id AND submission_id=NEW.submission_id AND environment=NEW.environment),0)
    THEN RAISE EXCEPTION 'Exact outcome successor required'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER contact_outcome_guard BEFORE INSERT OR UPDATE OR DELETE ON contact_outcome_events FOR EACH ROW EXECUTE FUNCTION contact_outcome_guard();
