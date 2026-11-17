import { useEffect, useState } from "react";
import type { PresenceEvidence } from "../../lib/platform/intake/presence-workflow-artifacts";
import type { PresenceWorkflowView } from "../../lib/platform/intake/presence-workflow";
import { EditorialFindingPanel } from "./editorial-finding-panel";
import type { PerformanceSnapshot } from "../../lib/platform/measurement/first-party";
import styles from "../../components/intake/interview.module.css";

const nextLabel: Record<string, string> = {
  research: "Gather research", report: "Prepare the business report", direction: "Prepare Presence Direction",
  blueprint: "Plan the website", page: "Draft the next page", editorial: "Check the whole site",
};
const activeStep: Record<string, string> = {
  research: "Gathering research", report: "Writing the business assessment", direction: "Preparing Presence Direction",
  blueprint: "Designing the site structure", page: "Drafting site pages", editorial: "Checking the complete draft",
};

export function isPresenceWorkflowWorking(workflow: PresenceWorkflowView | null | undefined) {
  return Boolean(workflow && !workflow.failure && (workflow.next === "in-progress" || Object.hasOwn(activeStep, workflow.next)));
}

const failureLabel: Record<string, string> = {
  "operation-blocked": "Core stopped before it could complete this operation.",
  "output-invalid": "Core retained the response but could not validate it for review.",
  "outcome-unknown": "Core could not verify whether this step finished. Recovery does not send the step again.",
};

const artifactIssueLabel = {
  citation: "A citation falls outside the approved evidence.",
  "page-binding": "A page reference does not match the candidate’s page set.",
  "action-destination": "An action destination does not match a verified route.",
  "shape-or-content": "The returned content does not meet the review format.",
};

const findingGroups = [
  { status: "established", label: "Findings grounded in confirmed evidence" },
  { status: "proposed", label: "Interpretations to review" },
  { status: "unresolved", label: "Open decisions" },
] as const;

const sourceLabels: Record<PresenceEvidence["kind"], string> = {
  "owner-confirmed": "Owner-confirmed knowledge",
  "earlier-review-answer": "Prior Review answer",
  "earlier-review-assessment": "Prior Review assessment",
  "website-observation": "Website observation",
  "customer-unconfirmed": "Unconfirmed interview answer",
  "historical-discovery": "Historical discovery",
  "service-direction": "Recorded service direction",
  "public-research": "Public research",
};

function SourceReferences({ sources, includeRecords = false }: { sources: PresenceEvidence[]; includeRecords?: boolean }) {
  const [openRecord, setOpenRecord] = useState<string>();
  if (!sources.length) return null;
  return <details className={styles.sourceReferences}>
    <summary>{includeRecords ? "Browse source records" : `Evidence · ${sources[0].label}${sources.length > 1 ? ` and ${sources.length - 1} more` : ""}`}</summary>
    <ul>{sources.map(source => <li key={source.id}>
      <strong>{source.label}</strong> · {sourceLabels[source.kind]}{source.date ? ` · ${source.date}` : ""}
      <div className={styles.hint}>{source.reference}</div>
      {includeRecords && <button className={styles.secondary} type="button" aria-expanded={openRecord === source.id}
        onClick={() => setOpenRecord(openRecord === source.id ? undefined : source.id)}>
        {openRecord === source.id ? "Hide source record" : "Show source record"}</button>}
      {openRecord === source.id && <p className={styles.sourceRecord}>{source.content}</p>}
    </li>)}</ul>
  </details>;
}

