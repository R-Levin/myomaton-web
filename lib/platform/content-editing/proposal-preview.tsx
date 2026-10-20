import { renderToStaticMarkup } from "react-dom/server";
import { SectionRenderer } from "../../../components/managed-sites/section-renderer";
import type { Revision } from "./proposal";
import { record } from "../presentation/content";

/* eslint-disable @next/next/no-head-element -- Standalone private HTML artifact, not a Next route. */

// Existing Section renderer; no form, script, external media or operational action.
// CTA destinations are shown as text for inspection and are deliberately inert.
export function proposalPreview(revision: Revision): string {
  const p = revision.page;
  const base = record(revision.base), pages = Array.isArray(base.pages) ? base.pages.map(record) : [], current = pages.find(row => row.id === p.pageId);
  const sections = (Array.isArray(base.sections) ? base.sections.map(record) : []).filter(s => s.page_id === p.pageId).sort((a, b) => Number(a.sort_order) - Number(b.sort_order) || String(a.id).localeCompare(String(b.id)));
  return "<!doctype html>" + renderToStaticMarkup(<html lang="en"><head><meta charSet="utf-8" /><meta name="robots" content="noindex,nofollow" /><title>{`Site change proposal: ${revision.candidate.title}`}</title>
    <style>{"body{font:18px/1.6 system-ui;margin:3rem auto;max-width:65rem;padding:0 2rem;color:#252238;background:#faf8f3}section{padding:1.5rem 0;border-bottom:1px solid #ddd}aside{background:#eee9fa;padding:1rem}pre{white-space:pre-wrap;overflow-wrap:anywhere}h1,h2{line-height:1.2}"}</style></head><body>
    <aside><strong>Private development proposal — not published</strong><p>{p.operation === "create-page" ? "New Page" : "Replacement Page and ordered Sections"}: {p.slug}</p><p>Purpose: {p.purpose}</p><p>Page title: {revision.candidate.title}</p><p>Revision {revision.binding.revision} · {revision.binding.digest}</p><p>Base: {revision.binding.baseFingerprint}</p><p>Internal confirmed facts below are review material only. Approval grants no public disclosure or publication permission.</p></aside>
    <h2>Changes from current destination</h2><p>{current ? `Page title: ${current.title} → ${revision.candidate.title}. The proposed ordered Sections replace the current list below.` : "No current Page exists at this destination. The title and all Sections below are new."}</p>
    {sections.length > 0 && <><h3>Current Section order and copy</h3><ol>{sections.map(s => <li key={String(s.id)}><strong>{String(record(s.content).heading ?? s.name ?? s.type)}</strong><p>{String(record(s.content).text ?? (record(s.content).source ? "Canonical-bound copy; inspect the exact baseline source." : "No body text"))}</p></li>)}</ol></>}
    <h2>Full proposed Page</h2><main>{revision.candidate.sections.map((s, i) => <div key={s.id}><SectionRenderer section={{ ...s, action: null }} index={i} />{s.action && <p>CTA: {s.action.label} → {s.action.destination} (inert preview)</p>}</div>)}</main>
    <h2>Copy origin and editorial decisions</h2><ul>{revision.resolved.map(r => <li key={r.path}><strong>{r.path}</strong>: {r.value} — {r.origin.kind === "editorial" ? `Editorial judgment: ${r.origin.rationale}` : `Confirmed canonical ${r.origin.source.domain}, ${r.origin.source.recordId}, revision ${r.origin.source.revision}, field ${r.origin.source.field}, fingerprint ${r.origin.source.fingerprint}`}.</li>)}</ul>
    <details><summary>Current destination and exact proposed operations</summary><h3>Current site baseline</h3><pre>{JSON.stringify(revision.base, null, 2)}</pre><h3>Proposed Page / ordered Sections</h3><pre>{JSON.stringify(p, null, 2)}</pre></details>
  </body></html>);
}
