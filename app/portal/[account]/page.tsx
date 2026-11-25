import { notFound, redirect } from "next/navigation";
import { clientAddresses } from "@/lib/platform/accounts/people";
import { readMyBusiness } from "@/lib/platform/intake/my-business";
import { accounts, acting, serviceRuntime } from "@/lib/platform/service/runtime";
import { answerFact, review, signOut } from "../../workspace/actions";
import { Content, Frame, ReviewForm, Section, button, field, primary, productName } from "../../workspace/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your portal", robots: { index: false, follow: false } };

/** The Client Portal: what needs you, and My Business. */
export default async function ClientAccount({ params }: { params: Promise<{ account: string }> }) {
  const runtime = await serviceRuntime();
  if (!runtime) notFound();
  const person = await acting();
  const { account: id } = await params;
  const found = (await accounts(runtime.pool)).find(item => item.account.webPresenceId === id);
  if (!found) notFound();
  if (!person || person.role !== "customer" || !(await clientAddresses(runtime.pool, id)).includes(person.id)) redirect("/workspace");
  const record = await runtime.store.read(found.account);
  const business = await readMyBusiness(runtime.pool, id);
  const forYou = record.ledger.changes.filter(change => change.status === "proposed" && change.consequence === "customer-approval");
  // The Client's own Requests still being worked on, so nothing they asked for disappears from view.
  const asked = record.ledger.requests.filter(request => request.status === "open" && request.origin.by.id === person.id);
  return (
    <Frame title={found.name} who={person.name}>
      <form action={signOut} className="mb-6"><button className={button}>Switch person</button></form>

      <Section title="Needs you" note={forYou.length || business.proposed.length ? "Nothing goes ahead on these without your word." : "Nothing is waiting for you."}>
        {forYou.map(change => {
          const product = record.products.find(item => item.changeId === change.id);
          const isPublish = change.id.startsWith("publish:");
          return (
            <article key={change.id} className="mb-4 rounded border border-neutral-200 p-4">
              <h3 className="font-semibold">{isPublish ? "Publish your site" : product ? `${productName(product)}, version ${product.version}` : change.difference.summary}</h3>
              {isPublish ? <p>Your site would go live exactly as it is now: {change.difference.summary}.</p> : product && <Content item={product} />}
              <ReviewForm action={review.bind(null, id, change.id)} approveLabel={isPublish ? "Approve publishing" : "Yes, this is right"} />
            </article>
          );
        })}
        {business.proposed.map(item => (
          <article key={item.id} className="mb-3 rounded border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs uppercase text-amber-800">Waiting for your confirmation (from {item.from})</p>
            <p className="my-1">{item.value}</p>
            <form action={answerFact.bind(null, id, item.key)} className="space-y-2">
              <input name="words" className={field} placeholder="If it needs correcting, write it as it should read" />
              <div className="flex flex-wrap gap-2">
                <button name="response" value="confirm" className={primary}>Yes, that is right</button>
                <button name="response" value="correct" className={button}>Correct it</button>
                <button name="response" value="decline" className={button}>That is not true</button>
              </div>
            </form>
          </article>
        ))}
      </Section>

      {asked.length > 0 && (
        <Section title="What you asked for" note="Being worked on. You will see the result here to confirm.">
          <ul className="list-disc space-y-1 pl-6">{asked.map(request => <li key={request.id}>{request.words}</li>)}</ul>
        </Section>
      )}

      <Section title="My Business" note="What MioPages holds as true about your business, as you confirmed it.">
        <ul className="list-disc space-y-1 pl-6">{business.facts.map(item => <li key={item.id}>{item.value}</li>)}</ul>
        {business.offerings.length > 0 && (<><h3 className="mt-4 font-semibold">What you offer</h3>
          <ul className="list-disc pl-6">{business.offerings.map(item => <li key={item.id}><span className="font-medium">{item.name}</span>: {item.summary}</li>)}</ul></>)}
      </Section>
    </Frame>
  );
}
