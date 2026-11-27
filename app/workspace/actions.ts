"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { addClientPerson, clientAddresses, removeClientPerson } from "@/lib/platform/accounts/people";
import { accountKnowledge } from "@/lib/platform/knowledge/account";
import { factKey } from "@/lib/platform/knowledge/facts";
import { confirmOnPublish, factsToConfirmOnPublish } from "@/lib/platform/knowledge/publish";
import { currentFacts, recordFacts } from "@/lib/platform/knowledge/store";
import { ask, citedBySite, direct, proposePublish, respond, startLaunch, tasks, work, type Kind, type ServiceRecord } from "@/lib/platform/service/cycle";
import { deliverDraft, takeInReadBack } from "@/lib/platform/service/delivery";
import { readBackOperatorSite } from "@/lib/platform/wordpress-delivery/operator-review";
import { findingsForCore, lastRenderedCheck, runRenderedCheck } from "@/lib/platform/service/rendered-check";
import { accounts, actAs, acting, serviceRuntime, type Acting } from "@/lib/platform/service/runtime";

/**
 * The workspace's and portal's actions. Each one checks, on the server, that the preview is
 * running and who is acting, then makes exactly one change through the engine.
 */
async function context(webPresenceId: string, need: "specialist" | "client") {
  const runtime = await serviceRuntime();
  const person = await acting();
  if (!runtime || !person) throw Error("Not available");
  const account = (await accounts(runtime.pool)).find(item => item.account.webPresenceId === webPresenceId)?.account;
  if (!account) throw Error("No such Account");
  if (need === "specialist" && person.role !== "operator") throw Error("Only a Specialist may do this");
  if (need === "client" && (person.role !== "customer" || !(await clientAddresses(runtime.pool, account.webPresenceId)).includes(person.id)))
    throw Error("Only someone who speaks for the Client may do this");
  return { ...runtime, person, account };
}
const now = () => new Date().toISOString();
const text = (form: FormData, name: string) => String(form.get(name) ?? "").trim();
/**
 * Run a Specialist's action; if it is refused, come back to the Account page saying why, in
 * plain words, instead of failing the page.
 */
async function shown(webPresenceId: string, run: () => Promise<void>) {
  let problem: string | null = null;
  try { await run(); } catch (error) { problem = error instanceof Error ? error.message : "That did not work"; }
  if (problem) redirect(`/workspace/${webPresenceId}?problem=${encodeURIComponent(problem.slice(0, 300))}`);
}
const refresh = (webPresenceId: string) => { revalidatePath("/workspace"); revalidatePath(`/workspace/${webPresenceId}`); revalidatePath(`/portal/${webPresenceId}`); };

async function change(webPresenceId: string, need: "specialist" | "client", apply: (record: ServiceRecord, ctx: Awaited<ReturnType<typeof context>>) => ServiceRecord | Promise<ServiceRecord>) {
  const ctx = await context(webPresenceId, need);
  const read = await ctx.store.read(ctx.account);
  const saved = await ctx.store.save(read, await apply(read, ctx));
  refresh(webPresenceId);
  return { ...ctx, saved };
}

export async function signIn(form: FormData) {
  const runtime = await serviceRuntime();
  if (!runtime) throw Error("Not available");
  const choice = text(form, "person");
  const people: Acting[] = [{ id: "specialist", role: "operator", name: "Specialist (preview)" }];
  for (const { account } of await accounts(runtime.pool))
    for (const email of await clientAddresses(runtime.pool, account.webPresenceId)) people.push({ id: email, role: "customer", name: email });
  const person = people.find(item => `${item.role}:${item.id}` === choice);
  if (!person) throw Error("Choose who you are");
  await actAs(person);
  redirect(person.role === "operator" ? "/workspace" : "/portal");
}
export async function signOut() { await actAs(null); redirect("/workspace"); }

export async function beginLaunch(webPresenceId: string) {
  await change(webPresenceId, "specialist", (record, ctx) => startLaunch(record, now(), ctx.person));
}

/** Run Core's waiting work with the configured writer (locally, the labeled Beacon). */
export async function runCore(webPresenceId: string) { await shown(webPresenceId, async () => {
  const ctx = await context(webPresenceId, "specialist");
  const known = await accountKnowledge(ctx.pool, ctx.account.webPresenceId);
  const knowledge = [...known.items, ...known.offerings];
  try {
    for (const task of tasks(await ctx.store.read(ctx.account)).filter(item => item.who === "core")) {
      const read = await ctx.store.read(ctx.account);
      await ctx.store.save(read, await work(read, task, ctx.writer, knowledge, now()));
    }
  } catch (error) {
    throw Error("Core's answer was not accepted: " + (error instanceof Error ? error.message : "it failed"));
  } finally { refresh(webPresenceId); }
}); }

