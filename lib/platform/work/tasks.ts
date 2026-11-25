/**
 * Task and Queue (Work area; docs/glossary.md, docs/service-object-model.md).
 *
 * BEACON. Task is not yet a shared object (step 5). Until it is, an Account's open Tasks are
 * read from where the work actually waits today: the presence workflow's next step, and any
 * Proposed change waiting for someone's Review. Every Task says so in `beacon`, so it is never
 * mistaken for the real thing. The Queue is a view of open Tasks across Accounts.
 *
 * Pure: nothing here calls AI, WordPress or a database, and nothing is stored.
 */
import type { ChangeLedger, Consequence } from "../change/model";

export type Task = {
  id: string;
  account: string;
  /** Who must act: Core itself, a Specialist, or the Client. */
  who: "core" | "specialist" | "client";
  what: string;
  /** When the work began waiting. */
  since: string;
  beacon: string;
};

const beacon = "Beacon: read from the workflow's next step until Task is a shared object (step 5)";

/** What each workflow step asks of whom, in plain words. */
const steps: Record<string, { who: Task["who"]; what: string }> = {
  "evidence-changed": { who: "specialist", what: "The evidence changed since this work began: check it before continuing" },
  "understanding-review": { who: "client", what: "Review Core's understanding of the business" },
  "reassessment-ready": { who: "specialist", what: "Start the reassessment of the changed Knowledge" },
  recover: { who: "specialist", what: "A Core step failed: recover it" },
  "review-summary": { who: "specialist", what: "Answer the Review summary in WordPress" },
  "customer-review": { who: "client", what: "Confirm the Report" },
  "home-concept": { who: "specialist", what: "Review the Home concept" },
  "editorial-review": { who: "specialist", what: "Answer Core's editorial review" },
  "operator-review": { who: "specialist", what: "Review the site drafts in WordPress" },
};

/** Who reviews a Change at each Consequence level (routine Changes need no one). */
const reviewer: Record<Consequence, Task["who"] | null> = { routine: null, "operator-review": "specialist", "customer-approval": "client" };

/**
 * One Account's open Tasks. `view` is the presence workflow's view; `since` is when it last
 * changed (the workflow keeps no per-step time yet).
 */
export function accountTasks(account: string, view: { next: string; work?: { operation: string } | null; changes?: ChangeLedger },
  since: string): Task[] {
  const tasks: Task[] = [];
  const step = steps[view.next];
  if (step) tasks.push({ id: `${account}:${view.next}`, account, ...step, since, beacon });
  else if (view.next === "in-progress") tasks.push({ id: `${account}:in-progress`, account, who: "core",
    what: `Core is running: ${view.work?.operation ?? "a step"}`, since, beacon });
  else if (view.next !== "review-complete") tasks.push({ id: `${account}:${view.next}`, account, who: "core", what: `Core runs next: ${view.next}`, since, beacon });
  // Proposed changes outside an open Review summary wait for their reviewer directly.
  const summaryOpen = view.next === "review-summary";
  for (const change of view.changes?.changes ?? []) {
    const who = reviewer[change.consequence];
    if (change.status !== "proposed" || !who || (summaryOpen && who === "specialist")) continue;
    tasks.push({ id: `${account}:review:${change.id}`, account, who, what: `Review the Proposed change ${change.label}: ${change.difference.summary}`,
      since: change.at, beacon });
  }
  // Requests nobody has decided yet (for example, copy to revise after the Client declined a Fact).
  const coreAnswering = ["review-analysis", "in-progress", "review-summary"].includes(view.next);
  for (const request of view.changes?.requests ?? []) if (request.status === "open" && !coreAnswering)
    tasks.push({ id: `${account}:request:${request.id}`, account, who: "specialist", what: `Answer the Request: ${request.words}`, since: request.at, beacon });
  return tasks;
}

/** The Queue: open Tasks across Accounts, oldest first, optionally for one kind of person. */
export function queue(tasks: readonly Task[], who?: Task["who"]) {
  return tasks.filter(task => !who || task.who === who).toSorted((a, b) => a.since.localeCompare(b.since) || a.id.localeCompare(b.id));
}