export function PresenceWorkflowPanel({ hosted, workflow, snapshot, busy, run, canTriage = false }: {
  hosted: boolean; workflow: PresenceWorkflowView | null; snapshot?: PerformanceSnapshot; busy: boolean; run: (input: object) => Promise<void>;
  canTriage?: boolean;
}) {
  const [finding, setFinding] = useState<{ id: string; version: number }>();
  const [correction, setCorrection] = useState("");
  const [selected, setSelected] = useState("/");
  const sources = new Map([...workflow?.sources ?? [], ...workflow?.research ?? []].map(source => [source.id, source]));
  const page = workflow?.pages.find(item => item.path === selected) ?? workflow?.pages[0];
  const working = isPresenceWorkflowWorking(workflow);
  const step = workflow && activeStep[workflow.pendingOperation ?? workflow.next];
  const siteReview = workflow?.next === "editorial-review" || workflow?.next === "operator-review";
  const pendingLinks = workflow?.pages.flatMap(({ path, heading, unresolvedLinks, actions }) => {
    const paths = (unresolvedLinks ?? []).map(link => `Suggested path ${link} has no verified destination.`);
    const inactive = actions.filter(action => action.destination === null).map(action => action.unresolvedDestination
      ? `${action.label} points back to this page (${action.unresolvedDestination}). Review where it should lead.`
      : `${action.label} needs a verified destination.`);
    return [...paths, ...inactive].map((requirement, index) => ({ key: path + ":" + index, heading, requirement }));
  }) ?? [];
  const submit = (operation: string, extra?: object) => run({ operation: "workflow-" + operation,
    ...(workflow && { version: workflow.version }), ...extra });
  return <section id="business-report-and-website" aria-label="Business report and website">
    <h2>Business report and website</h2>
    <p className={styles.hint}>{hosted ? "Protected development review. Operator decisions apply to this candidate. Customer approval and publication are separate." : "Local rehearsal. Research and model responses are recorded examples. Customer and Operator decisions are simulated."}</p>
    {!workflow ? <button type="button" disabled={busy} onClick={() => void submit("start")}>{hosted ? "Start protected workflow" : "Start the local workflow"}</button> : <>
      {hosted && !workflow.report && working && (
        <div role="status" className={styles.workflowStatus}>
          <h3>{workflow.next === "in-progress" ? "Core is working" : "Your assessment is queued"}</h3>
          <p>Core will use your saved business information and public research to prepare the Business Understanding Report. You can review the findings when the report is ready.</p>
        </div>
      )}
      {workflow.failure && <div className={styles.workflowStatus} role="alert">
        <h3>{workflow.report ? "Core paused" : "Your assessment is paused"}</h3>
        {workflow.artifactIssue && <p>{artifactIssueLabel[workflow.artifactIssue]}</p>}
        <p>{failureLabel[workflow.failure]} {workflow.recoverable ? "The saved response can be checked without another provider request." : "Your saved business information is still here."}</p>
      </div>}
      {workflow.recoverable && <button type="button" disabled={busy} onClick={() => void submit("recover")}>Recover retained result</button>}
      {workflow.next === "evidence-changed" && <p>Onboarding evidence changed. Core needs to reconcile the changes before continuing.</p>}
      {hosted && workflow.confirmation && working && <div role="status" className={styles.workflowStatus}>
        <h3>{workflow.next === "in-progress" ? step ?? "Core is preparing your website" : "Website planning queued"}</h3>
        {workflow.next !== "in-progress" && step && <p><strong>Next step</strong> {step}</p>}
        <p>Your report review is saved. Core is preparing Presence Direction and the website. You can leave and return. This page checks for saved progress while it’s open.</p>
      </div>}
      {hosted && siteReview && <div role="status" className={styles.workflowStatus}>
        <h3>{workflow.next === "editorial-review" ? "Website draft needs editorial review" : "Website proposal ready for review"}</h3>
        <p>Inspect the proposed pages, visitor actions, and editorial findings. Customer acceptance and publication follow separate reviews.</p>
        <a href="#proposed-website">Go to the proposed website</a>
      </div>}
      {!hosted && nextLabel[workflow.next] && <button type="button" disabled={busy} onClick={() => void submit("next")}>{nextLabel[workflow.next]}</button>}

      {workflow.report && <article aria-label="Business Understanding Report" className={styles.workflowReport}>
        <header className={styles.reportOverview}>
          <p className={styles.reportLabel}>{hosted ? "AI-generated assessment" : "Recorded example assessment"}</p>
          <h3>{workflow.report.title}</h3>
          <p>{workflow.report.summary}</p>
          {workflow.next === "customer-review" &&
            <p>Check the offer and who it serves, then review the interpretations and open decisions. Flag anything that would send the website in the wrong direction.</p>}
        </header>
        {findingGroups.map(({ status, label }) => {
          const findings = workflow.report!.findings.filter(item => item.status === status);
          if (!findings.length) return null;
          return <section key={status} className={styles.findingGroup}>
            <h4>{label}</h4>
            {findings.map(item => <section key={item.id} className={styles.findingCard}>
              <h5>{item.heading}</h5>
              <p>{item.body}</p>
              <SourceReferences sources={item.sourceIds.map(id => sources.get(id)).filter(source => source !== undefined)} />
              {!workflow.failure && workflow.next !== "in-progress" && workflow.next !== "evidence-changed" &&
                <button type="button" className={styles.secondary} disabled={busy}
                  onClick={() => { setFinding({ id: item.id, version: workflow.version }); setCorrection(""); }}>Flag a correction</button>}
              {finding?.version === workflow.version && finding.id === item.id && <div className={styles.field}>
                {workflow.confirmation && <p>Saving this correction pauses site planning. The report and its dependent drafts will need a fresh review.</p>}
                <label htmlFor="workflow-correction">Correction to {item.heading}</label>
                <textarea id="workflow-correction" value={correction} maxLength={8000} onChange={event => setCorrection(event.target.value)} />
                <button type="button" disabled={busy || !correction.trim()}
                  onClick={() => void submit("correct", { finding: finding.id, correction })}>{hosted ? "Save correction privately" : "Save correction for a new report"}</button>
                {hosted && <p className={styles.hint}>Core keeps this correction private. Sending it to the provider requires authorization.</p>}
              </div>}
            </section>)}
          </section>;
        })}
        {workflow.confirmation && !hosted && <p>This report revision has a simulated customer confirmation.</p>}
        {!workflow.confirmation && workflow.next === "customer-review" && <div className={styles.workflowStatus}>
            <h4>Ready for site planning?</h4>
            {hosted && <p>This records permission to draft the proposed website. Customer confirmation and publication remain separate.</p>}
            <button type="button" disabled={busy} onClick={() => void submit(hosted ? "continue" : "confirm")}>
              {hosted ? "Continue to development site planning" : "Confirm this report in the rehearsal"}</button>
          </div>}
      </article>}
      {workflow.corrections.length > 0 && <details><summary>Saved corrections</summary>
        {workflow.corrections.map(item => <p key={item.finding.id}><strong>{item.finding.heading}</strong> · {item.text}</p>)}
      </details>}

      {workflow.direction && <section aria-label="Presence Direction">
        <h3>Presence Direction</h3><p>{workflow.direction.positioning}</p><p>{workflow.direction.approach}</p>
        <ul>{workflow.direction.visitorDecisions.map(decision => <li key={decision}>{decision}</li>)}</ul>
      </section>}
      {workflow.blueprint && <section id="proposed-website" aria-label="Proposed website">
        <h3>Proposed website</h3>
        <p>{workflow.pages.length} of {workflow.blueprint.pages.length} proposed pages drafted.</p>
        <nav aria-label="Proposed site navigation">
          {workflow.blueprint.navigation.map(path => {
            const item = workflow.blueprint!.pages.find(candidate => candidate.path === path)!;
            return <button type="button" key={path} disabled={!workflow.pages.some(draft => draft.path === path)} aria-pressed={page?.path === path}
              onClick={() => setSelected(path)}>{item.label}</button>;
          })}
        </nav>
        {workflow.pages.some(draft => !workflow.blueprint!.navigation.includes(draft.path)) &&
          <nav aria-label="Additional drafted pages">
            {workflow.pages.filter(draft => !workflow.blueprint!.navigation.includes(draft.path)).map(draft =>
              <button type="button" key={draft.path} aria-pressed={page?.path === draft.path}
                onClick={() => setSelected(draft.path)}>{draft.heading}</button>)}
          </nav>}
        {page && <article>
          <h4>{page.heading}</h4>
          {page.sections.map((section, i) => <section key={i}><h5>{section.heading}</h5><p>{section.body}</p>
            <details><summary>Visual direction and references</summary><p>{section.visual.brief}</p>
              <p>{section.visual.purpose} · {section.visual.altIntent} · {section.visual.status}</p>
              <p>Evidence: {section.sourceIds.join(", ")}</p></details>
            {hosted && workflow.next === "review-complete" && section.visual.status === "asset-needed" && workflow.visuals &&
              <VisualReview key={page.path + "/" + i} path={page.path} index={i} altIntent={section.visual.altIntent}
                workflow={workflow} busy={busy} submit={submit} />}</section>)}
          <h5>Visitor actions</h5><ul>{page.actions.map((action, i) => <li key={i}>
            {action.kind === "navigate" && action.destination ?
              <button type="button" onClick={() => setSelected(action.destination!)} disabled={!workflow.pages.some(draft => draft.path === action.destination)}>{action.label}</button>
              : <span>{action.label} · {action.destination ?? "destination awaiting verification"}</span>}</li>)}</ul>
          <details><summary>Search metadata and internal links</summary><p>{page.searchTitle}</p><p>{page.searchDescription}</p><p>{page.internalLinks.join(", ")}</p>
            {page.unresolvedLinks && <p>Suggested paths awaiting verification: {page.unresolvedLinks.join(", ")}</p>}</details>
        </article>}
        {workflow.blueprint.articles.length > 0 && <details><summary>Planned Articles</summary>
          {workflow.blueprint.articles.map((article, i) => <p key={i}><strong>{article.title}</strong> · {article.question} · Relates to {article.target}</p>)}
        </details>}
      </section>}
      {workflow.editorial && <section id="editorial-review" aria-label="Editorial review">
        <h3>Editorial review</h3><p>{workflow.editorial.summary}</p>
        <ul>{workflow.editorial.concerns.map(({ path, concern }, i) => <li key={i}>{path} · {concern}</li>)}</ul>
        {pendingLinks.length > 0 && <section aria-label="Unresolved destinations">
          <h4>Unresolved destinations</h4>
          <p>These paths and actions are inactive until their destinations are verified.</p>
          <ul>{pendingLinks.map(({ key, heading, requirement }) => <li key={key}><strong>{heading}</strong> · {requirement}</li>)}</ul>
        </section>}
        {Boolean(workflow.editorialFindings?.length || workflow.editorial.unassigned?.length) &&
          <section aria-label="Editorial findings awaiting a page assignment">
            <h4>Editorial findings and decisions</h4>
            <p>Open findings stay in review. Page assignments can be queued separately.</p>
            <ul>{workflow.editorialFindings
              ? workflow.editorialFindings.map(item => <EditorialFindingPanel key={item.id} finding={item} workflow={workflow}
                canEdit={canTriage && !workflow.operatorReview && ["editorial-review", "operator-review"].includes(workflow.next)}
                busy={busy} save={editorial => submit("editorial-decision", { editorial })} />)
              : workflow.editorial.unassigned?.map(({ suggestedTarget, concern }) =>
                <li key={JSON.stringify([suggestedTarget, concern])}><strong>{suggestedTarget}</strong> · {concern}</li>)}</ul>
          </section>}
        {workflow.next === "editorial-review" && workflow.canQueueEditorialRevision && (!hosted || canTriage) &&
          <button type="button" disabled={busy} onClick={() => void submit("revise")}>Queue the flagged pages for revision</button>}
        {workflow.next === "operator-review" && (!hosted || canTriage) && <button type="button" disabled={busy} onClick={() => void submit("review")}>{hosted ? "Record Operator site review" : "Record simulated Operator review"}</button>}
        {workflow.operatorReview && !workflow.deliveryQuality && <p>Operator review saved. WordPress preparation requires separate authorization.</p>}
        {workflow.deliveryQuality && <section aria-label="Independent product review">
          <h4>Independent product review</h4>
          <p>{workflow.deliveryQuality.passed ? "Passed for this exact candidate. WordPress preparation still requires authorization."
            : workflow.deliveryQuality.target ? "A separate desktop and mobile quality review is required before delivery."
              : "Delivery is on hold while the candidate or its media is in review."}</p>
          {workflow.deliveryQuality.history.at(-1)?.review.findings.some(finding => finding.status === "revise") &&
            <p>The last independent review requested revisions. Its findings remain in editorial review.</p>}
        </section>}
      </section>}
      {workflow.report && <details className={styles.sourceArchive}><summary>Source history and open conflicts</summary>
        {(workflow.limitations.length > 0 || workflow.conflicts.length > 0) && <ul>
          {[...workflow.limitations, ...workflow.conflicts].map((item, index) => <li key={index}>{item}</li>)}
        </ul>}
        <SourceReferences sources={[...sources.values()]} includeRecords />
      </details>}
    </>}
    {snapshot && <section aria-label="Performance Snapshot">
      <h3>Performance Snapshot</h3>
      <p>Synthetic events for a prior example revision. These observations are separate from the proposed site above.</p>
      <ul>
        <li>Page observations {snapshot.counts["page-observed"] ?? "not measured"}</li>
        <li>Action selections {snapshot.counts["action-selected"] ?? "not measured"}</li>
        <li>Accepted Contacts {snapshot.counts["contact-accepted"] ?? "not measured"}</li>
        <li>Notification, qualified leads and customer outcomes are not measured.</li>
      </ul>
      {snapshot.recommendation && <details><summary>Suggested check and how to measure it</summary>
        <p>{snapshot.recommendation.observation} {snapshot.recommendation.next}</p>
        <p>{snapshot.recommendation.remeasure} {snapshot.recommendation.limitation}</p>
      </details>}
    </section>}
  </section>;
}

