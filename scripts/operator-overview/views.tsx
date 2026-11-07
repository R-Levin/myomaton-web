import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FocusPage } from "../../components/managed-sites/focus-page";
import { accountPath, previewPath, type SnapshotAccount } from "./model";
import { evidencePath, exactPreviewPath, type ProposalEvidence } from "./proposal-evidence";

/* eslint-disable @next/next/no-head-element, @next/next/no-css-tags, @next/next/no-html-link-for-pages -- Standalone HTML and navigation served by Node outside Next. */
function layout(title: string, children: ReactNode, preview = false) {
  return "<!doctype html>" + renderToStaticMarkup(<html lang="en"><head><meta charSet="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" /><title>{`${title} · MioPages Operator`}</title>
    <link rel="stylesheet" href="/operator.css" />{preview && <link rel="stylesheet" href="/presentation.css" />}
  </head><body><header className="op-bar"><div className="op-wrap"><a href="/" aria-label="MioPages Operator overview"><span className="op-mark" aria-hidden="true">M</span>MioPages <span className="op-bar-label">Operator</span></a>
    <details className="op-identity"><summary><span><span className="op-tag">Simulated</span> MioPages owner</span><span>Active role: Content Reviewer</span></summary>
      <div><p>Demo identity with two example roles.</p><ul><li>Content Reviewer · active in this example</li><li>Technical Operator</li></ul><p>Local read-only review. Sign-in and permissions are unavailable.</p></div>
    </details></div></header>
    {children}</body></html>);
}

export function overview(accounts: readonly SnapshotAccount[]) {
  const attention = accounts.filter(account => account.nextReview);
  return layout("Overview", <main className="op-wrap op-main">
    <div className="op-kicker">Workspace / Overview</div><h1>Operator overview</h1>
    <p className="op-lead">Start with the accounts that need a decision.</p>
    <section aria-labelledby="attention"><h2 id="attention">Needs attention <span className="op-count">{attention.length}</span></h2>
      {attention.length ? <ul className="op-list">{attention.map(account => <li className="op-card op-alert" key={account.id}>
        <div><span className="op-tag op-warn">Operator review · recorded evidence</span><h3>Review project evidence for {account.name}</h3>
          <p>The featured Experience slot has unresolved permission. Review the page and identify material that can accurately show the contribution.</p></div>
        <a className="op-button" href={accountPath(account.id)}>Open account review <span aria-hidden="true">→</span></a>
      </li>)}</ul> : <p className="op-card">No Operator review is flagged in the loaded snapshot.</p>}
    </section>
    <section aria-labelledby="accounts"><h2 id="accounts">Accounts <span className="op-count">{accounts.length}</span></h2>
      <ul className="op-list op-directory">{accounts.map(account => <li key={account.id}><a href={accountPath(account.id)}>
        <div><strong>{account.name}</strong><span>{account.domain} · {account.pages.length} pages</span></div>
        <span className="op-tag">{account.nextReview ? "Review open" : "No review flagged"}</span>
      </a></li>)}</ul>
      <p className="op-note">Source: reviewed development snapshot. Customer activity, monitoring, and live workflow queues are outside this view.</p>
    </section>
  </main>);
}

