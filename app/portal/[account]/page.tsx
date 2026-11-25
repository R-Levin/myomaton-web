import { notFound, redirect } from "next/navigation";
import { clientAddresses } from "@/lib/platform/accounts/people";
import { readMyBusiness } from "@/lib/platform/intake/my-business";
import { outcome } from "@/lib/platform/service/cycle";
import { accounts, acting, serviceRuntime } from "@/lib/platform/service/runtime";
import { answerFact, answerReport, review, signOut } from "../../workspace/actions";
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
  // Everything the Client asked for, and what became of it, so nothing they asked for disappears from view.
  // A Request a Specialist sent on to a Work product is shown once, as first asked.
  const asked = record.ledger.requests.filter(request => request.origin.by.id === person.id && !/:to:/u.test(request.id)).slice(-12).reverse();
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
              {isPublish ? (<><p>Your site would go live exactly as it is now: {change.difference.summary}. Read each page first:</p>
                {(JSON.parse(change.difference.after ?? "{}") as { pages?: { id: string; path: string; version: number }[] }).pages?.map(page => {
                  // Exactly the Version being approved.
                  const version = record.products.find(item => item.id === page.id && item.version === page.version);
                  return version && (<details key={page.id} className="mt-2 rounded border border-neutral-200 p-3"><summary className="cursor-pointer font-medium">Page {page.path}</summary>
                    <div className="mt-2"><Content item={version} /></div></details>);
                })}</>) : product && <Content item={product} />}
              {product?.kind === "report" ? <ReportForm action={answerReport.bind(null, id, change.id)} findings={(product.content as { findings: { id: string; heading: string }[] }).findings} />
                : <ReviewForm action={review.bind(null, id, change.id)} approveLabel={isPublish ? "Approve publishing" : "Yes, this is right"} />}
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

      {record.publications?.length ? (
        <Section title="Your site" note={`You approved publishing on ${record.publications.at(-1)!.at.slice(0, 10)}.`}>
          <p>Approved, not public yet: MioPages&apos; public delivery is still being built. Nothing changes on your live site until it is.</p>
        </Section>) : null}

      {asked.length > 0 && (
        <Section title="What you asked for" note="Each thing you asked for, most recent first, and where it stands.">
          <ul className="space-y-2">{asked.map(request => { const result = outcome(record, request); return (
            <li key={request.id} className="rounded border border-neutral-200 p-3"><p className="whitespace-pre-wrap">{request.words.length > 400 ? request.words.slice(0, 400) + "…" : request.words}</p>
              <p className={"mt-1 text-sm " + (result.state === "done" || result.state === "answered" ? "text-green-800" : "text-neutral-600")}>
                {request.origin.channel === "email" ? "Your email" : "You asked"} on {request.at.slice(0, 10)}. {result.words}</p></li>); })}</ul>
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

/**
 * The Client's answer to the Report: approve it, or say, finding by finding, what is true. Their
 * words on a finding go into My Business as their own word, and Core reworks the Report from them.
 */
function ReportForm({ action, findings }: { action: (form: FormData) => Promise<void>; findings: { id: string; heading: string }[] }) {
  return (
    <form action={action} className="mt-3 space-y-2">
      <p className="text-sm text-neutral-600">If something is not right, say what is true under that heading. It goes into My Business as your word.</p>
      {findings.map(finding => (
        <label key={finding.id} className="block text-sm"><span className="font-medium">{finding.heading}</span>
          <textarea name={"finding:" + finding.id} rows={1} className={field} placeholder="What is true, in your words (leave empty if right)" /></label>))}
      <textarea name="words" rows={2} className={field} placeholder="Anything else about the Report as a whole" />
      <div className="flex flex-wrap gap-2">
        <button name="response" value="approve" className={primary}>Yes, this is right</button>
        <button name="response" value="correct" className={button}>Send my corrections</button>
        <button name="response" value="decline" className={button}>Decline</button>
      </div>
    </form>
  );
}