function VisualReview({ workflow, path, index, altIntent, busy, submit }: {
  workflow: PresenceWorkflowView; path: string; index: number; altIntent: string; busy: boolean;
  submit: (operation: string, options?: object) => Promise<void>;
}) {
  const visual = workflow.visuals?.filter(item => item.placement.path === path && item.placement.sectionIndex === index).at(-1);
  const [brief, setBrief] = useState("");
  const [reference, setReference] = useState("");
  const [alt, setAlt] = useState(altIntent);
  const [preview, setPreview] = useState<{ id: string; url: string }>();
  const [previewFailed, setPreviewFailed] = useState(false);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);
  const visibleImage = visual && (visual.state === "review" || visual.state === "approved");
  const previewImage = async () => {
    if (!visual) return;
    setPreviewFailed(false);
    try {
      const response = await fetch("/api/protected-core", { cache: "no-store", headers: {
        "X-Intake-Request": "1", "X-MioPages-Workflow-Image": visual.id,
      } });
      if (!response.ok || response.headers.get("content-type") !== "image/png") throw Error();
      setPreview({ id: visual.id, url: URL.createObjectURL(await response.blob()) });
    } catch { setPreviewFailed(true); }
  };
  const decide = (decision: "approved" | "rejected" | "revoked") => submit("visual-decide", {
    visual: { id: visual?.id, provenanceDigest: visual?.result?.provenanceDigest, decision, reference, alt },
  });
  return <fieldset>
    <legend>Provisional image</legend>
    {(!visual || visual.state === "revoked" || visual.state === "rejected") && Boolean(workflow.visualBriefs?.length) && <>
      <label>Authorized illustration brief <select value={brief} onChange={event => setBrief(event.target.value)}>
        <option value="">Choose a brief</option>
        {workflow.visualBriefs?.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select></label>
      <button type="button" disabled={busy || !brief} onClick={() => void submit("visual-queue", { visual: { path, index, briefId: brief } })}>Queue illustration</button>
    </>}
    {visual && <p>{({
      queued: "Queued for the protected worker", running: "Waiting for the image result", review: "Review needed",
      approved: "Approved for this non-public draft", revoked: "Private use withdrawn", rejected: "Image rejected",
      unverified: "Outcome unverified. The worker will keep the reservation for reconciliation.",
    })[visual.state]}</p>}
    {visibleImage && <>
      <button type="button" onClick={() => void previewImage()}>Show image</button>
      {previewFailed && <p role="alert">The private image could not be verified.</p>}
      {preview?.id === visual.id && visual.result &&
        // The private response is served via an authenticated fetch and temporary object URL.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview.url} alt={visual.decision?.alt ?? alt} width={visual.result.width} height={visual.result.height}
          style={{ maxWidth: "100%", height: "auto" }} />}
      <label>Decision reason or permission reference
        <input value={reference} maxLength={350} onChange={event => setReference(event.target.value)} /></label>
      {visual.state === "review" ? <>
        <label>Image alt text <input value={alt} maxLength={500} onChange={event => setAlt(event.target.value)} /></label>
        <button type="button" disabled={busy || preview?.id !== visual.id || !reference.trim() || !alt.trim()}
          onClick={() => void decide("approved")}>Approve for private draft</button>
        <button type="button" disabled={busy || !reference.trim()} onClick={() => void decide("rejected")}>Reject image</button>
      </> : <button type="button" disabled={busy || !reference.trim()} onClick={() => void decide("revoked")}>Withdraw private approval</button>}
    </>}
  </fieldset>;
}
