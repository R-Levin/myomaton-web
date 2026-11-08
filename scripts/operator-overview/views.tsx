import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FocusPage } from "../../components/managed-sites/focus-page";
import { accountPath, previewPath, type SnapshotAccount } from "./model";
import { exactPreviewPath, type ProposalEvidence } from "./proposal-evidence";
import { approvedReviewDigest, type C0Review } from "./c0-review";

/* eslint-disable @next/next/no-head-element, @next/next/no-css-tags, @next/next/no-html-link-for-pages, @next/next/no-img-element -- Standalone HTML and local assets served by Node outside Next. */
function layout(title: string, children: ReactNode, preview = false) {
  return "<!doctype html>" + renderToStaticMarkup(<html lang="en"><head><meta charSet="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" /><title>{`${title} · MioPages Operator`}</title>
    <link rel="stylesheet" href="/operator.css" />{preview && <link rel="stylesheet" href="/presentation.css" />}
    <script src="/operator-role.js" defer />
  </head><body><header className="op-bar"><div className="op-wrap"><a href="/" aria-label="MioPages Operator overview"><span className="op-mark" aria-hidden="true">M</span>MioPages <span className="op-bar-label">Operator</span></a>
    <div className="op-identity"><strong>MioPages owner</strong> <span className="op-tag">Simulated</span>
      <div className="op-role-control"><label htmlFor="operator-role">Active role</label><select id="operator-role" defaultValue="content-reviewer" aria-describedby="role-boundary" disabled>
        <option value="content-reviewer">Content Reviewer</option><option value="technical-operator">Technical Operator</option>
      </select></div><small id="role-boundary">Read-only demo · no permissions granted</small>
    </div></div></header>
    {children}</body></html>);
}

export function overview(accounts: readonly SnapshotAccount[], development = false) {
  const attention = accounts.filter(account => account.nextReview);
  return layout("Overview", <main className="op-wrap op-main">
    <div className="op-kicker">Workspace / Overview</div><h1>Operator overview</h1>
    <p className="op-lead">Start with the accounts that need a decision.</p>
    <section aria-labelledby="attention"><h2 id="attention">Needs attention <span className="op-count">{attention.length}</span></h2>
      {accounts[0] && <aside className="op-card op-role-example" data-role-example="technical-operator" hidden>
        <span className="op-tag">Simulated role example</span><h3>Check the four website previews before a handoff</h3>
        <p>Compare the reviewed layout with the accepted design captures. This is an example check, with no recorded technical issue.</p>
        <p className="op-follow"><a href={`${accountPath(accounts[0].id)}#website`}>Open website previews</a></p>
      </aside>}
      {attention.length ? <ul className="op-list">{attention.map(account => <li className="op-card op-alert" key={account.id}>
        <div><span className="op-tag op-warn">Recorded C0 decision · Content review</span><h3>Choose what past work MioPages can show</h3>
          <p>The Experience page has room for a past project. Confirm what MioPages contributed and get permission to show the work.</p></div>
        <a className="op-button" href={accountPath(account.id)}>Open MioPages journey <span aria-hidden="true">→</span></a>
      </li>)}</ul> : <p className="op-card">No Operator review is flagged in the loaded snapshot.</p>}
    </section>
    <section aria-labelledby="accounts"><h2 id="accounts">Accounts <span className="op-count">{accounts.length}</span></h2>
      <ul className="op-list op-directory">{accounts.map(account => <li key={account.id}><a href={accountPath(account.id)}>
        <div><strong>{account.name}</strong><span>{account.domain} · {account.pages.length} pages</span></div>
        <span className="op-tag">{account.nextReview ? "Review open" : "No review flagged"}</span>
      </a></li>)}</ul>
      <p className="op-note">Source: reviewed development snapshot. Customer activity, monitoring, and live workflow queues are outside this view.</p>
    </section>
    {development && <p className="op-note"><a href="/development-evidence">Development evidence</a> · separate test examples</p>}
  </main>);
}

const stages = [["interview", "Interview"], ["knowledge", "Confirmed business knowledge"], ["website", "Website content and design"],
  ["review", "Operator review"], ["next-action", "Next action"]] as const;
const date = (value: string) => new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" }).format(new Date(value));
const factLabels: Record<string, string> = { audience: "Who it serves", "initial-geography": "Where it serves", clarity: "What should improve",
  burden: "What customers should spend less time on", ownership: "Customer ownership" };
