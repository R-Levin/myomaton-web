import type { MyBusinessView } from "../../lib/platform/intake/my-business";
import type { PresenceWorkflowView } from "../../lib/platform/intake/presence-workflow";

const factLabels = {
  audience: "Who you serve", goal: "Business goals", "service-area": "Where you serve",
  differentiator: "What makes you different", constraint: "Service boundaries", preference: "Preferences",
} satisfies Record<MyBusinessView["facts"][number]["kind"], string>;

const sources = { customer: "Customer", operator: "Operator", "public-reference": "Public reference" };

export function MyBusinessPanel({ business, corrections = [] }: {
  business: MyBusinessView; corrections?: PresenceWorkflowView["corrections"];
}) {
  const customerCorrections = corrections.filter(item => item.actor.role === "customer");
  const descriptions = (item: MyBusinessView["facts"][number] | MyBusinessView["offerings"][number]) =>
    `Confirmed ${item.confirmedAt.slice(0, 10)} · ${sources[item.source]} source · revision ${item.revision}`;
  return <section id="my-business" aria-labelledby="my-business-heading">
    <h2 id="my-business-heading">My Business</h2>
    <p>These confirmed records describe your business and its offerings. The business report below can contain interpretations and open questions.</p>
    {!business.facts.length && !business.offerings.length && <p>No confirmed records are available in this workspace.</p>}
    {business.facts.length > 0 && <dl>{business.facts.map(item => <div key={item.id}>
      <dt>{factLabels[item.kind]}</dt><dd>{item.value}<br /><small>{descriptions(item)}</small>
        {item.history.length > 0 && <details><summary>Earlier confirmed wording</summary>
          <ul>{item.history.map(prior => <li key={prior.revision}>Revision {prior.revision} · {prior.confirmedAt.slice(0, 10)} · {prior.value}</li>)}</ul>
        </details>}
      </dd>
    </div>)}</dl>}
    {business.offerings.map(item => <article key={item.id}>
      <h3>{item.name}</h3><p>{item.summary}</p><p><small>{descriptions(item)}</small></p>
      {item.history.length > 0 && <details><summary>Earlier confirmed offering</summary>
        <ul>{item.history.map(prior => <li key={prior.revision}>Revision {prior.revision} · {prior.confirmedAt.slice(0, 10)} · {prior.name} · {prior.summary}</li>)}</ul>
      </details>}
    </article>)}
    {customerCorrections.length > 0 && <section aria-label="Your submitted corrections">
      <h3>Your submitted corrections</h3>
      <p>These notes are kept with the report. Confirmed business records above have their own review.</p>
      <ul>{customerCorrections.map(item => <li key={item.finding.id}><strong>{item.finding.heading}</strong> · {item.text}</li>)}</ul>
    </section>}
    <p><a href="#business-report-and-website">Review Core’s business report and flag an interpretation</a></p>
  </section>;
}
