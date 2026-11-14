import { useState } from "react";
import styles from "../../components/intake/interview.module.css";
import type { reviewedSitePlanning, SitePlanningReview } from "../../lib/platform/intake/protected-site-planning";

type Review = ReturnType<typeof reviewedSitePlanning> & { current: boolean };
type Props = {
  state?: SitePlanningReview; review?: Review; enabled?: boolean; busy: boolean; version: number;
  inquiry?: { id: string; proposal: string; successCheck: string; uncertainty: string } | null;
  run: (operation: object) => void; delivery: (operation: object) => void;
};
export function SitePlanningReviewPanel({ state, review, enabled, busy, version, inquiry, run, delivery }: Props) {
  const [note, setNote] = useState("");
  const [improvePage, setImprovePage] = useState("");
  const [editing, setEditing] = useState(false);
  const proposal = state?.proposal;
  if (!review || !proposal) return <section aria-label="AI site proposal">
    <h2>AI site proposal</h2>
    {state?.pending ? <>
      <p>Generation is in progress. Reload to check for the saved proposal.</p>
      <button disabled={busy} type="button" onClick={() => run({ operation: "site-plan-recover", version })}>Clear generation after three minutes</button>
    </> : <>
      <p>{state?.failure === "output_token_limit" ? "The model reached the output limit before it finished. Core retained the usage record."
        : state?.failure ? "Core could not save a proposal. Your business evidence and the usage record are retained."
        : "Generate a proposed site structure, copy, search descriptions and visitor actions from scoped business evidence."}</p>
      {enabled ? <button disabled={busy} type="button" onClick={() => run({ operation: "site-plan-generate", version })}>Generate site proposal</button>
        : <p>Model dispatch awaits authorization for the exact evidence.</p>}
    </>}
  </section>;
  const { plan, actions, digest, decision } = review;
  const { generated, sources } = proposal;
  const sourceList = [...sources.sources, ...sources.answers];
  const citations = (ids: string[]) => ids.map(id => {
    const source = sourceList.find(item => item.id === id);
    return <li key={id}><strong>{source && "kind" in source ? source.kind.replaceAll("-", " ") : "unconfirmed answer"}</strong> {source?.statement ?? id}</li>;
  });
  return <section aria-label="AI site proposal">
    <h2>AI site proposal</h2>
    <p>{decision?.status === "approved" ? "Approved for delivery preparation" : decision?.status === "rejected" ? "Rejected in Operator review" : "Awaiting Operator review"}</p>
    {!review.current && <p role="status">Business evidence changed. This version remains available for inspection.</p>}
    <p>{plan.positioning}</p><p>{plan.offering}</p><p>Audience: {plan.audience}</p>
    <details><summary>Evidence behind the direction</summary><ul>{citations(generated.directionSourceIds)}</ul></details>
    {generated.unresolved.length > 0 && <><h3>Open questions</h3><ul>{generated.unresolved.map((item, i) => <li key={i}>{item}</li>)}</ul></>}
    {plan.pages.map((page, i) => <details key={page.path}>
      <summary>{page.title} · {page.path}</summary>
      <p>{page.purpose}</p><p>Search description: {page.seoDescription}</p>
      <p>Visitor action: {actions[i].label} · {actions[i].destination ?? "Contact destination needs review"}</p>
      <ul>{citations(generated.evidence[i].sourceIds)}</ul>
      {page.sections.map((section, j) => <article key={j}>
        <h4>{section.heading}</h4><p>{section.body}</p>
        {j < generated.evidence[i].sectionSourceIds.length
          ? <details><summary>Section evidence</summary><ul>{citations(generated.evidence[i].sectionSourceIds[j])}</ul></details>
          : <p>Added from the synthetic inquiry linked below.</p>}
      </article>)}
    </details>)}
    {proposal.improvement && <p>Synthetic inquiry {proposal.improvement.inquiryId} informed {proposal.improvement.pagePath}. Source draft {proposal.improvement.draftDigest}.</p>}
    {review.current && <>
      <button type="button" disabled={busy} onClick={() => setEditing(!editing)}>{editing ? "Close editor" : "Edit proposal"}</button>
      {editing && <form key={digest} onSubmit={event => {
        event.preventDefault();
        const fields = new FormData(event.currentTarget);
        const field = (name: string) => String(fields.get(name));
        const pages = generated.plan.pages.map((item, i) => ({ ...item,
          title: field(`title-${i}`), purpose: field(`purpose-${i}`), seoDescription: field(`seo-${i}`), action: field(`action-${i}`),
          sections: item.sections.map((_section, j) => ({ heading: field(`heading-${i}-${j}`), body: field(`body-${i}-${j}`) })),
        }));
        run({ operation: "site-plan-edit", version, digest, plan: { positioning: field("positioning"), offering: field("offering"), audience: field("audience"), pages },
          destinations: Object.fromEntries(pages.map((item, i) => [item.path, field(`destination-${i}`) || null])) });
      }}>
        <div className={styles.field}>
          <label>Positioning<textarea name="positioning" defaultValue={plan.positioning} required maxLength={500} /></label>
          <label>Offering<textarea name="offering" defaultValue={plan.offering} required maxLength={500} /></label>
          <label>Audience<textarea name="audience" defaultValue={plan.audience} required maxLength={350} /></label>
        </div>
        {plan.pages.map((item, i) => <details key={item.path}>
          <summary>Edit {item.title}</summary>
          <div className={styles.field}>
            <label>Page title<input name={`title-${i}`} defaultValue={item.title} required maxLength={100} /></label>
            <label>Page purpose<textarea name={`purpose-${i}`} defaultValue={item.purpose} required maxLength={300} /></label>
            <label>Search description<input name={`seo-${i}`} defaultValue={item.seoDescription} required maxLength={160} /></label>
            <label>Visitor action<input name={`action-${i}`} defaultValue={item.action} required maxLength={100} /></label>
            <label>Visitor destination<select name={`destination-${i}`} defaultValue={actions[i].destination ?? ""}>
              {actions[i].kind === "request-contact" && <option value="">Needs a contact destination</option>}
              {plan.pages.filter(target => target.path !== item.path).map(target => <option key={target.path} value={target.path}>{target.title}</option>)}
            </select></label>
            {item.sections.slice(0, generated.plan.pages[i].sections.length).map((section, j) => <div key={j}>
              <label>Heading<input name={`heading-${i}-${j}`} defaultValue={section.heading} required maxLength={160} /></label>
              <label>Content<textarea name={`body-${i}-${j}`} defaultValue={section.body} required maxLength={1000} /></label>
            </div>)}
          </div>
        </details>)}
        <button disabled={busy}>Save edits for review</button>
      </form>}
      <h3>Record a review decision</h3>
      <p>Decision applies to the saved version and allows preparation for separate Page approvals.</p>
      <label>Decision note<input value={note} onChange={event => setNote(event.target.value)} maxLength={280} /></label>
      <button type="button" disabled={busy || !note.trim()} onClick={() => run({ operation: "site-plan-decide", version, digest, status: "approved", note })}>Approve for preparation</button>
      <button type="button" disabled={busy || !note.trim()} onClick={() => run({ operation: "site-plan-decide", version, digest, status: "rejected", note })}>Reject proposal</button>
      {decision?.status === "approved" && (actions.some(action => action.destination === null)
        ? <p>Resolve the remaining contact destination before preparing WordPress Pages.</p>
        : <button disabled={busy} type="button" onClick={() => delivery({ operation: "site-plan-delivery", version })}>Prepare WordPress review input</button>)}
      {inquiry && <div>
        <h3>Improve from inquiry evidence</h3><p>{inquiry.proposal}</p><p>{inquiry.successCheck}</p><p>{inquiry.uncertainty}</p>
        <label>Page to improve<select value={improvePage} onChange={event => setImprovePage(event.target.value)}>
          <option value="">Choose a Page</option>{plan.pages.map(item => <option key={item.path} value={item.path}>{item.title}</option>)}
        </select></label>
        <button type="button" disabled={busy || !improvePage} onClick={() => run({ operation: "site-plan-improve", version, digest,
          inquiryId: inquiry.id, pagePath: improvePage })}>Add recommendation for review</button>
      </div>}
    </>}
    {proposal.decisions?.length ? <details><summary>Decision history</summary><ul>
      {proposal.decisions.map((item, i) => <li key={i}>{item.status} · {item.at} · {item.note}</li>)}</ul></details> : null}
  </section>;
}
