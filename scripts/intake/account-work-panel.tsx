import { useRef, useState } from "react";
import type { AccountWorkView } from "../../lib/platform/intake/account-work";
import type { PerformanceSnapshot } from "../../lib/platform/measurement/first-party";
import styles from "../../components/intake/interview.module.css";

const sourceLabels = {
  "owner-confirmed": "Owner-confirmed knowledge", "earlier-review-answer": "Prior Review answer",
  "earlier-review-assessment": "Prior Review assessment", "website-observation": "Website observation",
  "customer-unconfirmed": "Unconfirmed answer", "historical-discovery": "Historical discovery",
  "service-direction": "Recorded service direction", "public-research": "Public research",
};

export function AccountWorkPanel({ account, activity, activityUnavailable, observe, busy, canCorrect, run }: {
  account: AccountWorkView; busy: boolean; canCorrect: boolean; run: (input: object) => Promise<void>;
  activity?: PerformanceSnapshot; activityUnavailable?: boolean; observe?: () => void;
}) {
  const [sourceId, setSourceId] = useState("");
  const [correction, setCorrection] = useState("");
  const requestId = useRef<string | null>(null);
  const reassessmentId = useRef<string | null>(null);
  const source = account.sources.find(item => item.id === sourceId);
  const pending = account.corrections.filter(item => !item.withdrawn && !item.confirmation);
  function changed() { requestId.current = null; }
  return <section id="account-work" aria-labelledby="account-work-heading">
    <h2 id="account-work-heading">Your understanding and current work</h2>
    <p>Business sources, proposed changes and the work they inform stay together here.</p>
    {account.mode === "fixture" && <p className={styles.hint}>Development example: report and website reasoning use recorded responses.</p>}
    {!account.evidenceCurrent && <p role="status">Sources have changed. The retained work needs reconciliation.</p>}
    <p><strong>Next action:</strong> {account.nextAction}</p>
    {account.work.stage === "reassessment-ready" && <button disabled={busy} onClick={() => {
      reassessmentId.current ??= crypto.randomUUID();
      void run({ operation: "workflow-understanding-reassess", version: account.version, correction: { id: reassessmentId.current } });
    }}>Queue reassessment</button>}
    {(account.work.reportAvailable || account.work.directionAvailable || account.work.proposedPages > 0) && <p>
      {account.work.reportAvailable ? "Business report retained. " : ""}
      {account.work.directionAvailable ? "Presence Direction retained. " : ""}
      {account.work.proposedPages > 0 ? `${account.work.draftedPages} of ${account.work.proposedPages} proposed pages drafted. ` : ""}
      <a href="#business-report-and-website" onClick={observe}>Open the current work</a>
    </p>}
    <p className={styles.hint}>WordPress application state is not connected to this account view yet. A retained proposal or review does not establish delivery.</p>

    <h3>Knowledge corrections</h3>
    <p>Propose a correction to an existing source without erasing its original or the current website work.
      Your note remains unconfirmed until the appropriate knowledge review. Saving it makes no AI request.</p>
    {!pending.length && <p>No proposed knowledge corrections are awaiting review.</p>}
    {account.corrections.map(item => <article key={item.id} aria-label="Knowledge correction">
      <h4>{account.sources.find(entry => entry.id === item.sourceId)?.label ?? "Retained source"}</h4>
      <p>{item.text}</p>
      <p className={styles.hint}>{item.confirmation ? "Exact business fact confirmed — retained in history" : item.withdrawn ? "Withdrawn; retained in history" : "Proposed, unconfirmed — reassessment needed"} · {item.at.slice(0, 10)}
        {item.actor.simulated ? " · simulated development role" : ""}</p>
      {item.confirmation && <p>Confirmed wording: {item.confirmation.value}. Knowledge revision {item.confirmation.version}.
        {item.confirmation.publicUse ? " Eligible for website proposals; no publication is authorized." : " Internal understanding only."}</p>}
      {!item.withdrawn && !item.confirmation && <>
        {item.impact.findings.length > 0 && <p>Report findings citing this source: {item.impact.findings.join("; ")}.</p>}
        {item.impact.direction && <p>Presence Direction cites this source.</p>}
        {item.impact.pages.length > 0 && <p>Page plans or sections citing this source: {item.impact.pages.join(", ")}.</p>}
        <p className={styles.hint}>These are citation links, not an AI reassessment. Wider consequences still need review. Existing work is retained; further generation and delivery preparation are paused.</p>
        {account.canConfirmKnowledge && <KnowledgeConfirmationForm key={item.id} account={account} correctionId={item.id} busy={busy} run={run} />}
        {canCorrect && <form onSubmit={event => {
          event.preventDefault();
          const fields = new FormData(event.currentTarget);
          void run({ operation: "workflow-understanding-withdraw", version: account.version,
            correction: { id: item.id, reason: fields.get("reason") } });
        }}>
          <label className={styles.field}>Reason for withdrawing your correction<input name="reason" required disabled={busy} /></label>
          <button className={styles.secondary} disabled={busy}>Withdraw my correction</button>
        </form>}
      </>}
      {item.withdrawn && <p>Withdrawal reason: {item.withdrawn.reason}</p>}
    </article>)}
    {canCorrect && <form onSubmit={event => {
      event.preventDefault();
      if (!source) return;
      requestId.current ??= crypto.randomUUID();
      void run({ operation: "workflow-understanding-correct", version: account.version,
        correction: { id: requestId.current, sourceId: source.id, sourceDigest: source.digest, text: correction } });
    }}>
      <label className={styles.field}>Which retained information needs a correction?
        <select value={sourceId} disabled={busy || !account.evidenceCurrent} onChange={event => { changed(); setSourceId(event.target.value); }} required>
          <option value="">Choose an existing source</option>
          {account.sources.map(item => <option key={item.id} value={item.id}>{item.label} · {sourceLabels[item.kind]}</option>)}
        </select>
      </label>
      {source && <details><summary>Read the retained source before proposing a change</summary>
        <p className={styles.hint}>{sourceLabels[source.kind]} · {source.reference}</p>
        <p className={styles.sourceRecord}>{source.content}</p>
      </details>}
      <label className={styles.field}>What should change, and why?
        <textarea rows={4} value={correction} disabled={busy} required onChange={event => { changed(); setCorrection(event.target.value); }} />
      </label>
      <button disabled={busy || !source || !correction.trim() || !account.evidenceCurrent}>Save proposed correction</button>
    </form>}
    {account.comparison && <details><summary>Before and after the knowledge change</summary>
      <h3>Business assessment</h3><p><strong>Before:</strong> {account.comparison.beforeSummary ?? "Not available"}</p>
      <p><strong>After:</strong> {account.comparison.afterSummary ?? "Awaiting reassessment"}</p>
      {account.comparison.findings.map(finding => <article key={finding.id}><h4>{finding.heading}</h4>
        <p><strong>Before:</strong> {finding.before ?? "New finding"}</p><p><strong>After:</strong> {finding.after ?? "Not retained in the new report"}</p></article>)}
      <h3>Positioning</h3><p><strong>Before:</strong> {account.comparison.beforePositioning ?? "Not available"}</p>
      <p><strong>After:</strong> {account.comparison.afterPositioning ?? "Awaiting reassessment"}</p>
      <h3>Recommended approach</h3><p><strong>Before:</strong> {account.comparison.beforeApproach ?? "Not available"}</p>
      <p><strong>After:</strong> {account.comparison.afterApproach ?? "Awaiting reassessment"}</p>
      {account.comparison.pages.map(page => <article key={page.path}>
        <h4>{page.path} · {page.change}</h4><p>{page.reason}</p>
        <p>Previous heading: {page.beforeHeading ?? "New page"}. Proposed heading: {page.afterHeading ?? "Awaiting draft"}.</p>
        <p>{page.contentChanged === null ? "Draft not yet available" : page.contentChanged ? "Page content changed" : "Existing Page retained exactly"}.</p>
      </article>)}
    </details>}
    <section aria-label="Account review activity">
      <h3>Review activity and measurement coverage</h3>
      {activity ? <>
        <p>Actual internal development review activity for this retained work, separate from visitor activity.</p>
        <p>Account views: {activity.counts["page-observed"] ?? "not measured"}. Open-current-work selections: {activity.counts["action-selected"] ?? "not measured"}.</p>
        <p className={styles.hint}>Coverage began {activity.activatedAt}. Website visits, accepted inquiries, notifications, qualified leads and customer outcomes are not measured by this collector. No commercial improvement is inferred.</p>
      </> : <p>The account activity collector is not enabled in this environment. No visitor or outcome counts are claimed.</p>}
      {activityUnavailable && <p role="status">Core could not record this review activity. The saved account work is still available.</p>}
    </section>
  </section>;
}

