import type { ReviewDraft } from "./model";
import type { ReviewState } from "./store";
export function reviewSections(d: ReviewDraft): { title: string; paragraphs: string[] }[] {
  return [
    { title: "What we understand", paragraphs: [d.understanding.text] },
    { title: d.startingPoint.framing === "existing" ? "What appears to be working" : "Your starting point", paragraphs: [d.startingPoint.content.text] },
    ...d.opportunities.map((o, i) => ({ title: `${i + 1}. ${o.title}`, paragraphs: [`What matters: ${o.what.text}`, `Why it matters: ${o.why.text}`, `Recommended direction: ${o.direction.text}`] })),
    { title: "Recommended first direction", paragraphs: [d.firstDirection.text] },
    { title: "Conversion observation", paragraphs: [d.conversion.text] },
    { title: "MioPages fit", paragraphs: [d.fit.content.text] },
    { title: "Optional Home concept", paragraphs: [d.teaser.content.text] },
  ];
}
export function reviewMarkdown(d: ReviewDraft) { return "# Your Free Web Presence Review\n\n" + reviewSections(d).map(s => `## ${s.title}\n\n${s.paragraphs.join("\n\n")}`).join("\n\n") + "\n"; }
const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
export function reviewHtml(review: ReviewState, operator = false) {
  const draft = review.revisions.at(-1)!.content;
  const p = review.packet.presence;
  const coverage = p ? `<h2>${escape(p.label)}</h2><p>${escape(p.observedVersion)}</p><p>Intake describes the prospect's stated intent. The rendered site is assessed against that intent, not treated as confirmed business truth.</p><h2>Representative Page coverage</h2><ul>${p.reviewed.map(page => `<li><strong>${escape(page.route)}</strong> — ${escape(page.purpose)}<br>Captured ${escape(page.capturedAt)}. ${escape(page.limitations)}</li>`).join("")}</ul><h2>Discovered, not reviewed</h2><ul>${p.omitted.map(page => `<li>${escape(page.route)} — ${escape(page.reason)}</li>`).join("")}</ul>` : "";
  const content = operator ? `<h1>Operator Review</h1><p>${escape(review.state)} · revision ${review.revisions.at(-1)!.number} · Development/manual synthesis</p><p>This trusted local preview is not prospect delivery or production authentication. Edit and approve through the local CLI; the substantive draft requires human approval.</p>${coverage}<h2>Source and evidence / claim mapping / history</h2><pre>${escape(JSON.stringify(review, null, 2))}</pre>`
    : `<h1>Your Free Web Presence Review</h1>${reviewSections(draft).map(s => `<section><h2>${escape(s.title)}</h2>${s.paragraphs.map(p => `<p>${escape(p)}</p>`).join("")}</section>`).join("")}`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${p ? escape(p.label) + (operator ? " — Operator" : "") : operator ? "Operator Review" : "Free Web Presence Review"}</title><style>body{font:17px/1.55 system-ui,sans-serif;color:#271a35;background:#faf8f4;margin:0}main{max-width:780px;margin:40px auto;padding:24px}h1{font-size:2rem}h2{font-size:1.2rem;margin-top:1.7em}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px}p{overflow-wrap:anywhere}@media print{main{margin:0;font-size:11pt;padding:0}section{break-inside:avoid}}</style></head><body><main>${content}</main></body></html>`;
}
