"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { addClientPerson, clientAddresses, removeClientPerson } from "@/lib/platform/accounts/people";
import { accountKnowledge } from "@/lib/platform/knowledge/account";
import { factKey } from "@/lib/platform/knowledge/facts";
import { confirmOnPublish, factsToConfirmOnPublish } from "@/lib/platform/knowledge/publish";
import { currentFacts, recordFacts } from "@/lib/platform/knowledge/store";
import { citedBySite, proposePublish, respond, startLaunch, tasks, work, type ServiceRecord } from "@/lib/platform/service/cycle";
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

/** Run Core's waiting work with the configured writer (locally, the labelled Beacon). */
export async function runCore(webPresenceId: string) {
  const ctx = await context(webPresenceId, "specialist");
  const known = await accountKnowledge(ctx.pool, ctx.account.webPresenceId);
  const knowledge = [...known.items, ...known.offerings];
  for (const task of tasks(await ctx.store.read(ctx.account)).filter(item => item.who === "core")) {
    const read = await ctx.store.read(ctx.account);
    await ctx.store.save(read, await work(read, task, ctx.writer, knowledge, now()));
  }
  refresh(webPresenceId);
}

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
