/**
 * Observation (Measurement area; docs/glossary.md, docs/service-object-model.md).
 *
 * BEACON. First-party measurement does not yet feed the cycle (step 6). Until it does, each
 * Delivery is followed by a labelled stand-in Observation that says nothing has been measured,
 * so the cycle still closes at its exact place: the Observation raises a Request in the Change
 * area, and Core's Decision on it is "watch" (leave it, look again), which proposes no Change,
 * runs no AI and touches nothing.
 *
 * Pure and storage-free, like the Change area.
 */
import { decide, takeIn, type ChangeLedger, type Person } from "../change/model";

export type Observation = {
  id: string;
  account: string;
  at: string;
  /** The Delivered Version this Observation is about. */
  version: number;
  /** What was observed: Visitors, Leads, customers, later search data. */
  text: string;
  beacon?: string;
};

const core: Person = { id: "core", role: "core" };
const beacon = "Beacon: no first-party measurement feeds the cycle yet (step 6)";

/** The stand-in Observation after a Delivery, and the Request and "watch" Decision it raises. */
export function observeDelivery(ledger: ChangeLedger, delivery: { account: string; at: string; version: number }) {
  const id = `${delivery.account}:observation:${delivery.version}`;
  const observation: Observation = { id, account: delivery.account, at: delivery.at, version: delivery.version,
    text: "Nothing measured yet: no Visitors, Leads or customers are counted for this Version.", beacon };
  const requestId = `${id}:request`;
  let next = takeIn(ledger, { id, at: delivery.at, by: core }, [{ id: requestId, at: delivery.at,
    origin: { kind: "observation", by: core, channel: "measurement" }, target: { grain: "site" },
    words: `${observation.text} (${beacon})` }]);
  next = decide(next, { id: `${id}:watch`, at: delivery.at, by: core, requestIds: [requestId], outcome: "watch",
    reasoning: "Nothing to act on until there is real measurement; look again when it arrives." }, []);
  return { observation, ledger: next };
}
