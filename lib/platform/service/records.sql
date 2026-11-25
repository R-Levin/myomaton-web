-- Each Account's service record (rebuild plan, milestone 1): its Change record and every Version
-- of its Work products, saved as numbered, append-only versions. Nothing is rewritten.
CREATE TABLE service_records (
  web_presence_id uuid NOT NULL REFERENCES web_presences(id),
  managed_site_id uuid NOT NULL REFERENCES managed_sites(id),
  version integer NOT NULL CHECK (version > 0),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  digest text NOT NULL CHECK (digest ~ '^[a-f0-9]{64}$'),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (web_presence_id, managed_site_id, version)
);
CREATE FUNCTION service_record_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Service records are append only'; END IF;
  IF NEW.version <> 1 + COALESCE((SELECT max(version) FROM service_records
    WHERE web_presence_id = NEW.web_presence_id AND managed_site_id = NEW.managed_site_id), 0)
    THEN RAISE EXCEPTION 'Next version required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM managed_sites WHERE id = NEW.managed_site_id AND web_presence_id = NEW.web_presence_id)
    THEN RAISE EXCEPTION 'The site belongs to another Account'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER service_record_guard BEFORE INSERT OR UPDATE OR DELETE ON service_records FOR EACH ROW EXECUTE FUNCTION service_record_guard();