const pagePurpose: Record<string, string> = { "/": "Who MioPages helps and what it takes care of", "/service": "What Launch and ongoing care include",
  "/experience": "What past work can demonstrate", "/review": "What a Free Web Presence Review would provide" };

export function accountView(account: SnapshotAccount, review: C0Review | null) {
  return layout(account.name, <main className="op-wrap op-main op-journey">
    <nav className="op-kicker" aria-label="Breadcrumb"><a href="/">Overview</a> / MioPages journey</nav>
    <h1>MioPages journey</h1><p className="op-lead">Customer #0 · {account.domain}</p>
    <p>Follow the retained record from discovery to the reviewed four-page website and the next decision.</p>
    <nav className="op-steps" aria-label="Journey steps"><ol>{stages.map(([id, label]) => <li key={id}><a href={`#${id}`}>{label}</a></li>)}</ol></nav>
    <aside className="op-card op-role-example" data-role-example="content-reviewer">
      <span className="op-tag">Simulated role example</span><h3>Content Reviewer focus</h3>
      <p>Compare the interview with the confirmed business knowledge. Check what MioPages can substantiate before proposing new copy or imagery.</p>
      <p className="op-follow"><a href="#interview">Review interview evidence</a> · <a href="#next-action">Review the Experience decision</a></p>
    </aside>
    <aside className="op-card op-role-example" data-role-example="technical-operator" hidden>
      <span className="op-tag">Simulated role example</span><h3>Technical Operator focus</h3>
      <p>Check the four reviewed pages, their navigation and accepted design captures. The local previews show development evidence. Live delivery status is outside this view.</p>
      <p className="op-follow"><a href="#website">Check reviewed website pages</a></p>
    </aside>

    <section id="interview" aria-labelledby="interview-heading"><h2 id="interview-heading">1. Interview</h2>
      <div className="op-card"><span className="op-tag">Approved discovery summary</span><h3>What the original discovery established</h3>
        <p>The approved business brief brings together three discovery passes. It describes an established small business that needs a clearer, more credible presence and wants someone to keep it useful after launch. It also separates the paid managed service from a useful free Review.</p>
        <p className="op-follow">Source: <cite>MioPages Customer #0 business brief</cite> · October 6, 2026. The original interview transcript and verbatim answers were unavailable for this walkthrough.</p>
      </div>
      {review ? <details><summary>Read selected answers from the later Free Review interview</summary>
        <p>Submitted {date(review.submittedAt)} during a separate local Review walkthrough. These are the original answers to those later questions, as supplied and unconfirmed. The display omits contact fields.</p>
        <dl className="op-answers">{review.answers.map(({ question, answer }) => <div key={question}><dt>{question}</dt><dd>{Array.isArray(answer) ? answer.join(" · ") : answer}</dd></div>)}</dl>
      </details> : <p className="op-note">Selected answers from the later Free Review intake are unavailable in this run.</p>}
    </section>

    <section id="knowledge" aria-labelledby="knowledge-heading"><h2 id="knowledge-heading">2. Confirmed business knowledge</h2>
      {account.knowledge.map(knowledge => <div className="op-card" key={knowledge.approval.at}>
        <span className="op-tag">Confirmed in this website snapshot</span><h3>Business facts that guide the site</h3>
        <p>Business Knowledge revision {knowledge.version} · approved {date(knowledge.approval.at)}. These entries were drawn from the approved brief.</p>
        <dl className="op-answers">{knowledge.entries.filter(entry => entry.evidence.confirmation === "confirmed" && entry.evidence.visibility === "public" && Object.hasOwn(factLabels, entry.key))
          .map(entry => <div key={entry.key}><dt>{factLabels[entry.key]}</dt><dd>{entry.value}</dd></div>)}</dl>
      </div>)}
      {account.offerings.map(offering => <div className="op-card op-follow-card" key={offering.name}>
        <h3>{offering.name}</h3><p>{offering.summary}</p><ul>{offering.components.map(component => <li key={component.key}><strong>{component.name}</strong> · {component.summary}</li>)}</ul>
        <p>Offer revision {offering.version}. The business brief’s price figures were planning assumptions.</p>
      </div>)}
    </section>

    <section id="website" aria-labelledby="website-heading"><h2 id="website-heading">3. Website content and design</h2>
      <div className="op-card"><span className="op-tag">Accepted design milestone</span><h3>A Business in Focus</h3>
        <p>The website plan proposed four pages. The owner accepted a design with explanatory illustration, strong purple fields and a clear connection between Launch and ongoing care. The reviewed page copy and design were applied to the development site on {date(account.websiteReviewedAt)}.</p>
        <p className="op-follow">The Service page uses the confirmed offer for Launch and ongoing care, and confirmed knowledge for ownership. Each page below opens inside this console.</p>
      </div>
      <ul className="op-list op-directory op-follow-card">{account.pages.map(page => <li key={String(page.id)}><a href={previewPath(account.id, String(page.id))}><div><strong>{String(page.name)}</strong><span>{pagePurpose[String(page.slug)]}</span></div><span>Version {String(page.version)} <span aria-hidden="true">→</span></span></a></li>)}</ul>
    </section>

    <section id="review" aria-labelledby="review-heading"><h2 id="review-heading">4. Operator review</h2>
      <div className="op-card"><h3>Website design review</h3><p>The accepted design and development change are recorded in the website’s review history. An exact C0 page proposal and approval trail is unavailable in this snapshot. The four-page snapshot carries {account.publicationAuthorized ? "recorded publication authorization" : "no publication authorization"}.</p></div>
      <div className="op-card op-follow-card"><span className="op-tag">Historical · approved and undelivered</span><h3>Free Web Presence Review of MioPages</h3>
        <p>This later Review used the submitted answers and a later development website. It is separate from approval of the four-page design and from the website’s Review page.</p>
        {review ? <><ol className="op-history">{review.revisions.map(revision => <li key={revision.number}>Revision {revision.number} · {revision.source === "operator-edit" ? "Human edit" : "First draft"} · {date(revision.at)}</li>)}
          <li>Revision 3 approved · {date(review.approvedAt)}</li></ol>
          <details><summary>Read the approved Review text</summary>
            {review.sections.map(section => <article key={section.title}><h3>{section.title}</h3>{section.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</article>)}
          </details><details><summary>View approval reference and pages reviewed</summary><p>Approved revision fingerprint <code>{approvedReviewDigest}</code></p><p>Recorded approval fingerprint <code>{review.approvalEvent}</code></p><p>Later development pages reviewed: {review.reviewedPaths.join(", ")}</p></details></>
          : <p className="op-follow">The approval is documented in Git. The retained text and revision files are unavailable in this run.</p>}
      </div>
      <p className="op-note">The owner declined the Pixabay images considered for Home. No stock selection remains open for C0.</p>
    </section>

    <section id="next-action" aria-labelledby="next-action-heading"><h2 id="next-action-heading">5. Next action</h2>
      {account.nextReview && <div className="op-card op-alert"><div><h3>Choose a past project the Experience page can show</h3>
        <p>Confirm the business context and what MioPages contributed. Get permission for any project names or images you want to show. The current page can stay text-led while that evidence is gathered.</p></div>
        <a className="op-button" href={previewPath(account.id, account.nextReview.pageId)}>Preview Experience <span aria-hidden="true">→</span></a></div>}
    </section>
  </main>);
}

export function proposalEvidenceView(evidence: ProposalEvidence) {
  return layout("Synthetic proposal evidence", <main className="op-wrap op-main">
    <nav className="op-kicker" aria-label="Breadcrumb"><a href="/">Overview</a> / Development evidence</nav>
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

export function pageView(account: SnapshotAccount, pageId: string, capture?: string) {
  const page = account.preview(pageId);
  if (!page) return null;
  return layout(`${page.page.name} preview`, <>
    <div className="op-preview"><div className="op-wrap"><nav aria-label="Preview navigation"><a href={`${accountPath(account.id)}#website`}>← MioPages journey</a>{account.pages.map(item => <a key={String(item.id)} href={previewPath(account.id, String(item.id))} aria-current={item.id === pageId ? "page" : undefined}>{String(item.name)}</a>)}</nav>
      <p>Website preview · reviewed development copy and layout. Illustrations and visitor actions are limited here.</p>
      <p data-role-example="content-reviewer"><strong>Simulated Content Reviewer focus</strong> · Read the page in context and <a href={`${accountPath(account.id)}#review`}>check the recorded review</a>.</p>
      <p data-role-example="technical-operator" hidden><strong>Simulated Technical Operator focus</strong> · Follow the page links and compare the design capture if available.</p>
      {capture && <details><summary>See the accepted design capture</summary><p>This historical capture includes the illustrative design elements used for review.</p><img loading="lazy" src={capture} alt={`Accepted design capture of the MioPages ${page.page.name} page`} /></details>}</div></div>
    <FocusPage page={page} />
  </>, true);
}
