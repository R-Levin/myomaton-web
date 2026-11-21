import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import type { RetainedSiteReview } from "../../lib/platform/intake/retained-site-review";
import styles from "../../components/intake/interview.module.css";

type Tab = "business" | "website" | "changes";
const sourceLabel = { "business-fact": "Source-backed business information", "staffed-offer": "Recorded service direction" };
const sourceExcerpt = (text: string) => { const opening = text.split(/\n\s*\n/u)[0]; return opening.length > 420 ? opening.slice(0, 420).replace(/\s+\S*$/u, "") + "…" : opening; };
const subscribeSelection = (listener: () => void) => { window.addEventListener("hashchange", listener); return () => window.removeEventListener("hashchange", listener); };

type ReferenceImage = { blob: Blob; width: number; height: number };
export function CurrentSiteReviewPanel({ review, preview, reference }: { review: RetainedSiteReview; preview: (path: string, before: boolean) => Promise<string>; reference?: (id: string) => Promise<ReferenceImage> }) {
  const hash = useSyncExternalStore(subscribeSelection, () => window.location.hash, () => "");
  const selection = new URLSearchParams(hash.slice(1));
  const tab: Tab = ["website", "changes"].includes(selection.get("view") ?? "") ? selection.get("view") as Tab : "business";
  const requestedPath = selection.get("page");
  const path = review.pages.some(item => item.path === requestedPath) ? requestedPath! : review.pages.find(item => item.path === "/")?.path ?? review.pages[0]?.path ?? "";
  const before = selection.get("before") === "1", mobile = selection.get("size") === "mobile";
  function select(update: Partial<{ tab: Tab; path: string; before: boolean; mobile: boolean }>) {
    const next = { tab, path, before, mobile, ...update };
    const params = new URLSearchParams({ view: next.tab, page: next.path, before: next.before ? "1" : "0", size: next.mobile ? "mobile" : "desktop" });
    window.history.replaceState(null, "", "#" + params.toString()); window.dispatchEvent(new HashChangeEvent("hashchange"));
  }
  const setTab = (tab: Tab) => select({ tab });
  const setMobile = (mobile: boolean) => select({ mobile });
  const setBefore = (before: boolean) => select({ before });
  const [reply, setReply] = useState<{ key: string; html?: string; failed?: true } | null>(null);
  const previewKey = path + ":" + before;
  const html = reply?.key === previewKey ? reply.html ?? "" : "";
  const failed = reply?.key === previewKey && reply.failed;
  const frame = useRef<HTMLIFrameElement>(null);
  const observer = useRef<ResizeObserver | null>(null);
  const selected = review.pages.find(item => item.path === path);
  const decision = review.blueprint?.pages.find(item => item.path === path);
  const change = review.changes.find(item => item.path === path);
  useEffect(() => {
    if (tab !== "website" || !path) return;
    let current = true;
    preview(path, before).then(value => { if (current) setReply({ key: previewKey, html: value }); }, () => { if (current) setReply({ key: previewKey, failed: true }); });
    return () => { current = false; };
  }, [tab, path, before, preview, previewKey]);
  useEffect(() => () => observer.current?.disconnect(), []);
  function navigate(next: string) {
    if (!review.pages.some(item => item.path === next)) return;
    select({ path: next, before: false, tab: "website" });
  }
  function frameReady() {
    const element = frame.current, document = element?.contentDocument;
    if (!element || !document) return;
    observer.current?.disconnect();
    const resize = () => { element.style.height = Math.max(700, document.body.scrollHeight) + "px"; };
    resize(); observer.current = new ResizeObserver(resize); observer.current.observe(document.body);
    document.addEventListener("click", event => {
      const link = (event.target as Element | null)?.closest("a");
      if (!link) return;
      event.preventDefault();
      const match = link.getAttribute("href")?.match(/(?:[?#&])page_id=(\d+)/u);
      const target = match && review.pages[Number(match[1]) - 1];
      if (target) navigate(target.path);
    });
  }
  return <section className={styles.currentWorkspace} aria-label="Current C0 work">
    <div className={styles.currentIntro}>
      <p className={styles.eyebrow}>MioPages · managed Web Presence</p>
      <h1>Your business and website work</h1>
      <p>Read the business information already retained, browse the saved proposal, and inspect the changes made to it.</p>
    </div>
    <p className={styles.hint}>Saved AI proposal · needs substantive review · latest changes not applied to WordPress.</p>
    <nav className={styles.workspaceTabs} aria-label="Your work">
      {([['business', 'Business understanding'], ['website', 'Website proposal'], ['changes', 'Changes and open decisions']] as const).map(([id, label]) =>
        <button type="button" key={id} aria-current={tab === id ? "page" : undefined} onClick={() => setTab(id)}>{label}</button>)}
    </nav>
    {tab === "business" && <section aria-label="Business understanding">
      {review.report && <article className={styles.businessSummary}><h2>Core’s proposed understanding</h2><p>{review.report.summary}</p>
        <p className={styles.hint}>This is the retained AI assessment. Its interpretations remain open to review.</p></article>}
      <h2>What you have already told MioPages</h2>
      <p>Your retained business information stays separate from AI interpretations and draft website copy.</p>
      <div className={styles.knowledgeGrid}>{review.understanding.map(source => <article className={styles.knowledgeCard} key={source.id}>
        <p className={styles.sourceBadge}>{sourceLabel[source.use as keyof typeof sourceLabel]}</p>
        <h3>{source.label}</h3><p>{sourceExcerpt(source.content)}</p>
        <details><summary>Read the recorded wording and source</summary><p className={styles.sourceRecord}>{source.content}</p><p>{source.reference}</p><p>{source.date ?? "Date not recorded"}</p></details>
      </article>)}</div>
      {review.report && <details className={styles.reviewDisclosure}>
        <summary>{review.lineage.report.predatesEvidence ? "Earlier AI assessment — needs a source refresh" : "AI business assessment — proposed understanding"}</summary>
        <p>{review.report.summary}</p>{review.report.findings.map(finding => <article key={finding.id}>
          <h3>{finding.heading}</h3><p>{finding.body}</p><small>{finding.status === "established" ? "Grounded finding; check its sources" : finding.status === "unresolved" ? "Unresolved" : "AI interpretation"}</small>
        </article>)}
      </details>}
      {review.direction && <details className={styles.reviewDisclosure}>
        <summary>{review.lineage.direction.predatesEvidence ? "Earlier Presence Direction — needs a source refresh" : "Proposed Presence Direction"}</summary>
        <h3>Positioning</h3><p>{review.direction.positioning}</p><h3>Approach</h3><p>{review.direction.approach}</p>
        <ul>{review.direction.visitorDecisions.map(item => <li key={item}>{item}</li>)}</ul>
      </details>}
      <button type="button" onClick={() => setTab("website")}>Browse the saved website proposal</button>
    </section>}
    {tab === "website" && <section aria-label="Website proposal">
      <div className={styles.previewToolbar}>
        <label>Page<select aria-label="Page" value={path} onChange={event => navigate(event.target.value)}>{review.pages.map(page =>
          <option key={page.path} value={page.path}>{review.blueprint?.pages.find(item => item.path === page.path)?.label ?? page.heading}</option>)}</select></label>
        <div><button type="button" className={!mobile ? undefined : styles.secondary} aria-pressed={!mobile} onClick={() => setMobile(false)}>Desktop</button>{" "}
          <button type="button" className={mobile ? undefined : styles.secondary} aria-pressed={mobile} onClick={() => setMobile(true)}>Mobile</button></div>
        {change?.before && <label><input type="checkbox" checked={before} onChange={event => setBefore(event.target.checked)} /> Show the earlier version</label>}
      </div>
      {decision && <details className={styles.reviewDisclosure}><summary>Why this page was proposed</summary><p>{decision.purpose}</p></details>}
      <p className={styles.hint}>Core preview uses the WordPress content renderer. Links between proposed pages work here; unverified destinations remain inactive.</p>
      {failed ? <p role="alert">Core could not render this saved page. The proposal is retained. No generation or application was attempted.</p>
        : !html ? <p role="status">Opening the saved page…</p>
          : <div className={mobile ? styles.mobilePreview : styles.desktopPreview}><iframe ref={frame} title={(before ? "Earlier " : "Proposed ") + (selected?.heading ?? "page")}
            srcDoc={html} sandbox="allow-same-origin" referrerPolicy="no-referrer" onLoad={frameReady} /></div>}
      {selected && <details className={styles.reviewDisclosure}><summary>Search appearance and unresolved links</summary>
        <h3>{selected.searchTitle}</h3><p>{selected.searchDescription}</p>
        {review.unresolved.filter(item => item.page === path).map((item, i) => <p key={i}><strong>{item.label}</strong> — {item.reason}</p>)}
      </details>}
      {reference && review.referenceImages.length > 0 && <EarlierDesignReferences images={review.referenceImages} read={reference} />}
    </section>}
    {tab === "changes" && <section aria-label="Changes and open decisions">
      <h2>What changed in the saved proposal</h2>
      <p>These are actual retained AI revisions. Their existence does not establish a useful improvement.</p>
      {review.changes.map(item => <article className={styles.knowledgeCard} key={item.path}>
        <h3>{item.label}</h3><p>{item.before ? "Saved wording or composition changed." : "Added to the saved proposal."}</p>
        {item.before && <div className={styles.changeColumns}><div><h4>Earlier opening</h4><p>{item.before.sections[0]?.body}</p></div>
          <div><h4>Revised opening</h4><p>{item.after.sections[0]?.body}</p></div></div>}
        <button type="button" onClick={() => navigate(item.path)}>Inspect this page in context</button>
      </article>)}
      <h2>What still needs attention</h2>
      <aside className={styles.reviewNotice}><h3>The recorded business need</h3>
        <p>Explain the complete managed Web Presence growth service in buyer language, including useful content, inquiries, understandable reporting and continuing improvement. This is already recorded; you do not need to repeat it.</p>
        <p>The retained changes are available for comparison. They have not yet demonstrated that this need is satisfied.</p>
      </aside>
      {review.needsUnderstandingRefresh && <article className={styles.knowledgeCard}><h3>Revisit the understanding before further copy changes</h3>
        <p>The report or Presence Direction predates newly connected business material. Rewriting individual pages from that earlier strategy is not enough to resolve the gap.</p></article>}
      {review.editorial && <><p>{review.editorial.summary}</p><ul>{review.editorial.concerns.map((item, i) => <li key={i}>{item.concern}</li>)}</ul></>}
      {review.editorialFindings.map(item => <p key={item.id}>{item.concern}</p>)}
      {review.unresolved.length > 0 && <details><summary>Unverified visitor destinations</summary><ul>{review.unresolved.map((item, i) => <li key={i}>{item.label} — {item.reason}</li>)}</ul></details>}
      <aside className={styles.reviewNotice}><h3>Connection to the ongoing service</h3>
        <p>This candidate is not yet linked to verified visitor measurements, inquiry outcomes or an applied WordPress revision in this view. Those connections remain part of the service work. No traffic, leads or business improvement is being claimed here.</p>
      </aside>
    </section>}
    <details className={styles.reviewDisclosure}><summary>Saved-work provenance</summary>
      <p>Actual retained Core AI output. No new model request was made to display it. This separate development case has not been merged into your original knowledge record or applied to WordPress.</p>
      <p>Saved revision {review.revision}; comparison revision {review.baselineRevision}. These identify records; they are not quality scores.</p>
      <code>{review.candidateDigest}</code>
    </details>
  </section>;
}

function EarlierDesignReferences({ images, read }: { images: RetainedSiteReview["referenceImages"]; read: (id: string) => Promise<ReferenceImage> }) {
  const [open, setOpen] = useState(false), [selected, setSelected] = useState(images[0].id);
  const [reply, setReply] = useState<{ id: string; url?: string; width?: number; height?: number; failed?: true } | null>(null);
  const url = reply?.id === selected ? reply.url ?? "" : "", failed = reply?.id === selected && reply.failed;
  useEffect(() => {
    if (!open) return;
    let active = true, objectUrl = "";
    read(selected).then(image => { objectUrl = URL.createObjectURL(image.blob); if (active) setReply({ id: selected, url: objectUrl, width: image.width, height: image.height }); else URL.revokeObjectURL(objectUrl); }, () => { if (active) setReply({ id: selected, failed: true }); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [open, selected, read]);
  return <details className={styles.reviewDisclosure} onToggle={event => { setOpen(event.currentTarget.open); if (!event.currentTarget.open) setReply(null); }}>
    <summary>Compare with the earlier retained website direction</summary>
    <p>Your earlier work is retained as an editorial reference. This is its saved capture, not a new proposal or a replacement for the current site.</p>
    <label>Earlier reference<select value={selected} onChange={event => setSelected(event.target.value)}>{images.map(image => <option key={image.id} value={image.id}>{image.label}</option>)}</select></label>
    {open && (failed ? <p role="alert">The retained reference could not be read. Nothing was regenerated.</p> : url ?
      <Image unoptimized className={styles.referenceCapture} src={url} width={reply?.width ?? 1} height={reply?.height ?? 1}
        alt={images.find(image => image.id === selected)?.label ?? "Earlier retained website"} /> : <p>Opening the retained reference…</p>)}
  </details>;
}
