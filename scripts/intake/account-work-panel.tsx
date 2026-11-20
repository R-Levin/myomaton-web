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
  const source = account.sources.find(item => item.id === sourceId);
  const pending = account.corrections.filter(item => !item.withdrawn);
  function changed() { requestId.current = null; }
  return <section id="account-work" aria-labelledby="account-work-heading">
    <h2 id="account-work-heading">Your understanding and current work</h2>
    <p>Business sources, proposed changes and the work they inform stay together here.</p>
    {account.mode === "fixture" && <p className={styles.hint}>Development example: report and website reasoning use recorded responses.</p>}
    {!account.evidenceCurrent && <p role="status">Sources have changed. The retained work needs reconciliation.</p>}
    <p><strong>Next action:</strong> {account.nextAction}</p>
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
      <p className={styles.hint}>{item.withdrawn ? "Withdrawn; retained in history" : "Proposed, unconfirmed — reassessment needed"} · {item.at.slice(0, 10)}
        {item.actor.simulated ? " · simulated development role" : ""}</p>
      {!item.withdrawn && <>
        {item.impact.findings.length > 0 && <p>Report findings citing this source: {item.impact.findings.join("; ")}.</p>}
        {item.impact.direction && <p>Presence Direction cites this source.</p>}
        {item.impact.pages.length > 0 && <p>Page plans or sections citing this source: {item.impact.pages.join(", ")}.</p>}
        <p className={styles.hint}>These are citation links, not an AI reassessment. Wider consequences still need review. Existing work is retained; further generation and delivery preparation are paused.</p>
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
