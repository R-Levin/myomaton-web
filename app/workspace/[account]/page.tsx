import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { clientPeople } from "@/lib/platform/accounts/people";
import { readMyBusiness } from "@/lib/platform/intake/my-business";
import { currentSite, tasks } from "@/lib/platform/service/cycle";
import { accounts, acting, serviceRuntime } from "@/lib/platform/service/runtime";
import { addPerson, askPublish, beginLaunch, checkRendered, directRequest, enterEmail, proposeFact, readBack, removePerson, adoptPageLayout, restorePage, review, runCore, sendDrafts, sendFindings, specialistRequest } from "../actions";
import { compareWords } from "@/lib/platform/service/page-words";
import type { PageContent, ProductVersion } from "@/lib/platform/service/cycle";
import { checkSummary, findingsForCore, lastRenderedCheck, type RenderedCheck } from "@/lib/platform/service/rendered-check";
import { Content, Frame, ReviewForm, Section, button, field, primary, productName } from "../ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Account", robots: { index: false, follow: false } };

/** One Account, for a Specialist: where it stands, what waits, its Work products, Knowledge and people. */
export default async function AccountPage({ params, searchParams }: { params: Promise<{ account: string }>; searchParams: Promise<{ problem?: string }> }) {
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
  const wordpress = runtime.wordpress ? (await runtime.wordpress()).origin : null;
  const delivered = record.deliveries?.at(-1);
  const { problem } = await searchParams;
  // The last rendered-page check of the current draft and of each proposed design.
  const checks = Object.fromEntries(await Promise.all(["current", ...proposed.filter(item => item.kind === "direction").map(item => item.changeId)]
    .map(async key => [key, await lastRenderedCheck(id, key)] as const))) as Record<string, RenderedCheck | null>;
  // What a Request can be about: the site as a whole, or one Work product.
  const targets = [{ value: "report", label: "The Business Understanding Report" }, { value: "direction", label: "The Presence Direction" },
    { value: "site-plan", label: "The Site plan" }, ...(site?.plan.pages ?? []).map(entry => ({ value: `page:${entry.path}`, label: `Page ${entry.label} (${entry.path})` }))];
  const toDirect = record.ledger.requests.filter(request => request.status === "open" && request.target.grain === "site" &&
    !record.ledger.changes.some(change => change.requestIds.includes(request.id)));
  const fromWordPress = record.ledger.requests.filter(request => request.origin.channel === "wordpress-note" || request.origin.channel === "hand-edit");
  return (
    <Frame title={found.name} who={person.name}>
      <p className="mb-6"><Link className="underline" href="/workspace">Back to the Queue</Link></p>
      {problem && <p role="alert" className="mb-6 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-900">Not done: {problem}</p>}

      <Section title="Where it stands" note={!started ? "Launch has not started." : site?.complete ? "Every page has an approved version." : "Launch is under way."}>
        <div className="flex flex-wrap gap-2">
          {!started && <form action={beginLaunch.bind(null, id)}><button className={primary}>Start Launch</button></form>}
          {waiting.some(task => task.who === "core") && (
            <form action={runCore.bind(null, id)}><button className={primary}>Let Core do its waiting work</button>
              <p className="mt-1 text-xs text-neutral-600">{runtime.spent ? `Writer: ${runtime.writerLabel}. Spent so far: $${(await runtime.spent()).toFixed(2)}.`
                : <>Locally Core&apos;s AI is a {runtime.writerLabel}; it writes labeled stand-in content.</>}</p></form>)}
          {site?.complete && !publishWaiting && waiting.length === 0 && <form action={askPublish.bind(null, id)}><button className={button}>Ask the Client to approve Publish</button></form>}
        </div>
        {runtime.spent && <p className="mt-2 text-sm text-neutral-700">{runtime.writerLabel}: ${(await runtime.spent()).toFixed(2)} spent so far.</p>}
        {waiting.length > 0 && <ul className="mt-3 space-y-1">{waiting.map(task => <li key={task.id}>{task.what} <span className="text-xs text-neutral-500">({task.who})</span></li>)}</ul>}
      </Section>

      {toDirect.length > 0 && (
        <Section title="Requests to direct" note="From the Client, about the site in general. Send each to Core on the Work product it concerns, or answer it.">
          {toDirect.map(request => (
            <article key={request.id} className="mb-4 rounded border border-neutral-200 p-4">
              <p className="text-xs uppercase text-neutral-500">{request.origin.channel === "email" ? `Email from ${request.origin.by.id}` : `From ${request.origin.by.id}`}, {request.at.slice(0, 10)}</p>
              <p className="my-2 whitespace-pre-wrap">{request.words}</p>
              <form action={directRequest.bind(null, id, request.id)} className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <select name="about" className="rounded border border-neutral-300 px-2 py-1.5 text-sm">{targets.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
                  <button name="how" value="send" className={primary}>Send to Core</button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input name="answer" className={field + " sm:w-2/3"} placeholder="Or: how you answered it, with no change" />
                  <button name="how" value="answer" className={button}>Answered, no change</button>
                </div>
              </form>
            </article>))}
        </Section>
      )}

      {proposed.length > 0 && (
        <Section title="Proposed changes" note="Each is a new version Core wrote. Read it in full, then approve, correct it in your own words, or decline. A correction of a words-only or layout-only change stays that kind.">
          {proposed.map(item => {
            const change = record.ledger.changes.find(entry => entry.id === item.changeId)!;
            const forClient = change.consequence === "customer-approval";
            return (
              <article key={item.changeId} className="mb-4 rounded border border-neutral-200 p-4">
                <h3 className="font-semibold">{productName(item)}, version {item.version}
                  {change.target.grain === "page-words" ? " (its words only)" : change.target.grain === "page-layout" ? " (its layout only)" : ""}</h3>
                {item.kind === "page" && <WordsCheck proposed={item} current={currentProducts.find(entry => entry.id === item.id)} />}
                <Content item={item} />
                {item.kind === "direction" && wordpress && delivered && <CheckPanel check={checks[item.changeId] ?? null}
                  run={checkRendered.bind(null, id, item.changeId)} send={sendFindings.bind(null, id, item.changeId)}
                  runLabel="Check this design on the rendered pages" sendLabel="Send the findings to Core (correct it)" />}
                {forClient ? <p className="mt-3 text-sm text-neutral-600">This one is the Client&apos;s to approve, in their portal.</p>
                  : <ReviewForm action={review.bind(null, id, item.changeId)} />}
              </article>
            );
          })}
        </Section>
      )}
      {record.publications?.length && !publishWaiting ? <Section title="Publish" note={`The Client approved publishing on ${record.publications.at(-1)!.at.slice(0, 10)}.`}>
        <p>Approved, not public yet: public delivery is milestone 5 of the rebuild.</p></Section> : null}
      {publishWaiting && <Section title="Publish" note="Waiting for the Client's approval in their portal."><p>{publishWaiting.difference.summary}</p></Section>}

      {!wordpress && <Section title="WordPress" note="This preview has no WordPress yet (it needs a local MySQL). Delivery itself is tested on the plugin's own code." >{null}</Section>}
      {wordpress && (
        <Section title="WordPress" note={delivered ? `Review draft ${delivered.revision} sent ${delivered.at.slice(0, 16).replace("T", " ")} UTC. Drafts are private until a Publish is approved.`
          : "Nothing sent yet. Drafts go once every page has an approved version."}>
          <div className="flex flex-wrap items-center gap-2">
            {site?.complete && <form action={sendDrafts.bind(null, id)}><button className={primary}>{delivered ? "Send the latest drafts" : "Send drafts to WordPress"}</button></form>}
            {delivered && <form action={readBack.bind(null, id)}><button className={button}>Read back Notes and edits</button></form>}
            <a className="underline" href={`${wordpress}/wp-admin/edit.php?post_type=page`} target="_blank" rel="noreferrer">Open WordPress</a>
          </div>
          {delivered && <CheckPanel check={checks.current ?? null} run={checkRendered.bind(null, id, null)} send={sendFindings.bind(null, id, null)}
            runLabel="Check the rendered draft against the design rules" sendLabel="Ask Core to fix these" />}
          {fromWordPress.length > 0 && <ul className="mt-3 list-disc space-y-1 pl-6">{fromWordPress.map(request => (
            <li key={request.id}>{request.target.path}: {request.words.slice(0, 200)} <span className="text-xs text-neutral-500">
              ({request.origin.channel === "hand-edit" ? "hand edit" : "Note"}, {request.status === "open" ? "Core to work in" : "worked in"})</span></li>))}</ul>}
        </Section>
      )}

      <Section title="Work products" note="The current approved version of each.">
        {currentProducts.length ? currentProducts.map(item => (
          <details key={item.changeId} className="mb-2 rounded border border-neutral-200 p-3"><summary className="cursor-pointer font-medium">{productName(item)}, version {item.version}</summary>
            <div className="mt-2"><Content item={item} /></div>
            {item.kind === "page" && <EarlierVersions item={item} versions={record.products.filter(entry => entry.id === item.id && entry.version !== item.version)}
              restore={version => restorePage.bind(null, id, item.path!, version)} adopt={version => adoptPageLayout.bind(null, id, item.path!, version)} />}</details>)) : <p className="text-neutral-600">None yet.</p>}
      </Section>

      <Section title="Ask Core for a change" note="Your own request as Specialist, on a Work product. Core reworks it and the new version comes back for review.">
        <form action={specialistRequest.bind(null, id)} className="space-y-2">
          <textarea name="words" rows={4} className={field} placeholder="What Core should change, in your words" required />
          <div className="flex flex-wrap items-center gap-2">
            <select name="about" className="rounded border border-neutral-300 px-2 py-1.5 text-sm">{targets.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
            <select name="grain" aria-label="For a page, what changes" className="rounded border border-neutral-300 px-2 py-1.5 text-sm">
              <option value="page">For a page: the whole page</option>
              <option value="page-words">For a page: only its words (the layout stays)</option>
              <option value="page-layout">For a page: only its layout (every word stays)</option></select>
            <input name="example" type="number" min={1} className="w-48 rounded border border-neutral-300 px-2 py-1.5 text-sm" aria-label="Layout: follow version"
              placeholder="Layout: follow version (optional)" />
            <button className={button}>Ask Core</button>
          </div>
        </form>
      </Section>

      <Section title="Client email" note="Enter an email the Client sent (until Core receives email itself). It counts as the Client's word only from someone on the Client people list.">
        <form action={enterEmail.bind(null, id)} className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <select name="from" className="rounded border border-neutral-300 px-2 py-1.5 text-sm">{people.map(item => <option key={item.id} value={item.email}>{item.name} ({item.email})</option>)}</select>
            <input name="received" type="datetime-local" className={field} aria-label="Received" />
          </div>
          <input name="subject" className={field} placeholder="Subject" />
          <textarea name="body" rows={4} className={field} placeholder="The email's text, as the Client wrote it" required />
          <div className="flex flex-wrap items-center gap-2">
            <select name="about" className="rounded border border-neutral-300 px-2 py-1.5 text-sm">
              <option value="site">About the site in general (direct it later)</option>{targets.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
            <button className={button}>Enter the email</button>
          </div>
        </form>
      </Section>

      <Section title="Knowledge" note={`${business.facts.length} confirmed items; ${business.proposed.length} waiting for the Client.`}>
        {business.proposed.length > 0 && <ul className="mb-3 list-disc pl-6">{business.proposed.map(item => <li key={item.id}>{item.value} <span className="text-xs text-amber-700">Proposed, from {item.from}</span></li>)}</ul>}
        <form action={proposeFact.bind(null, id)} className="space-y-2">
          <input name="statement" className={field} placeholder="A fact you learned about the business" />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="publicUse" defaultChecked /> May appear on the website</label>
          <button className={button}>Add as a Proposed fact</button>
        </form>
      </Section>

      <Section title="Evidence" note={record.evidence?.length ? `${record.evidence.length} items Core reads with the Knowledge; later direction overrides earlier.` : "None yet."}>
        {record.evidence?.length ? <ul className="list-disc space-y-1 pl-6 text-sm">{record.evidence.map(item => (
          <li key={item.id}>{item.label} <span className="text-xs text-neutral-500">({item.date ?? "undated"}{item.standing === "client" ? ", the Client's own" : ", gathered"}
            {item.forWebsite ? "" : ", not for the website"})</span></li>))}</ul> : null}
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

/** The last rendered-page check, with a button to run it again and one to send its findings to Core. */
function CheckPanel({ check, run, send, runLabel, sendLabel }: { check: RenderedCheck | null; run: () => Promise<void>; send: () => Promise<void>; runLabel: string; sendLabel: string }) {
  return (
    <div className="mt-3 rounded border border-neutral-200 p-3 text-sm">
      {check ? <p><span className="font-medium">{checkSummary(check)}</span> <span className="text-neutral-500">(checked {check.at.slice(0, 16).replace("T", " ")} UTC)</span></p>
        : <p className="text-neutral-600">Not checked yet. The check opens every page on desktop and phone and takes a few minutes.</p>}
      {check && check.findings.length > 0 && <details className="mt-2"><summary className="cursor-pointer">What Core would be told</summary>
        <p className="mt-2 whitespace-pre-wrap text-xs">{findingsForCore(check)}</p></details>}
      <div className="mt-2 flex flex-wrap gap-2">
        <form action={run}><button className={button}>{runLabel}</button></form>
        {check && check.findings.length > 0 && <form action={send}><button className={primary}>{sendLabel}</button></form>}
      </div>
    </div>
  );
}

/** Whether a proposed page keeps the approved words, line by line, so no one has to take it on trust (task 1a). */
function WordsCheck({ proposed, current }: { proposed: ProductVersion; current?: ProductVersion }) {
  if (!current) return null;
  const diff = compareWords(current.content as PageContent, proposed.content as PageContent);
  if (diff.unchanged) return <p className="my-2 text-sm font-medium text-green-800">Words unchanged from the approved version {current.version}.</p>;
  return (
    <details className="my-2 rounded border border-amber-300 bg-amber-50 p-2 text-sm">
      <summary className="cursor-pointer font-medium text-amber-900">Words changed from the approved version {current.version}: {lines(diff.gone.length)} gone or reworded, {diff.added.length} new</summary>
      <ul className="mt-2 space-y-1">{diff.gone.map((line, n) => <li key={"g" + n} className="text-red-800">− {line}</li>)}
        {diff.added.map((line, n) => <li key={"a" + n} className="text-green-800">+ {line}</li>)}</ul>
    </details>);
}

/** Every earlier version of a page is kept; a Specialist can make one current again (going back, no AI). */
function EarlierVersions({ item, versions, restore, adopt }: { item: ProductVersion; versions: ProductVersion[]; restore: (version: number) => () => Promise<void>;
  adopt: (version: number) => () => Promise<void> }) {
  if (!versions.length) return null;
  return (
    <div className="mt-3 border-t border-neutral-200 pt-2 text-sm">
      <p className="font-medium">Earlier versions</p>
      <ul className="mt-1 space-y-1">{[...versions].sort((a, b) => b.version - a.version).map(entry => {
        const diff = compareWords(item.content as PageContent, entry.content as PageContent);
        return (<li key={entry.changeId} className="flex flex-wrap items-center gap-2">
          <span>Version {entry.version}, {entry.at.slice(0, 16).replace("T", " ")} UTC, {entry.status}; {diff.unchanged ? "same words" : `${lines(diff.gone.length + diff.added.length)} differ`}</span>
          <form action={restore(entry.version)}><button className="rounded border border-neutral-300 px-2 py-0.5 text-xs">Make it current again</button></form>
          {!diff.unchanged && <form action={adopt(entry.version)}><button className="rounded border border-neutral-300 px-2 py-0.5 text-xs">Use its layout with the current words</button></form>}</li>);
      })}</ul>
    </div>);
}

const lines = (n: number) => `${n} line${n === 1 ? "" : "s"}`;
