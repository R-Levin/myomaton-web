import { useState } from "react";
import type { EditorialFindingView } from "../../lib/platform/intake/presence-editorial-decisions";
import type { PresenceWorkflowView } from "../../lib/platform/intake/presence-workflow";

const labels = { assigned: "Assigned for revision", queued: "Revision queued", open: "Open whole-site requirement", resolved: "Resolved" };
type Props = {
  finding: EditorialFindingView;
  workflow: PresenceWorkflowView;
  canEdit: boolean;
  busy: boolean;
  save: (editorial: object) => Promise<void>;
};

export function EditorialFindingPanel({ finding, workflow, canEdit, busy, save }: Props) {
  const last = finding.history.at(-1);
  const [decision, setDecision] = useState<"assigned" | "open" | "resolved">("assigned");
  const [paths, setPaths] = useState<string[]>([]);
  const [proof, setProof] = useState("");
  const [rationale, setRationale] = useState("");
  const sources = workflow.sources.filter(source => source.kind === "owner-confirmed");
  return <li>
    <p><strong>{finding.suggestedTarget}</strong> · {finding.concern}</p>
    <p>{last ? labels[last.status] : "Awaiting an Operator decision"} · Editorial review revision {finding.reviewRevision}</p>
    {finding.history.length > 0 && <details><summary>Decision history</summary>
      <ol>{finding.history.map(record => <li key={record.basedOnVersion}>
        <p>{labels[record.status]} · {new Date(record.at).toISOString().slice(0, 16).replace("T", " ")} UTC · Operator {record.actor.id}</p>
        <p>{record.rationale}</p>
        {("pages" in record) && <p>Pages {record.pages.map(page => page.path).join(", ")}</p>}
        {"evidence" in record && <p>{record.evidence.kind === "source"
          ? `Confirmed source ${record.evidence.sourceId}`
          : `Revised pages ${record.evidence.pages.map(page => page.path).join(", ")}`}</p>}
      </li>)}</ol>
    </details>}
    {canEdit && <details><summary>Record an editorial decision</summary>
      <form onSubmit={event => {
        event.preventDefault();
        void save({ findingId: finding.id, status: decision, rationale,
          ...(decision === "assigned" && { paths }),
          ...(decision === "resolved" && { evidence: proof === "revised-pages" ? { kind: "revised-pages" } : { kind: "source", sourceId: proof.slice(7) } }),
        });
      }}>
        <label>Decision <select value={decision} onChange={event => setDecision(event.target.value as typeof decision)}>
          <option value="assigned">Assign pages for revision</option>
          <option value="open">Keep open as a whole-site requirement</option>
          <option value="resolved">Resolve with evidence</option>
        </select></label>
        {decision === "assigned" && <fieldset><legend>Pages to revise</legend>
          {workflow.pages.map(page => <div key={page.path}><label>
            <input type="checkbox" value={page.path} checked={paths.includes(page.path)} onChange={event => {
              const checked = event.target.checked;
              setPaths(current => checked ? [...current, page.path] : current.filter(path => path !== page.path));
            }} /> {page.heading} ({page.path})
          </label></div>)}
        </fieldset>}
        {decision === "resolved" && <label>Evidence <select value={proof} onChange={event => setProof(event.target.value)}>
          <option value="">Choose evidence</option>
          {last?.status === "queued" && <option value="revised-pages">Check the revised pages</option>}
          {sources.map(source => <option value={"source:" + source.id} key={source.id}>{source.label}</option>)}
        </select></label>}
        <label>Reason <textarea value={rationale} maxLength={2000} onChange={event => setRationale(event.target.value)} required /></label>
        <button type="submit" disabled={busy || !rationale.trim() || (decision === "assigned" && !paths.length) ||
          (decision === "resolved" && (!proof || (proof === "revised-pages" && last?.status !== "queued")))}>Save editorial decision</button>
      </form>
    </details>}
  </li>;
}