/** A person's Review of a Proposed change, from the workspace or the portal. */
export async function review(webPresenceId: string, changeId: string, form: FormData) {
  const person = await acting();
  const response = text(form, "response") as "approve" | "correct" | "decline";
  if (!["approve", "correct", "decline"].includes(response)) throw Error("Choose a response");
  const words = text(form, "words");
  if (response === "correct" && !words) throw Error("Say what should change");
  const { saved, pool, account } = await change(webPresenceId, person?.role === "customer" ? "client" : "specialist",
    (record, ctx) => respond(record, changeId, ctx.person, response, now(), words || undefined));
  // Approving a Publish is the Client's word on the Proposed facts it listed.
  const publication = saved.publications?.findLast(item => item.changeId === changeId);
  if (publication && person) {
    const db = await pool.connect();
    try { await db.query("BEGIN"); await confirmOnPublish(db, account, publication, person); await db.query("COMMIT"); }
    catch (error) { await db.query("ROLLBACK"); throw error; } finally { db.release(); }
  }
}

export async function askPublish(webPresenceId: string) {
  const ctx = await context(webPresenceId, "specialist");
  const read = await ctx.store.read(ctx.account);
  const relies = await factsToConfirmOnPublish(ctx.pool, ctx.account.webPresenceId, citedBySite(read));
  await ctx.store.save(read, proposePublish(read, { at: now(), by: ctx.person, relies }));
  refresh(webPresenceId);
}

/** The Client answers a Proposed fact: confirm it, correct it in their own words, or say it is not true. */
export async function answerFact(webPresenceId: string, key: string, form: FormData) {
  const ctx = await context(webPresenceId, "client");
  const response = text(form, "response"), wording = text(form, "words");
  const fact = (await currentFacts(ctx.pool, ctx.account.webPresenceId)).find(item => item.key === key && item.status === "proposed");
  if (!fact) throw Error("That fact is no longer waiting for you");
  if (response === "correct" && !wording) throw Error("Give the right wording");
  const record = `portal:${key}:${now()}`;
  const db = await ctx.pool.connect();
  try {
    await db.query("BEGIN");
    const said = { kind: "client" as const, person: ctx.person.id, record };
    if (response === "decline") await recordFacts(db, ctx.account, [], ctx.person.id, now(), "The Client said this is not true", [fact.key]);
    else await recordFacts(db, ctx.account, [{ key: fact.key, statement: response === "correct" ? wording : fact.statement,
      publicUse: fact.publicUse, source: fact.source, enteredBy: ctx.person.id, said }], ctx.person.id, now(), "The Client's answer in the portal");
    await db.query("COMMIT");
  } catch (error) { await db.query("ROLLBACK"); throw error; } finally { db.release(); }
  refresh(webPresenceId);
}

/** A Specialist records a fact they learned: it is Proposed until the Client confirms it. */
export async function proposeFact(webPresenceId: string, form: FormData) {
  const ctx = await context(webPresenceId, "specialist");
  const statement = text(form, "statement");
  if (!statement) throw Error("Write the fact");
  const db = await ctx.pool.connect();
  try {
    await db.query("BEGIN");
    await recordFacts(db, ctx.account, [{ key: factKey("specialist", Date.now().toString(36)), statement,
      publicUse: form.get("publicUse") === "on", source: "workspace", enteredBy: ctx.person.id, said: { kind: "specialist", person: ctx.person.id } }],
      ctx.person.id, now(), "A Specialist's fact");
    await db.query("COMMIT");
  } catch (error) { await db.query("ROLLBACK"); throw error; } finally { db.release(); }
  refresh(webPresenceId);
}

export async function addPerson(webPresenceId: string, form: FormData) {
  const ctx = await context(webPresenceId, "specialist");
  await addClientPerson(ctx.pool, ctx.account.webPresenceId, { name: text(form, "name"), email: text(form, "email") },
    { operatorId: ctx.person.id, authorityReference: "Local preview" }, text(form, "reason") || "Speaks for the business");
  refresh(webPresenceId);
}
export async function removePerson(webPresenceId: string, personId: string) {
  const ctx = await context(webPresenceId, "specialist");
  await removeClientPerson(ctx.pool, ctx.account.webPresenceId, personId, { operatorId: ctx.person.id, authorityReference: "Local preview" }, "No longer speaks for the business");
  refresh(webPresenceId);
}

