-- The Account's Client people: who speaks for the Client on this Account (Principal, Nov 25).
-- An append-only journal: a person is added, and may later be removed; nothing is rewritten.
-- Local integration schema; protected deployment adds an exact scoped policy.
CREATE TABLE account_people_events (
  web_presence_id uuid NOT NULL REFERENCES web_presences(id),
  person_id uuid NOT NULL,
  version integer NOT NULL CHECK (version BETWEEN 1 AND 100),
  event text NOT NULL CHECK (event IN ('add','remove')),
  role text NOT NULL CHECK (role IN ('client')),
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
  email text NOT NULL CHECK (length(email) BETWEEN 3 AND 254 AND email = lower(email) AND email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  subject_id uuid,
  recorded_by text NOT NULL CHECK (length(recorded_by) BETWEEN 1 AND 200),
  authority_reference text NOT NULL CHECK (length(authority_reference) BETWEEN 1 AND 300),
  reason text NOT NULL CHECK (length(reason) BETWEEN 1 AND 1000),
  at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (web_presence_id,person_id,version)
);
CREATE FUNCTION account_people_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE previous account_people_events;
BEGIN
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Account people history is append only'; END IF;
  SELECT * INTO previous FROM account_people_events WHERE web_presence_id=NEW.web_presence_id AND person_id=NEW.person_id
    ORDER BY version DESC LIMIT 1;
  IF NEW.version<>1+COALESCE(previous.version,0) THEN RAISE EXCEPTION 'Exact person successor required'; END IF;
  IF NEW.event='add' AND previous.event='add' THEN RAISE EXCEPTION 'Person is already on the Account'; END IF;
  IF NEW.event='remove' AND (previous.event IS DISTINCT FROM 'add' OR previous.email<>NEW.email OR previous.name<>NEW.name
    OR previous.subject_id IS DISTINCT FROM NEW.subject_id) THEN RAISE EXCEPTION 'Only a current person can be removed, as recorded'; END IF;
  IF NEW.event='add' AND EXISTS (SELECT 1 FROM account_people_events e WHERE e.web_presence_id=NEW.web_presence_id
    AND e.person_id<>NEW.person_id AND e.event='add' AND (e.email=NEW.email OR e.subject_id=NEW.subject_id)
    AND e.version=(SELECT max(version) FROM account_people_events l WHERE l.web_presence_id=e.web_presence_id AND l.person_id=e.person_id))
    THEN RAISE EXCEPTION 'That email or sign-in already belongs to another person on the Account'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER account_people_guard BEFORE INSERT OR UPDATE OR DELETE ON account_people_events FOR EACH ROW EXECUTE FUNCTION account_people_guard();
