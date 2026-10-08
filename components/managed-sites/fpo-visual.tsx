import type { Fpo } from "../../lib/platform/presentation/fpo";

// Explanatory layout, never a purported screenshot or customer assessment.
export function FpoVisual({ slot }: { slot: Fpo }) {
  const artifact = slot.role === "review-artifact";
  const service = slot.role === "service-illustration" || slot.role === "process-relationship";
  return <figure className={`p-fpo ${artifact ? "p-artifact" : service ? "p-service-visual" : "p-evidence-position"}`} data-fpo-role={slot.role} data-fpo-aspect={slot.aspect} data-fpo-source={slot.source} data-permission="unresolved">
    <figcaption><span className="p-label">FPO · Preview only</span><span>{slot.purpose}</span><small>{slot.aspect.replaceAll("-", " ")} · {slot.importance} · permission unresolved</small></figcaption>
    {artifact ? <div className="p-artifact-sheet" aria-label="Illustrative assessment outline; no actual findings">
      <p className="p-label">Assessment outline · illustrative</p><h3>A useful view of what comes next</h3>
      <div className="p-artifact-context"><strong>What we understand</strong><p>Business context and intended visitor action</p></div>
      <ol className="p-artifact-priorities">{[1, 2, 3].map(n => <li key={n}><span>Priority {n}</span><span className="p-placeholder-line" aria-hidden="true" /></li>)}</ol>
      <div className="p-artifact-path"><strong>Suggested next path</strong><p>Clarify · discuss · confirm fit</p></div>
    </div> : service ? <ol className="p-service-diagram" aria-label="Illustrative continuing-service relationship">
      <li><span className="p-diagram-symbol" aria-hidden="true">01</span><h3>Business understanding</h3><p>The offer, the audience, the useful next step.</p></li>
      <li><span className="p-diagram-symbol" aria-hidden="true">02</span><h3>Clear presence</h3><p>Bring the right information into focus.</p></li>
      <li><span className="p-diagram-symbol" aria-hidden="true">03</span><h3>Continuing attention</h3><p>Carry that understanding forward.</p></li>
    </ol> : <div className="p-evidence-space"><span>Approved visual evidence belongs here</span><p>Image and contribution details await permission.</p></div>}
  </figure>;
}
