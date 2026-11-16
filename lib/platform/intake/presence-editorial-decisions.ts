import { fingerprint, object, text } from "../canonical/model";
import { IntakeError } from "./model";
import type { PresenceEvidence, WorkflowEditorial, WorkflowPage } from "./presence-workflow-artifacts";
import type { WorkflowActor } from "./presence-workflow";

export type EditorialFinding = {
  id: string;
  reviewRevision: number;
  suggestedTarget: string;
  concern: string;
};
type AssignedPage = { path: string; baseline: string };
type Decision = { status: "assigned" | "queued"; pages: AssignedPage[] }
  | { status: "open" }
  | { status: "resolved"; evidence: { kind: "source"; sourceId: string; digest: string }
    | { kind: "revised-pages"; pages: { path: string; digest: string }[] } };
export type EditorialDecision = Decision & { findingId: string; basedOnVersion: number; rationale: string; actor: WorkflowActor; at: string };
export type EditorialFindingView = EditorialFinding & { history: EditorialDecision[] };

export function editorialFindings(editorial: WorkflowEditorial | null, reviewRevision: number) {
  return (editorial?.unassigned ?? []).map(original => ({
    ...original, reviewRevision, id: fingerprint({ ...original, reviewRevision }),
  }));
}

export function withEditorialHistory(findings: readonly EditorialFinding[], decisions: readonly EditorialDecision[]): EditorialFindingView[] {
  const history = new Map<string, EditorialDecision[]>();
  for (const decision of decisions) {
    const entries = history.get(decision.findingId) ?? [];
    entries.push(decision);
    history.set(decision.findingId, entries);
  }
  return findings.map(finding => ({ ...finding, history: history.get(finding.id) ?? [] }));
}

export function editorialDecision(raw: unknown, findings: readonly EditorialFindingView[], pages: readonly WorkflowPage[],
  sources: readonly PresenceEvidence[], actor: WorkflowActor, version: number, now: number): EditorialDecision {
  try {
    const input = object(raw, ["findingId", "status", "paths", "rationale", "evidence"]);
    const finding = findings.find(item => item.id === input.findingId);
    if (!finding) throw new IntakeError("draft_changed", 409);
    const base = { findingId: finding.id, basedOnVersion: version, rationale: text(input.rationale, 2000, true),
      actor, at: new Date(now).toISOString() };
    const available = new Map(pages.map(page => [page.path, page]));
    if (input.status === "assigned" && input.evidence === undefined) {
      if (!Array.isArray(input.paths) || input.paths.length < 1 || input.paths.length > available.size) throw new IntakeError("invalid_request");
      const paths = input.paths.map(path => text(path, 120));
      if (new Set(paths).size !== paths.length || paths.some(path => !available.has(path))) throw new IntakeError("invalid_request");
      return { ...base, status: "assigned", pages: paths.map(path => ({ path, baseline: fingerprint(available.get(path)) })) };
    }
    if (input.status === "open" && input.paths === undefined && input.evidence === undefined) return { ...base, status: "open" };
    if (input.status === "resolved" && input.paths === undefined) {
      const evidence = object(input.evidence, ["kind", "sourceId"]);
      if (evidence.kind === "source") {
        const source = sources.find(item => item.kind === "owner-confirmed" && item.id === evidence.sourceId);
        if (!source) throw new IntakeError("workflow_not_ready", 409);
        return { ...base, status: "resolved", evidence: { kind: "source", sourceId: source.id, digest: fingerprint(source) } };
      }
      if (evidence.kind === "revised-pages" && evidence.sourceId === undefined) {
        const queued = finding.history.at(-1);
        if (queued?.status !== "queued" || queued.pages.some(({ path, baseline }) =>
          !available.has(path) || fingerprint(available.get(path)) === baseline)) throw new IntakeError("workflow_not_ready", 409);
        return { ...base, status: "resolved", evidence: { kind: "revised-pages", pages: queued.pages.map(({ path }) =>
          ({ path, digest: fingerprint(available.get(path)) })) } };
      }
    }
    throw new IntakeError("invalid_request");
  } catch (error) {
    if (error instanceof IntakeError) throw error;
    throw new IntakeError("invalid_request");
  }
}
