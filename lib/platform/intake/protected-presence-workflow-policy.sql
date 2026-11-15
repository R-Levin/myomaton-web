-- Apply in one reviewed transaction around the existing presence-workflow DDL.
-- Its tables must be created under miopages_core_workflow, with FKs to public.
REVOKE ALL ON SCHEMA miopages_core_workflow FROM PUBLIC;
GRANT USAGE ON SCHEMA miopages_core_workflow TO miopages_core_development;

-- The migration owner sets this transaction-local name only after the case
-- manifest check. A missing or inaccessible draft aborts the whole install.
CREATE TABLE miopages_core_workflow.authorized_intake (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  intake_id uuid NOT NULL UNIQUE REFERENCES public.prospect_intakes(id)
);
INSERT INTO miopages_core_workflow.authorized_intake(intake_id)
SELECT id FROM miopages_wp.core_development_drafts WHERE id = current_setting('miopages.workflow_intake')::uuid;
DO $$ BEGIN
  IF (SELECT count(*) FROM miopages_core_workflow.authorized_intake) <> 1 THEN
    RAISE EXCEPTION 'exact workflow intake refused';
  END IF;
END $$;

ALTER TABLE miopages_core_workflow.presence_workflow_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE miopages_core_workflow.presence_workflow_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE miopages_core_workflow.presence_workflow_events FORCE ROW LEVEL SECURITY;
ALTER TABLE miopages_core_workflow.presence_workflow_outputs FORCE ROW LEVEL SECURITY;

CREATE POLICY presence_case ON miopages_core_workflow.presence_workflow_events
  TO miopages_core_development
  USING (EXISTS (SELECT 1 FROM miopages_wp.core_development_drafts d
    JOIN miopages_core_workflow.authorized_intake i ON i.intake_id=d.id
    WHERE (d.id, d.web_presence_id, d.managed_site_id) =
      (presence_workflow_events.intake_id, presence_workflow_events.web_presence_id, presence_workflow_events.managed_site_id)));
CREATE POLICY presence_output ON miopages_core_workflow.presence_workflow_outputs
  TO miopages_core_development
  USING (EXISTS (SELECT 1 FROM miopages_wp.core_development_drafts d
    JOIN miopages_core_workflow.authorized_intake i ON i.intake_id=d.id
    WHERE (d.id, d.web_presence_id, d.managed_site_id) =
      (presence_workflow_outputs.intake_id, presence_workflow_outputs.web_presence_id, presence_workflow_outputs.managed_site_id)));

REVOKE ALL ON ALL TABLES IN SCHEMA miopages_core_workflow FROM PUBLIC;
GRANT SELECT ON miopages_core_workflow.authorized_intake TO miopages_core_development;
GRANT SELECT, INSERT ON miopages_core_workflow.presence_workflow_events,
  miopages_core_workflow.presence_workflow_outputs TO miopages_core_development;
