import { useRef, useState } from "react";
import type { InquiryOutcomeView } from "../../lib/platform/contact/outcomes";
import styles from "../../components/intake/interview.module.css";

export function AccountInquiriesPanel({ view, busy, run }: {
  view: InquiryOutcomeView; busy: boolean; run: (input: object) => Promise<void>;
}) {
  return <section id="account-inquiries" aria-labelledby="account-inquiries-heading">
    <h2 id="account-inquiries-heading">Inquiries and known outcomes</h2>
    <p>{view.environment === "development" ? "Development inquiry evidence; these records do not establish genuine customer demand." : "Accepted inquiries and explicitly reported outcomes."}</p>
    <p className={styles.hint}>Acceptance, notification delivery and a business result are separate. Site-revision attribution is not connected here yet.</p>
    {!view.inquiries.length && <p>No unexpired accepted inquiries are available for this account.</p>}
    {view.inquiries.map(item => <article key={item.id}>
      <h3>Inquiry received {item.acceptedAt.slice(0, 10)}</h3>
      <p>Notification: {item.delivery}. Qualification: {item.qualification}. Reported outcome: {item.outcome}.</p>
      <OutcomeForm item={item} busy={busy} run={run} />
      {item.history.length > 0 && <details><summary>Reported outcome history</summary><ul>{item.history.map(entry => <li key={entry.version}>
        Revision {entry.version} · {entry.payload.qualification} · {entry.payload.outcome} · confirmed {entry.payload.confirmedAt.slice(0, 10)} · {entry.payload.reference}
      </li>)}</ul></details>}
    </article>)}
  </section>;
}

function OutcomeForm({ item, busy, run }: { item: InquiryOutcomeView["inquiries"][number]; busy: boolean; run: (input: object) => Promise<void> }) {
  const [qualification, setQualification] = useState(String(item.qualification));
  const [outcome, setOutcome] = useState(String(item.outcome));
  const [reference, setReference] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const request = useRef<{ id: string; at: string } | null>(null);
  function changed() { request.current = null; setConfirmed(false); }
  return <form onSubmit={event => {
    event.preventDefault(); if (!confirmed) return;
    request.current ??= { id: crypto.randomUUID(), at: new Date().toISOString() };
    void run({ operation: "record-inquiry-outcome", outcome: { submissionId: item.id, requestId: request.current.id,
      expectedVersion: item.version, qualification, outcome, reference, confirmedAt: request.current.at, confirmed: true } });
  }}>
    <label className={styles.field}>What is known about fit?<select value={qualification} disabled={busy} onChange={event => { changed(); setQualification(event.target.value); }}>
      <option value="unknown">Unknown</option><option value="qualified">Suitable inquiry</option><option value="not-qualified">Not a fit</option>
    </select></label>
    <label className={styles.field}>What result is known?<select value={outcome} disabled={busy} onChange={event => { changed(); setOutcome(event.target.value); }}>
      <option value="unknown">Unknown</option><option value="conversation">Conversation happened</option>
      <option value="became-customer">Became a customer</option><option value="closed">Closed without a customer</option>
    </select></label>
    <label className={styles.field}>Confirmation reference or reason<input value={reference} disabled={busy} required onChange={event => { changed(); setReference(event.target.value); }} /></label>
    <label><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} /> I confirm this reported information; unknown items remain unknown.</label>
    <button disabled={busy || !confirmed || !reference.trim()}>Save reported outcome</button>
  </form>;
}
