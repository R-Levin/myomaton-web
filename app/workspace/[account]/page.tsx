import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { clientPeople } from "@/lib/platform/accounts/people";
import { readMyBusiness } from "@/lib/platform/intake/my-business";
import { currentSite, tasks } from "@/lib/platform/service/cycle";
import { accounts, acting, serviceRuntime } from "@/lib/platform/service/runtime";
import { addPerson, askPublish, beginLaunch, proposeFact, removePerson, review, runCore } from "../actions";
import { Content, Frame, ReviewForm, Section, button, field, primary, productName } from "../ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Account", robots: { index: false, follow: false } };

/** One Account, for a Specialist: where it stands, what waits, its Work products, Knowledge and people. */
export default async function AccountPage({ params }: { params: Promise<{ account: string }> }) {
  const runtime = await serviceRuntime();
  if (!runtime) notFound();
  const person = await acting();
  if (!person || person.role !== "operator") redirect("/workspace");
  const { account: id } = await params;
  const found = (await accounts(runtime.pool)).find(item => item.account.webPresenceId === id);
  if (!found) notFound();
  const record = await runtime.store.read(found.account);
  const waiting = tasks(record);
  const site = currentSite(record);
  const [business, people] = await Promise.all([readMyBusiness(runtime.pool, id), clientPeople(runtime.pool, id)]);
  const proposed = record.products.filter(item => item.status === "proposed");
  const currentProducts = record.products.filter(item => item.status === "current");
  const publishWaiting = record.ledger.changes.find(change => change.id.startsWith("publish:") && change.status === "proposed");
  const started = record.ledger.requests.some(request => request.origin.kind === "stage-start");
  return (
    <Frame title={found.name} who={person.name}>
      <p className="mb-6"><Link className="underline" href="/workspace">Back to the Queue</Link></p>

      <Section title="Where it stands" note={!started ? "Launch has not started." : site?.complete ? "Every page has an approved version." : "Launch is under way."}>
        <div className="flex flex-wrap gap-2">
          {!started && <form action={beginLaunch.bind(null, id)}><button className={primary}>Start Launch</button></form>}
          {waiting.some(task => task.who === "core") && (
            <form action={runCore.bind(null, id)}><button className={primary}>Let Core do its waiting work</button>
              <p className="mt-1 text-xs text-neutral-600">Locally Core&apos;s AI is a {runtime.writerLabel}; it writes labelled stand-in content.</p></form>)}
          {site?.complete && !publishWaiting && <form action={askPublish.bind(null, id)}><button className={button}>Ask the Client to approve Publish</button></form>}
        </div>
        {waiting.length > 0 && <ul className="mt-3 space-y-1">{waiting.map(task => <li key={task.id}>{task.what} <span className="text-xs text-neutral-500">({task.who})</span></li>)}</ul>}
      </Section>

      {proposed.length > 0 && (
        <Section title="Proposed changes" note="Each is a new version Core wrote. Read it in full, then approve, correct it in your own words, or decline.">
          {proposed.map(item => {
            const change = record.ledger.changes.find(entry => entry.id === item.changeId)!;
            const forClient = change.consequence === "customer-approval";
            return (
              <article key={item.changeId} className="mb-4 rounded border border-neutral-200 p-4">
                <h3 className="font-semibold">{productName(item)}, version {item.version}</h3>
                <Content item={item} />
                {forClient ? <p className="mt-3 text-sm text-neutral-600">This one is the Client&apos;s to approve, in their portal.</p>
                  : <ReviewForm action={review.bind(null, id, item.changeId)} />}
              </article>
            );
          })}
        </Section>
      )}
      {publishWaiting && <Section title="Publish" note="Waiting for the Client's approval in their portal."><p>{publishWaiting.difference.summary}</p></Section>}

      <Section title="Work products" note="The current approved version of each.">
        {currentProducts.length ? currentProducts.map(item => (
          <details key={item.changeId} className="mb-2 rounded border border-neutral-200 p-3"><summary className="cursor-pointer font-medium">{productName(item)}, version {item.version}</summary>
            <div className="mt-2"><Content item={item} /></div></details>)) : <p className="text-neutral-600">None yet.</p>}
      </Section>

      <Section title="Knowledge" note={`${business.facts.length} confirmed items; ${business.proposed.length} waiting for the Client.`}>
        {business.proposed.length > 0 && <ul className="mb-3 list-disc pl-6">{business.proposed.map(item => <li key={item.id}>{item.value} <span className="text-xs text-amber-700">Proposed, from {item.from}</span></li>)}</ul>}
        <form action={proposeFact.bind(null, id)} className="space-y-2">
          <input name="statement" className={field} placeholder="A fact you learned about the business" />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="publicUse" defaultChecked /> May appear on the website</label>
          <button className={button}>Add as a Proposed fact</button>
        </form>
      </Section>

      <Section title="Client people" note="Who speaks for the Client. Only their word, or their email, counts as the Client's.">
        <ul className="mb-3 space-y-1">{people.map(item => (<li key={item.id} className="flex items-center gap-3">{item.name} ({item.email})
          <form action={removePerson.bind(null, id, item.id)}><button className="text-sm underline">Remove</button></form></li>))}</ul>
        <form action={addPerson.bind(null, id)} className="grid gap-2 sm:grid-cols-3">
          <input name="name" className={field} placeholder="Name" required /><input name="email" type="email" className={field} placeholder="Email" required />
          <button className={button}>Add</button>
        </form>
      </Section>
    </Frame>
  );
}
