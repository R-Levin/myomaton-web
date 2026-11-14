-- Reviewed forward-only correction for databases with the restricted Core policy.
-- Preserve the invoker and search path used by the managed_sites guard.
-- A draft-only update must not plan the submission lookup, which is reserved
-- for an actual transition to Operator review.
CREATE OR REPLACE FUNCTION public.prospect_intake_guard() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM managed_sites m WHERE m.id=NEW.managed_site_id AND m.web_presence_id=NEW.web_presence_id) THEN
    RAISE EXCEPTION 'Intake owner mismatch';
  END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.state<>'draft' OR NEW.version<>1 OR NEW.answers<>'{}'::jsonb OR NEW.provenance<>'{}'::jsonb OR NEW.step<>0 THEN RAISE EXCEPTION 'Invalid initial intake'; END IF;
  ELSE
    IF OLD.state<>'draft' THEN RAISE EXCEPTION 'Submitted intake is immutable'; END IF;
    IF (NEW.id,NEW.web_presence_id,NEW.managed_site_id,NEW.entry_intent,NEW.questionnaire_version,NEW.resume_hash,NEW.created_at,NEW.resume_expires_at)
      IS DISTINCT FROM (OLD.id,OLD.web_presence_id,OLD.managed_site_id,OLD.entry_intent,OLD.questionnaire_version,OLD.resume_hash,OLD.created_at,OLD.resume_expires_at)
      OR NEW.version<>OLD.version+1 THEN RAISE EXCEPTION 'Intake identity/version conflict'; END IF;
    IF NEW.state='draft' AND NEW.expires_at IS DISTINCT FROM OLD.expires_at THEN RAISE EXCEPTION 'Draft expiration is fixed'; END IF;
    IF NEW.state='needs_operator_review' THEN
      IF NOT EXISTS (
        SELECT 1 FROM prospect_intake_submissions s WHERE s.intake_id=NEW.id AND s.web_presence_id=NEW.web_presence_id
        AND s.answers=NEW.answers AND s.provenance=NEW.provenance AND s.draft_version=OLD.version
        AND s.submitted_at=NEW.submitted_at AND s.expires_at=NEW.expires_at
      ) THEN RAISE EXCEPTION 'Matching submission required'; END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
