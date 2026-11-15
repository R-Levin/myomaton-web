import { useState } from "react";
import type { PresenceWorkflowView } from "../../lib/platform/intake/presence-workflow";
import type { PerformanceSnapshot } from "../../lib/platform/measurement/first-party";
import styles from "../../components/intake/interview.module.css";

const nextLabel: Record<string, string> = {
  research: "Gather research", report: "Prepare the business report", direction: "Prepare Presence Direction",
  blueprint: "Plan the website", page: "Draft the next page", editorial: "Check the whole site",
};
const failureLabel: Record<string, string> = {
  "operation-blocked": "Core stopped before it could complete this operation.",
  "output-invalid": "Core retained the response but could not validate it for review.",
  "outcome-unknown": "Core could not verify whether this step finished. Recovery does not send the step again.",
};

export function PresenceWorkflowPanel({ workflow, snapshot, busy, run }: {
  workflow: PresenceWorkflowView | null; snapshot?: PerformanceSnapshot; busy: boolean; run: (input: object) => Promise<void>;
}) {
  const [finding, setFinding] = useState<{ id: string; version: number }>();
  const [correction, setCorrection] = useState("");
  const [selected, setSelected] = useState("/");
  const page = workflow?.pages.find(item => item.path === selected) ?? workflow?.pages[0];
  const submit = (operation: string, extra?: object) => run({ operation: "workflow-" + operation,
    ...(workflow && { version: workflow.version }), ...extra });
  return <section aria-label="Business report and website">
    <h2>Business report and website</h2>
    <p className={styles.hint}>Local rehearsal. Research and model responses are recorded examples. Customer and Operator decisions are simulated.</p>
    {!workflow ? <button type="button" disabled={busy} onClick={() => void submit("start")}>Start the local workflow</button> : <>
      <p>Saved workflow revision {workflow.version} · {workflow.entry === "FREE_REVIEW" ? "Started with a Free Review" : "Started directly"}</p>
      {workflow.failure && <p role="alert">{failureLabel[workflow.failure]}</p>}
      {workflow.recoverable && <button type="button" disabled={busy} onClick={() => void submit("recover")}>Recover retained result</button>}
      {workflow.next === "evidence-changed" && <p>Onboarding evidence changed. This saved version needs reconciliation before work can continue.</p>}
      {workflow.next === "in-progress" && <p>Core is waiting for this operation. Reload to check its status.</p>}
      {nextLabel[workflow.next] && <button type="button" disabled={busy} onClick={() => void submit("next")}>{nextLabel[workflow.next]}</button>}

      {workflow.report && <article aria-label="Business Understanding Report">
        <h3>{workflow.report.title}</h3>
        <p>{workflow.report.summary}</p>
        {workflow.report.findings.map(item => <section key={item.id}>
          <h4>{item.heading}</h4>
          <p><strong>{item.status === "established" ? "Supported finding" : item.status === "unresolved" ? "Open question" : "Proposed interpretation"}</strong> · {item.body}</p>
          <details><summary>Evidence</summary>{item.sourceIds.map(id => {
            const source = [...workflow.sources, ...workflow.research ?? []].find(source => source.id === id);
            return source && <p key={id}>{source.label} · {source.kind} · {source.reference}</p>;
          })}</details>
          {!workflow.failure && workflow.next !== "in-progress" && workflow.next !== "evidence-changed" &&
            <button type="button" disabled={busy} onClick={() => { setFinding({ id: item.id, version: workflow.version }); setCorrection(""); }}>Correct {item.heading.toLowerCase()}</button>}
        </section>)}
        {workflow.confirmation ? <p>This report revision has a simulated customer confirmation.</p> :
          workflow.next === "customer-review" && <button type="button" disabled={busy} onClick={() => void submit("confirm")}>Confirm this report in the rehearsal</button>}
        {finding?.version === workflow.version && workflow.report.findings.some(item => item.id === finding.id) && <div className={styles.field}>
          <label htmlFor="workflow-correction">Correction to this finding</label>
          <textarea id="workflow-correction" value={correction} maxLength={8000} onChange={event => setCorrection(event.target.value)} />
          <button type="button" disabled={busy || !correction.trim()} onClick={() => void submit("correct", { finding: finding.id, correction })}>Save correction for a new report</button>
        </div>}
      </article>}
      {workflow.corrections.length > 0 && <details><summary>Saved corrections</summary>
        {workflow.corrections.map(item => <p key={item.finding.id}><strong>{item.finding.heading}</strong> · {item.text}</p>)}
      </details>}

      {workflow.direction && <section aria-label="Presence Direction">
        <h3>Presence Direction</h3><p>{workflow.direction.positioning}</p><p>{workflow.direction.approach}</p>
        <ul>{workflow.direction.visitorDecisions.map(decision => <li key={decision}>{decision}</li>)}</ul>
      </section>}
      {workflow.blueprint && <section aria-label="Proposed website">
        <h3>Proposed website</h3>
        <p>{workflow.pages.length} of {workflow.blueprint.pages.length} proposed pages drafted.</p>
        <nav aria-label="Proposed site navigation">
          {workflow.blueprint.navigation.map(path => {
            const item = workflow.blueprint!.pages.find(candidate => candidate.path === path)!;
            return <button type="button" key={path} disabled={!workflow.pages.some(draft => draft.path === path)} aria-pressed={page?.path === path}
              onClick={() => setSelected(path)}>{item.label}</button>;
          })}
        </nav>
        {page && <article>
          <h4>{page.heading}</h4>
          {page.sections.map((section, i) => <section key={i}><h5>{section.heading}</h5><p>{section.body}</p>
            <details><summary>Visual direction and references</summary><p>{section.visual.brief}</p>
              <p>{section.visual.purpose} · {section.visual.altIntent} · {section.visual.status}</p>
              <p>Evidence: {section.sourceIds.join(", ")}</p></details></section>)}
          <h5>Visitor actions</h5><ul>{page.actions.map((action, i) => <li key={i}>
            {action.kind === "navigate" && action.destination ?
              <button type="button" onClick={() => setSelected(action.destination!)} disabled={!workflow.pages.some(draft => draft.path === action.destination)}>{action.label}</button>
              : <span>{action.label} · {action.destination ?? "destination awaiting verification"}</span>}</li>)}</ul>
          <details><summary>Search metadata and internal links</summary><p>{page.searchTitle}</p><p>{page.searchDescription}</p><p>{page.internalLinks.join(", ")}</p></details>
        </article>}
        {workflow.blueprint.articles.length > 0 && <details><summary>Planned Articles</summary>
          {workflow.blueprint.articles.map((article, i) => <p key={i}><strong>{article.title}</strong> · {article.question} · Relates to {article.target}</p>)}
        </details>}
      </section>}
      {workflow.editorial && <section aria-label="Editorial review">
        <h3>Editorial review</h3><p>{workflow.editorial.summary}</p>
        <ul>{workflow.editorial.concerns.map(({ path, concern }, i) => <li key={i}>{path} · {concern}</li>)}</ul>
        {workflow.next === "operator-review" && <button type="button" disabled={busy} onClick={() => void submit("review")}>Record simulated Operator review</button>}
        {workflow.operatorReview && <p>Operator review saved. WordPress preparation requires separate authorization.</p>}
      </section>}
      <details><summary>Source history and open conflicts</summary>
        {workflow.limitations.map(item => <p key={item}>{item}</p>)}{workflow.conflicts.map(item => <p key={item}>{item}</p>)}
        {[...workflow.sources, ...workflow.research ?? []].map(source => <details key={source.id}>
          <summary>{source.label} · {source.date ?? "date unavailable"}</summary>
          <p>{source.reference}</p><p>{source.content}</p>
        </details>)}
      </details>
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
