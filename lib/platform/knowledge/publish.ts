import type { Pool, PoolClient } from "pg";
import type { Person } from "../change/model";
import type { Publication } from "../service/cycle";
import { currentFacts, recordFacts } from "./store";

/**
 * The Proposed facts a Publish relies on: Facts the site's pages cite that the Client has not yet
 * confirmed and that are for the website. The Client confirms them, at the latest, by approving
 * the Publish (Principal, Nov 24).
 */
export async function factsToConfirmOnPublish(db: Pick<Pool, "query">, webPresenceId: string, cited: ReadonlySet<string>) {
  return (await currentFacts(db, webPresenceId)).filter(fact => fact.status === "proposed" && fact.publicUse && cited.has("knowledge:" + fact.key))
    .map(fact => ({ key: fact.key, statement: fact.statement }));
}

/** Approving the Publish is the Client's word on those facts: each becomes Confirmed, with the approval as its record. */
export async function confirmOnPublish(db: PoolClient, scope: { webPresenceId: string; managedSiteId: string }, publication: Publication, client: Person) {
  if (client.role !== "customer" && client.role !== "owner") throw Error("Only the Client confirms facts by approving a Publish");
  const facts = await currentFacts(db, scope.webPresenceId);
  const confirmed = publication.confirms.map(item => facts.find(fact => fact.key === item.key && fact.statement === item.statement))
    .filter((fact): fact is NonNullable<typeof fact> => Boolean(fact) && fact!.status === "proposed");
  if (!confirmed.length) return null;
  return recordFacts(db, scope, confirmed.map(fact => ({ key: fact.key, statement: fact.statement, publicUse: fact.publicUse, source: fact.source,
    enteredBy: fact.said.kind === "client" ? fact.said.person : "person" in fact.said ? fact.said.person : "core", said: { kind: "client" as const, person: client.id, record: publication.changeId } })), client.id, publication.at,
    `Confirmed by the Client in approving Publish ${publication.changeId}`);
}