/** Send the current site to the Account's WordPress as review drafts. */
export async function sendDrafts(webPresenceId: string) { await shown(webPresenceId, async () => {
  const ctx = await context(webPresenceId, "specialist");
  if (!ctx.wordpress) throw Error("No WordPress is connected");
  const read = await ctx.store.read(ctx.account);
  // Each WordPress site has its own delivery history: the next draft follows the last one sent to this site.
  const config = await ctx.wordpress();
  const previous = read.deliveries?.filter(item => item.installationId === config.installationId && item.streamId === config.streamId).at(-1) ?? null;
  const { delivery } = await deliverDraft({ config, record: read, previous });
  await ctx.store.save(read, { ...read, deliveries: [...read.deliveries ?? [], delivery] });
  refresh(webPresenceId);
}); }

/** Bring WordPress Notes and hand edits home: each becomes a Request on its page. */
export async function readBack(webPresenceId: string) { await shown(webPresenceId, async () => {
  const ctx = await context(webPresenceId, "specialist");
  if (!ctx.wordpress) throw Error("No WordPress is connected");
  const { readback } = await readBackOperatorSite(await ctx.wordpress());
  const read = await ctx.store.read(ctx.account);
  await ctx.store.save(read, takeInReadBack(read, readback, { id: ctx.person.id, role: "operator" }, now()));
  refresh(webPresenceId);
}); }

/** What a Request is about, from a form's "about" choice: "site", or a Work product kind with its page path. */
function about(value: string): { kind: Kind | "site"; path?: string } {
  const [kind, path] = value.split(":", 2) as [string, string | undefined];
  if (!["site", "report", "direction", "site-plan", "page"].includes(kind) || (kind === "page") !== Boolean(path)) throw Error("Choose what it is about");
  return { kind: kind as Kind | "site", ...(path && { path }) };
}

/** A Specialist asks Core for a change to a Work product in their own words: a Request from the Specialist. */
export async function specialistRequest(webPresenceId: string, form: FormData) { await shown(webPresenceId, async () => {
  const words = text(form, "words");
  if (!words) throw Error("Say what Core should change");
  await change(webPresenceId, "specialist", (record, ctx) => {
    const at = now();
    return ask(record, { id: `specialist:${ctx.person.id}:${at}`, at, by: ctx.person, ...about(text(form, "about")), words: words.slice(0, 20_000) });
  });
}); }

/**
 * A Specialist enters an email from the Client (until the email service is connected). It counts
 * as the Client's Request only when the sender is on the Account's list of Client people.
 */
export async function enterEmail(webPresenceId: string, form: FormData) { await shown(webPresenceId, async () => {
  const from = text(form, "from").toLowerCase(), subject = text(form, "subject"), body = text(form, "body"), received = text(form, "received");
  if (!body) throw Error("Paste the email's text");
  await change(webPresenceId, "specialist", async (record, ctx) => {
    if (!(await clientAddresses(ctx.pool, ctx.account.webPresenceId)).includes(from))
      throw Error(`${from || "That sender"} is not on this Account's Client people, so the email cannot count as the Client's word. Add them first if they speak for the Client.`);
    const when = received ? new Date(received).toISOString() : now();
    return ask(record, { id: `email:${from}:${when}`, at: now(), by: { id: from, role: "customer" }, enteredBy: ctx.person, ...about(text(form, "about")),
      words: (subject ? `${subject}\n\n` : "") + body.slice(0, 20_000), channel: "email", channelRef: `${from} ${when}${subject ? " " + subject : ""}` });
  });
}); }

/** A Specialist directs a Request on the site as a whole: to Core on one Work product, or answered with no change. */
export async function directRequest(webPresenceId: string, requestId: string, form: FormData) { await shown(webPresenceId, async () => {
  const answer = text(form, "answer");
  await change(webPresenceId, "specialist", (record, ctx) => {
    const to = form.get("how") === "answer" ? { answer } : about(text(form, "about"));
    if ("kind" in to && to.kind === "site") throw Error("Choose which Work product it is about");
    return direct(record, requestId, ctx.person, now(), to as Parameters<typeof direct>[4]);
  });
}); }

/**
 * The Client's Review of a proposed Report, finding by finding. What they write about a finding is
 * their own word about the business, so it goes into Knowledge as Confirmed: it replaces the fact
 * the finding rests on when there is exactly one, and is added otherwise. Any correction also asks
 * Core to rework the Report, in the Client's words.
 */
