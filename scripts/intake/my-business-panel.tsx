import type { MyBusinessView } from "../../lib/platform/intake/my-business";

const factLabels = {
  audience: "Who you serve", goal: "Business goals", "service-area": "Where you serve",
  differentiator: "What makes you different", constraint: "Service boundaries", preference: "Preferences",
} satisfies Record<MyBusinessView["facts"][number]["kind"], string>;

const sources = { customer: "Customer", operator: "Operator", "public-reference": "Public reference" };

export function MyBusinessPanel({ business }: { business: MyBusinessView }) {
  const descriptions = (item: MyBusinessView["facts"][number] | MyBusinessView["offerings"][number]) =>
    `Confirmed ${item.confirmedAt.slice(0, 10)} · ${sources[item.source]} source · revision ${item.revision}`;
  return <section id="my-business" aria-labelledby="my-business-heading">
    <h2 id="my-business-heading">My Business</h2>
    <p>These confirmed records describe your business and its offerings. The business report below can contain interpretations and open questions.</p>
    {!business.facts.length && !business.offerings.length && <p>No confirmed records are available in this workspace.</p>}
    {business.facts.length > 0 && <dl>{business.facts.map(item => <div key={item.id}>
      <dt>{factLabels[item.kind]}</dt><dd>{item.value}<br /><small>{descriptions(item)}</small></dd>
    </div>)}</dl>}
    {business.offerings.map(item => <article key={item.id}>
      <h3>{item.name}</h3><p>{item.summary}</p><p><small>{descriptions(item)}</small></p>
    </article>)}
    <p><a href="#business-report-and-website">Review Core’s business report and flag an interpretation</a></p>
  </section>;
}