export function accountView(account: SnapshotAccount, evidence?: ProposalEvidence | null) {
  return layout(account.name, <main className="op-wrap op-main">
    <nav className="op-kicker" aria-label="Breadcrumb"><a href="/">Overview</a> / Account</nav>
    <h1>{account.name}</h1><p className="op-lead">{account.domain} · {account.site} Managed Site</p>
    <dl className="op-facts"><div><dt>Organization</dt><dd>{account.organization}</dd></div><div><dt>Web Presence record</dt><dd>{account.presenceStatus}</dd></div><div><dt>Evidence source</dt><dd>Reviewed C0 v3 snapshot</dd></div></dl>
    {account.nextReview && <section aria-labelledby="next"><h2 id="next">Next action</h2><div className="op-card op-alert">
      <div><span className="op-tag op-warn">Operator review</span><h3>Review the Experience page</h3><p>{account.nextReview.purpose}. Check what can be shown with verified contribution and permission before proposing an update.</p></div>
      <a className="op-button" href={previewPath(account.id, account.nextReview.pageId)}>Preview Experience <span aria-hidden="true">→</span></a>
    </div></section>}
    <section id="decisions" aria-labelledby="decisions-heading"><h2 id="decisions-heading">Decisions &amp; evidence</h2>
      <dl className="op-decisions"><div><dt>Content proposals</dt><dd><span className="op-tag">Status unknown</span> Proposal records are outside this snapshot. Pending approval status is unknown.</dd></div>
        <div><dt>Media review</dt><dd>{account.visualNeeds.length} visual slots with unresolved permission in this snapshot. {account.activeAssets.length} active assets are recorded. The owner declined both C0 stock candidates and closed that search.</dd></div>
        <div><dt>Publishing</dt><dd>{account.publicationAuthorized ? "The snapshot records publication authorization." : "This snapshot carries no publication authorization."} Release history and delivery status are outside this view.</dd></div></dl>
      <details><summary>Inspect recorded visual needs</summary><ul className="op-needs">{account.visualNeeds.map((need, index) => <li key={`${need.pageId}-${index}`}><a href={previewPath(account.id, need.pageId)}>{need.pageName}</a> · {need.purpose}</li>)}</ul></details>
    </section>
    {evidence && <section aria-labelledby="example"><h2 id="example">Proposal review walkthrough</h2><div className="op-card">
      <p><span className="op-tag">Synthetic example</span> Inspect recorded revisions and exact preview evidence from a separate disposable account.</p>
      <p className="op-follow"><a href={evidencePath(evidence)}>Open synthetic proposal evidence <span aria-hidden="true">→</span></a></p>
    </div></section>}
    <section aria-labelledby="pages"><h2 id="pages">Page previews <span className="op-count">{account.pages.length}</span></h2>
      <ul className="op-list op-directory">{account.pages.map(page => <li key={String(page.id)}><a href={previewPath(account.id, String(page.id))}><div><strong>{String(page.name)}</strong><span>{String(page.slug)}</span></div><span aria-hidden="true">→</span></a></li>)}</ul>
    </section>
  </main>);
}

export function proposalEvidenceView(account: SnapshotAccount, evidence: ProposalEvidence) {
  return layout("Synthetic proposal evidence", <main className="op-wrap op-main">
    <nav className="op-kicker" aria-label="Breadcrumb"><a href="/">Overview</a> / <a href={accountPath(account.id)}>C0 account</a> / Synthetic example</nav>
    <h1>Proposal evidence</h1><p className="op-lead">Disposable account · retained {evidence.source === "durable" ? "proposal history" : "revision and approval evidence"}</p>
    <div className="op-card"><span className="op-tag">Synthetic example</span><p>These records came from a completed test under a separate Web Presence and Managed Site. Recorded approvals describe the test. Current approval validity and publication are outside this walkthrough.</p></div>
    <section aria-labelledby="revisions"><h2 id="revisions">Recorded revisions <span className="op-count">{evidence.revisions.length}</span></h2>
      <ol className="op-list op-revisions">{evidence.revisions.map(({ revision, approval, preview }) => {
        const number = revision.binding.revision;
        return <li className="op-card" key={number}>
          <span className="op-tag">Revision {number}</span><h3>{revision.candidate.title}</h3><p>Page {revision.page.slug} · {revision.page.operation === "replace-page" ? "Replace page" : "Create page"}</p>
          <p>{approval ? (number === evidence.latest.revision ? "Approval recorded in the synthetic proof." : "Historical approval for this revision. A later revision followed.") : "No approval recorded for this revision in the retained evidence."}</p>
          {preview ? <><p className="op-follow"><a href={exactPreviewPath(evidence, number)} target="_blank" rel="noopener noreferrer" aria-label={`Open exact preview for revision ${number} (new tab)`}>Open exact preview <span aria-hidden="true">↗</span></a></p>
            <details><summary>Inspect evidence bindings</summary><dl><dt>Revision digest</dt><dd><code>{revision.binding.digest}</code></dd><dt>Preview digest</dt><dd><code>{preview.digest}</code></dd><dt>Canonical base fingerprint</dt><dd><code>{revision.binding.baseFingerprint}</code></dd>{approval && <><dt>Approval event digest</dt><dd><code>{approval.hash}</code></dd></>}</dl></details></>
            : <p>No exact preview evidence retained for this revision.</p>}
        </li>;
      })}</ol>
    </section>
  </main>);
}

export function pageView(account: SnapshotAccount, pageId: string) {
  const page = account.preview(pageId);
  if (!page) return null;
  return layout(`${page.page.name} preview`, <>
    <div className="op-preview"><div className="op-wrap"><nav aria-label="Preview navigation"><a href={accountPath(account.id)}>← {account.name} account</a>{account.pages.map(item => <a key={String(item.id)} href={previewPath(account.id, String(item.id))} aria-current={item.id === pageId ? "page" : undefined}>{String(item.name)}</a>)}</nav>
      <p>Snapshot preview · existing v3 renderer with reviewed copy and design tokens. Asset delivery and visitor interactions are outside this preview.</p></div></div>
    <FocusPage page={page} />
  </>, true);
}
