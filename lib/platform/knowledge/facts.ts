/**
 * Facts in the one Knowledge (Knowledge area; docs/glossary.md, docs/service-object-model.md
 * step 3). A Fact lives as an entry of kind "fact" in the Account's canonical Knowledge record,
 * the same record My Business shows. Nothing keeps its own copy.
 *
 * The standing rule (Principal, Nov 24; Baseline Part 1 #6): the Client is the authority on
 * their own business.
 * - A Fact is Confirmed only on the Client's word, with the record to show it: a Client email
 *   kept as Evidence and entered by a Specialist counts, because the Client introduced it.
 * - Anything a Specialist or Core introduces is Proposed. Core may use it in drafts; the
 *   Client confirms it, at the latest when approving Publish.
 * - The Principal, as Account Manager, may override. That is recorded as an override, never as
 *   the Client's confirmation.
 *
 * Pure: building and reading entries only. Writing is `store.ts`.
 */
import type { Evidence, Knowledge } from "../canonical/model";

/** Who said it: this, not who typed it in, decides a Fact's standing. */
export type SaidBy =
  /** The Client's own word, and where it is on record (for example "client-email:<id>"). */
  | { kind: "client"; person: string; record: string }
  | { kind: "specialist"; person: string }
  | { kind: "core" }
  /** The Principal as Account Manager, with the reason. */
  | { kind: "override"; person: string; reason: string };

export type FactStatus = "confirmed" | "proposed";

export type Fact = {
  /** Stable key within the Account's Knowledge, such as "fact-1a2b3c4d-f1". */
  key: string;
  statement: string;
  /** Whether the website may use it (otherwise it informs Core's understanding only). */
  publicUse: boolean;
  said: SaidBy;
  /** Where it came from, such as "review round 1a2b…, F1" or "Client email 5c6d…". */
  source: string;
  /** The person who entered it into Core. */
  enteredBy: string;
};

/** The standing rule. */
export function statusOf(said: SaidBy): FactStatus {
  if (said.kind === "client") return said.person.trim() && said.record.trim() ? "confirmed" : "proposed";
  if (said.kind === "override") return said.person.trim() && said.reason.trim() ? "confirmed" : "proposed";
  return "proposed";
}

export const factKey = (scope: string, label: string) => {
  const key = ("fact-" + scope + "-" + label).toLowerCase().replace(/[^a-z0-9_-]+/gu, "-").slice(0, 64);
  if (!/^[a-z][a-z0-9_-]*$/u.test(key)) throw Error("Invalid Fact key");
  return key;
};

type Entry = Knowledge["entries"][number];
type Reference = { kind: "fact/1"; said: SaidBy; source: string; enteredBy: string };

/** The canonical Knowledge entry for a Fact. Its evidence records who said it and its status. */
export function factEntry(fact: Fact, at: string): Entry {
  const confirmed = statusOf(fact.said) === "confirmed";
  const reference = JSON.stringify({ kind: "fact/1", said: fact.said, source: fact.source, enteredBy: fact.enteredBy } satisfies Reference);
  if (reference.length > 1000) throw Error("Fact record too long");
  const evidence: Evidence = { sourceKind: fact.said.kind === "client" ? "customer" : "operator", sourceReference: reference,
    confirmation: confirmed ? "confirmed" : "provisional", visibility: fact.publicUse ? "public" : "internal",
    ...(confirmed && { confirmedBy: (fact.said as { person: string }).person, confirmedAt: at }) };
  return { key: fact.key, kind: "fact", value: fact.statement, evidence };
}

/** The Knowledge record with these Facts added, or replaced where the key exists. */
export function withFacts(knowledge: Knowledge | null, facts: readonly Fact[], approval: { by: string; at: string }): Knowledge {
  const entries = [...knowledge?.entries ?? []];
  for (const fact of facts) {
    const entry = factEntry(fact, approval.at), index = entries.findIndex(item => item.key === fact.key);
    if (index >= 0 && entries[index].kind !== "fact") throw Error("A Fact cannot replace other Knowledge");
    if (index >= 0) entries[index] = entry; else entries.push(entry);
  }
  return { entries, identityEvidence: knowledge?.identityEvidence ?? [],
    approval: { scope: knowledge?.approval.scope ?? "internal", by: approval.by, at: approval.at } };
}

/** The Knowledge record without these Facts (the Client said they are not true). History keeps them. */
export function withoutFacts(knowledge: Knowledge, keys: readonly string[], approval: { by: string; at: string }): Knowledge {
  for (const key of keys) if (knowledge.entries.find(entry => entry.key === key)?.kind !== "fact") throw Error("No such Fact");
  return { ...knowledge, entries: knowledge.entries.filter(entry => !keys.includes(entry.key)),
    approval: { scope: knowledge.approval.scope, by: approval.by, at: approval.at } };
}

export type KnownFact = { key: string; statement: string; publicUse: boolean; status: FactStatus; said: SaidBy; source: string; at?: string };

/** The Facts in a Knowledge record, with their standing. */
export function factsIn(knowledge: Knowledge): KnownFact[] {
  return knowledge.entries.filter(entry => entry.kind === "fact").map(entry => {
    let reference: Partial<Reference> = {};
    try { reference = JSON.parse(entry.evidence.sourceReference); } catch { /* not written by this module */ }
    return { key: entry.key, statement: entry.value, publicUse: entry.evidence.visibility === "public",
      status: entry.evidence.confirmation === "confirmed" ? "confirmed" : "proposed",
      said: reference.said ?? { kind: "core" }, source: reference.source ?? "", ...(entry.evidence.confirmedAt && { at: entry.evidence.confirmedAt }) };
  });
}

/** Whether a statement is the Client's own words in an email (so it may go in as Confirmed). */
export function quotedIn(statement: string, email: string) {
  const plain = (value: string) => value.toLowerCase().replace(/[‘’]/gu, "'").replace(/[^\p{L}\p{N}'%$£€]+/gu, " ").trim();
  const said = plain(statement);
  return said.length > 0 && (" " + plain(email) + " ").includes(" " + said + " ");
}
