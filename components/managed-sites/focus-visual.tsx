import type { Fpo } from "../../lib/platform/presentation/fpo";

// Fixed authored visual families, not customer coordinates or a report builder.
export function FocusVisual({ slot }: { slot: Fpo }) {
  const artifact = slot.role === "review-artifact";
  const service = slot.role === "service-illustration" || slot.role === "process-relationship";
  return <figure className={`focus-visual ${artifact ? "focus-report" : service ? "focus-service" : "focus-evidence"}`} data-fpo-role={slot.role} data-fpo-aspect={slot.aspect} data-fpo-source={slot.source} data-fpo-importance={slot.importance} data-permission={slot.permission}>
    {service ? <>
      <svg viewBox="0 0 720 530" role="img" aria-label="Business knowledge is brought into a clear public presence, with continuing care around it">
        <path d="M42 322H245L336 210H610" fill="none" stroke="#e8e2f2" strokeWidth="26" />
        <path d="M302 137C409 34 618 87 656 251C697 423 543 507 402 440" fill="none" stroke="#555ccc" strokeWidth="60" />
        <path d="M405 440L441 399M405 440L459 454" fill="none" stroke="#e9ba8e" strokeWidth="15" />
        <rect x="50" y="138" width="166" height="74" rx="4" fill="#e8e2f2" />
        <rect x="21" y="225" width="180" height="74" rx="4" fill="#fbf7ef" />
        <rect x="66" y="312" width="160" height="74" rx="4" fill="#e9ba8e" />
        <rect x="291" y="197" width="238" height="238" fill="#241d35" />
        <rect x="268" y="174" width="238" height="238" fill="#fbf7ef" />
        <path d="M317 252H453M317 277H419M317 302H443" stroke="#322f7e" strokeWidth="12" />
        <path d="M317 350H380" stroke="#e9ba8e" strokeWidth="22" />
        <rect x="539" y="160" width="142" height="63" rx="4" fill="#e8e2f2" />
        <rect x="535" y="306" width="146" height="63" rx="4" fill="#e9ba8e" />
        <g fill="#322f7e" fontSize="22" fontWeight="600" aria-hidden="true">
          <text x="72" y="182">Your offer</text><text x="43" y="270">Your audience</text><text x="85" y="357">Next step</text>
          <text x="553" y="199">Updates</text><text x="553" y="346">Attention</text>
        </g>
      </svg>
      <div className="focus-visual-labels"><span>Know your business</span><span>Give it clear form</span><span>Keep it useful</span></div>
      <p className="focus-visual-explanation">Your knowledge, shaped into a public presence. Continuing attention keeps it connected to your business.</p>
    </> : artifact ? <div className="focus-report-composition">
      <div className="focus-report-sheet" aria-label="Illustrative Review outline; no actual findings">
        <p className="focus-kicker">Web Presence Review · illustrative outline</p><h3>A useful view of what comes next</h3>
        <div className="focus-report-region"><strong>What we understand</strong><p>Business context, audience and intended next step.</p></div>
        <div className="focus-report-region"><strong>Three useful priorities</strong><ol className="focus-priorities">{[1,2,3].map(n => <li key={n}>Priority position {n}<span aria-hidden="true" /></li>)}</ol></div>
        <div className="focus-report-region"><strong>Suggested next path</strong><p>A recommendation to discuss and confirm.</p></div>
      </div>
      <div className="focus-report-notes"><aside><span className="focus-kicker">Understanding</span><p>Check that the Review reflects your business.</p></aside><aside><span className="focus-kicker">Priorities</span><p>A short set of useful things to address, with reasons.</p></aside><aside><span className="focus-kicker">Next path</span><p>Clarity about what to do next, including whether the service fits.</p></aside></div>
    </div> : <>
      <div className="focus-evidence-mount" aria-label="Reserved visual evidence, not a client screenshot"><span className="focus-evidence-form" aria-hidden="true" /><strong>{slot.importance === "important" ? "Featured work · visual position" : "Supporting work · visual position"}</strong><p>Permission-cleared project imagery will occupy this space.</p></div>
      <dl className="focus-evidence-context"><div><dt>Business context</dt><dd>To be verified for the selected example.</dd></div><div><dt>Operator contribution</dt><dd>To be confirmed before publication.</dd></div></dl>
    </>}
    <figcaption><strong>FPO · Preview only</strong><span>{slot.purpose}</span><small>{slot.aspect} · {slot.importance} · {slot.source} · permission unresolved</small></figcaption>
  </figure>;
}