function KnowledgeConfirmationForm({ account, correctionId, busy, run }: {
  account: AccountWorkView; correctionId: string; busy: boolean; run: (input: object) => Promise<void>;
}) {
  const [selected, setSelected] = useState("");
  const [value, setValue] = useState("");
  const [reference, setReference] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const requestId = useRef<string | null>(null);
  const targets = account.knowledgeTargets.flatMap(record => record.facts.map(fact => ({ record, fact })));
  const target = targets.find(item => item.record.id + ":" + item.fact.key === selected);
  function changed() { requestId.current = null; setConfirmed(false); }
  return <details><summary>Review and confirm the exact business fact</summary>
    <p>Select the existing fact this note changes. Other facts and their evidence stay intact.</p>
    <form onSubmit={event => {
      event.preventDefault(); if (!target || !confirmed) return;
      requestId.current ??= crypto.randomUUID();
      void run({ operation: "workflow-understanding-confirm", version: account.version, correction: {
        correctionId, requestId: requestId.current, target: { id: target.record.id, key: target.fact.key,
          version: target.record.version, fingerprint: target.record.fingerprint }, value, confirmed: true, publicUse: target.fact.publicUse, reference,
      } });
    }}>
      <label className={styles.field}>Existing business fact<select required value={selected} disabled={busy} onChange={event => {
        changed(); setSelected(event.target.value); setValue(targets.find(item => item.record.id + ":" + item.fact.key === event.target.value)?.fact.value ?? "");
      }}><option value="">Choose the exact fact</option>{targets.map(item => <option key={item.record.id + item.fact.key} value={item.record.id + ":" + item.fact.key}>
        {item.fact.kind.replaceAll("-", " ")} · {item.fact.value.length > 100 ? item.fact.value.slice(0, 100) + "…" : item.fact.value}
      </option>)}</select></label>
      {target && <p>Current confirmed wording: {target.fact.value}</p>}
      <label className={styles.field}>Exact corrected wording<textarea value={value} required maxLength={2000} disabled={busy} onChange={event => { changed(); setValue(event.target.value); }} /></label>
      <label className={styles.field}>Confirmation reference or reason<input value={reference} required disabled={busy} onChange={event => { changed(); setReference(event.target.value); }} /></label>
      <label><input type="checkbox" checked={confirmed} disabled={busy || !target} onChange={event => setConfirmed(event.target.checked)} />
        {target?.fact.publicUse ? "I confirm this exact business fact and its eligibility for website proposals. This does not approve publication." : "I confirm this exact business fact for internal understanding only."}</label>
      <button disabled={busy || !target || !confirmed || !value.trim() || !reference.trim()}>Confirm exact fact</button>
    </form>
  </details>;
}