export async function answerReport(webPresenceId: string, changeId: string, form: FormData) {
  const ctx = await context(webPresenceId, "client");
  const response = text(form, "response") as "approve" | "correct" | "decline";
  if (!["approve", "correct", "decline"].includes(response)) throw Error("Choose a response");
  const read = await ctx.store.read(ctx.account);
  const proposed = read.products.find(item => item.changeId === changeId && item.kind === "report" && item.status === "proposed");
  if (!proposed) throw Error("That Report is no longer waiting for you");
  const findings = (proposed.content as { findings: { id: string; heading: string; sourceIds?: string[] }[] }).findings;
  const said = findings.map(finding => ({ finding, words: text(form, "finding:" + finding.id) })).filter(item => item.words);
  const general = text(form, "words");
  if (response === "approve" && said.length) throw Error("You corrected a finding: send it as a correction");
  if (response === "correct" && !said.length && !general) throw Error("Say what should change");
  const at = now();
  if (response === "correct" && said.length) {
    const known = (await accountKnowledge(ctx.pool, ctx.account.webPresenceId)).items;
    const db = await ctx.pool.connect();
    try {
      await db.query("BEGIN");
      await recordFacts(db, ctx.account, said.map(({ finding, words }, index) => {
        const cited = (finding.sourceIds ?? []).filter(id => id.startsWith("knowledge:")).map(id => known.find(item => "knowledge:" + item.key === id)).filter(Boolean);
        const replaces = cited.length === 1 ? cited[0]! : null;
        return { key: replaces?.key ?? factKey("report", `${Date.now().toString(36)}${index}`), statement: words.slice(0, 2000),
          publicUse: replaces?.forWebsite ?? true, source: `Report ${proposed.version}, ${finding.heading}`, enteredBy: ctx.person.id,
          said: { kind: "client" as const, person: ctx.person.id, record: `report:${changeId}:${finding.id}` } };
      }), ctx.person.id, at, "The Client's correction of the Report");
      await db.query("COMMIT");
    } catch (error) { await db.query("ROLLBACK"); throw error; } finally { db.release(); }
  }
  const words = [...said.map(({ finding, words }) => `${finding.heading}: ${words}`), ...general ? [general] : []].join("\n");
  await ctx.store.save(read, respond(read, changeId, ctx.person, response, at, words || undefined));
  refresh(webPresenceId);
}

/**
 * A Specialist checks the rendered draft against the design rules: the current one, or a design
 * Core has proposed (shown on the real pages before anyone approves it). The result is kept for
 * the Account page; it changes nothing by itself.
 */
export async function checkRendered(webPresenceId: string, changeId: string | null) { await shown(webPresenceId, async () => {
  const ctx = await context(webPresenceId, "specialist");
  const configFile = process.env.MIOPAGES_PREVIEW_WORDPRESS;
  if (!ctx.wordpress || !configFile) throw Error("No WordPress is connected");
  const read = await ctx.store.read(ctx.account);
  if (!read.deliveries?.length) throw Error("Send the drafts to WordPress first");
  const proposal = changeId ? read.products.find(item => item.changeId === changeId && item.status === "proposed") : undefined;
  if (changeId && !proposal) throw Error("That proposal is no longer waiting");
  const stylesheet = proposal ? (proposal.content as { design?: { stylesheet?: string } }).design?.stylesheet : undefined;
  if (proposal && (proposal.kind !== "direction" || !stylesheet)) throw Error("Only a proposed design can be checked on the pages");
  await runRenderedCheck({ webPresenceId, key: changeId ?? "current", configFile, stylesheet,
    subject: proposal ? `your proposed design (Direction version ${proposal.version})` : "the current draft" });
  refresh(webPresenceId);
}); }

/** Send a check's findings to Core: as the correction of the proposal it checked, or as a Request on the Direction. */
export async function sendFindings(webPresenceId: string, changeId: string | null) { await shown(webPresenceId, async () => {
  const check = await lastRenderedCheck(webPresenceId, changeId ?? "current");
  if (!check?.findings.length) throw Error("There are no findings to send");
  const words = findingsForCore(check);
  await change(webPresenceId, "specialist", (record, ctx) => {
    const at = now();
    return changeId ? respond(record, changeId, ctx.person, "correct", at, words)
      : ask(record, { id: `specialist:${ctx.person.id}:${at}`, at, by: ctx.person, kind: "direction", words });
  });
}); }
