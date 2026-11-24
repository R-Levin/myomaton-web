# MioPages service object model

**Status:** first draft for the owner's review, Nov 24 2026 (Claude). Nothing has been
moved in the code yet. Once the owner has shaped it, this document is the reference
every piece of work is checked against (Baseline Part 1, #20a). Names follow
`docs/glossary.md`; practices behind the design are in `docs/object-model-best-practices.md`.

## Why this exists

MioPages was branched from Myomaton with an explicit direction: the same underlying
components serve different tasks, and they are reused, never reinvented. Room navigation
and charger docking were the same machine pointed at different goals.

That direction was given early but never turned into structure. Each new task was
built as its own path. The result today:
- The AI site workflow keeps its own private copy of the world in a single case record:
  its own pages, its own business facts and about a dozen separate kinds of
  "something needs changing" (report corrections, understanding corrections, knowledge
  reassessments, source recovery, revision requests, replans, editorial findings and
  decisions, quality reviews, wider changes, review rounds with notes, fact notes and
  page notes).
- Meanwhile the canonical objects built in September and October (Knowledge, Offering,
  Page, Section, Asset, Action, Navigation, page proposals and approvals) sit beside it.
  They are only partly used.
- The `intake` folder holds 82 files covering everything from the interview to site
  generation, accounts and WordPress read-back. Several of them are C0-specific code.

The cause is not any one bad decision. Direction stated as a principle loses, in the
moment, to a concrete request ("let Operators add a page"). This document gives the
principle a shape that a concrete request can be checked against.

## The rule

1. The service is built from the shared objects below. Onboarding, site creation, review,
   knowledge correction, business change, Ongoing improvement and inquiry handling are
   **workflows composed from these objects**, not separate machines.
2. Before anything is built, the work says which objects it uses or extends. If it fits
   none, stop and discuss with the owner. A new object is a design decision.
3. An object is implemented once, in one place, with one name. Customer-specific
   material (C0) is data, never code.
4. Every interface (Core screens, a portal, WordPress, email) is a view over the same
   objects. An interface never owns its own copy of the truth.

## The objects

Grouped by what they are for. Each entry says what it is, what exists today and where
the duplicates are.

### What the service knows

**Account.** One business served by MioPages: its Web Presence, its people and their
roles, its commercial standing and its service stage (prospect, onboarding, Launch,
Ongoing).
- *Today:* Web Presence, activation case, customer binding and protected account,
  spread across `web-presences`, `activation` and `intake/protected-account*`.

**Knowledge.** What MioPages knows about the business: facts, offerings, audiences,
claims and preferences, each with its source, its status (confirmed, proposed,
observed, inferred, disputed, unknown) and its history. This is what the customer sees
and corrects as My Business (P0-14).
- *Today:* canonical Knowledge and Offering records with versions (`canonical`), plus
  My Business.
- *Duplicates:* the workflow's own `businessFacts` (facts learned from Operator edits),
  report corrections, understanding corrections and the facts inside review rounds. All
  of these should be changes to Knowledge.

**Evidence.** Material the service has gathered but which is not business truth: the
customer's own documents and answers, research findings, peer website observations
(text and visual), Free Review findings, and read-backs of what is on the site.
- *Today:* source material and original custody, research capture and cache, peer
  browser, Review evidence. These are reasonably separate but named differently in
  each place.

### What the service makes

**Work product.** Anything the service produces for the customer: the Business
Understanding Report, Presence Direction, the site plan, Pages, Sections, Assets
(images, FPO), Actions (buttons, forms), Navigation, Articles, design system, reports.
Each has a stable identity and versions.
- *Today:* canonical Page, Section, Asset, AssetUsage, Action, Navigation and design
  systems exist from September.
- *Duplicates:* the AI workflow keeps its own report, direction, blueprint and page list
  inside the case record, with its own page shape. These should be versions of the
  canonical objects.

### How anything changes: one cycle

This is the heart of it. Every change in the service, from writing the whole first site
to fixing one sentence to a metrics-led improvement, goes through the same six objects.
Only the **origin** and the **grain** differ.

**Request.** Someone or something wants a change or an answer. A Request records:
- its origin: the customer, an Operator, Core itself (a quality check), an
  Observation (a metric, an inquiry pattern), a business change ("something changed in
  my business") or the start of the service (onboarding, "create the site");
- what it is about: a piece of Knowledge, a Work product, or the account as a whole;
- in the requester's own words;
- its status.
- *Today:* about a dozen separate shapes, listed under "Why this exists", plus Free
  Review requests, Contact inquiries that lead to work, and the Ongoing recommendation.

**Decision.** The reasoning about a Request: the evidence used, what was inferred, what
to change, **what to leave alone** and why. It is made by Core's AI, an Operator, or
both. A Decision can also be "no change": maintain, or watch.
- *Today:* the decision brief (`presence-decision-brief.ts`), the report, the Direction,
  the review analysis, editorial critique and the account review. These are the same
  idea at different grains.

**Change.** The exact proposed difference to Knowledge or to a Work product. It records
which version it starts from, what it alters, what it must preserve, and how to undo it.
Its **grain** can be a fact, a section, a page, a new page, the navigation, the design,
or the whole site.
- *Today:* page proposals and revisions (`content-editing`), section revisions in review
  rounds, new pages in review rounds, knowledge reassessment, and releases. The
  shared-intelligence design names this "ChangeSet"; it was designed but never built.

**Review.** A person looks at a Change, or a Work product, and responds: approve,
decline, correct, add a note, or ask a question. A Review says who reviewed, in what
role, through which interface, and at what level of consequence. The customer approval,
Operator review and routine levels are set out in the change-management contract.
- *Today:* Operator review decisions, Review summary pages in WordPress, page-proposal
  approvals, report confirmation, quality reviews and owner home reviews.
- *Naming collision:* "Review" also means the **Free Review** prospect product. In code
  and screens, the Free Review should be called that every time.

**Delivery.** Putting an approved Change where it lives: WordPress drafts for review,
public WordPress, and later other platforms. It produces a receipt, supports rollback,
and **reads back** what is actually there, so hand edits come home as Evidence and
Requests.
- *Today:* the WordPress delivery stack (signed releases, native drafts, media, receipts,
  rollback, read-back). This is sound and already shared. There is also an older
  Next.js renderer. Hosting, adopted existing sites and exit or portability (P0-6) are
  properties of the Account's delivery targets, not separate machinery.

**Observation.** What happened afterwards: visits, inquiries and their outcomes,
read-back findings, and later search data. Observations feed new Requests, which closes
the loop. This is where Ongoing lives.
- *Today:* first-party measurement and Performance Snapshot (local), Contact submissions
  and outcomes, WordPress review observation. None of it is live yet.

### Who, when and at what cost

**Person and authority.** Who is acting (a customer, an Operator or the owner, or Core,
AI or a tool) and what they may do for which account. There is one definition.
- *Today:* separate Actor, Authority and Scope types in `content-editing`, `activation`,
  `intake` and `reviews`.

**Task.** Who must do what next, by when, with what inputs, and what came of it. Tasks
cover Core and AI jobs, Operator work, customer actions, retries and failures. This is
the "minimal orchestration unit" of P0-1, and how Operator work that stands in for future
automation stays visible and costed (P0-12).
- *Today:* the workflow's `work` and failure handling, plus Operator queue ideas in the
  overview console. There is no shared task list.

**Cost.** AI and provider spending, estimated before the work and recorded after it,
per account and per Task. Operator time belongs here too, so that it can be priced
(P0-12).
- *Today:* the grant, reservation and estimate logic inside the AI workflow.

## Every workflow is the same cycle

| Workflow | Request origin | Typical grain | Decision by | Review by | Delivered to |
|---|---|---|---|---|---|
| Onboarding and interview | Start of service | Knowledge, many facts | AI (questions), customer (answers) | Customer confirms | Knowledge |
| Report and Direction | Core, after research | Account | AI | Customer and Operator | Work product |
| First site creation | Core, after Direction | Whole site | AI | Operator, then customer | WordPress drafts |
| Review round (today's notes) | Operator or customer | Section, page, new page, fact | AI plus Operator | Operator | WordPress drafts |
| Knowledge correction (My Business) | Customer or Operator | Fact | Core works out the impact | Per consequence level | Knowledge, then affected pages |
| Business change | Customer ("something changed") | Fact, then affected pages | AI plus Operator | Customer and Operator | Knowledge, site |
| Ongoing improvement | Observation | Section, page, Article | AI plus Operator | Operator, customer if material | WordPress |
| Inquiry handling | Visitor via an Action | Account | Operator | n/a | Contact outcome (Observation) |
| Go live | Operator or owner | Whole site | Operator | Owner or customer | Public WordPress |

Seen this way, the "add a page" feature is not a feature. It is a Request whose grain is
"new page". It should have needed no new machinery beyond letting the Change object
carry that grain.

## Granular AI

Today one AI call reads every note in a round and returns everything at once. In the
model, each Request gets a Decision **scoped to its own target**:
- the AI sees the target, the Knowledge and Evidence that bear on it, and what must be
  preserved;
- it returns a Change at that grain.

Several Requests can still be batched for cost, but each answer is separate and can be
reviewed on its own. Whole-site creation is simply the largest grain of the same
operation, not a different machine. This is also what lets the same AI capabilities
(research, decision, writing, design, critique) serve onboarding, Launch and Ongoing,
as P0-21 asks.

## Interfaces are views

Because Requests, Reviews, Tasks and Knowledge are shared objects, the open question of
where customers and Operators work becomes answerable piece by piece:
- An Operator queue is a view of open Tasks and Requests across accounts.
- A customer's My Business is a view of Knowledge, with "correct" creating a Request.
- A Review summary is a view of pending Changes, with buttons that create Reviews.
- WordPress is two things:
  - a Delivery target;
  - an editing surface whose hand edits and notes come back through read-back as
    Evidence and Requests.

  Line notes then become one convenient way to raise a Request, not the management
  channel.

Whether a given view lives in Core, a portal or inside WordPress becomes a choice about
convenience. It does not change the service's design, so a hybrid costs nothing extra.

## Where the code stands against the model

| Object | Exists and sound | Duplicated or missing |
|---|---|---|
| Account | Web Presence, activation, protected account | Spread over three folders |
| Knowledge | Canonical Knowledge and Offering, My Business | Workflow businessFacts and corrections hold their own copies |
| Evidence | Source custody, research, peer capture | Named differently in each place |
| Work product | Canonical Page, Section, Asset, Action, Navigation | AI workflow keeps its own report, direction, blueprint and pages |
| Request | Change area (review rounds routed, Nov 24) | Other paths still keep about a dozen separate shapes |
| Decision | Decision brief, report, Direction | Each workflow has its own |
| Change | Change area with grain, base, conflicts (review rounds, Nov 24); page proposals, releases | Other paths not yet routed |
| Review | Change area Review (review rounds, Nov 24); several older approval records | Older records not yet routed |
| Delivery | WordPress stack, sound and shared | Older Next.js path |
| Observation | Measurement and Contact foundations | Not live; not feeding Requests |
| Person and authority | Several working versions | Four separate definitions |
| Task | Workflow work and retries | No shared task list |
| Cost | Grant and estimate logic | Lives inside the AI workflow only |

The good news: most objects already exist somewhere in sound form. The work is mainly to:
- **name** each object once;
- **move** it to one place;
- **route** the existing workflows through it;
- **build** the missing Request and Change pieces and the shared Task list.

## How to get there while the plane flies

Each step keeps the current system working on protected Core and miopages.org. Tests pass
at every step. Nothing hosted changes without the owner's approval.

From step 2 onward, the **whole cycle runs end to end** (Baseline #19). Every object that
isn't built yet appears as a clearly labelled placeholder at its exact place: Observation,
Task and the Operator queue at first. Each later step then replaces a placeholder with the
real object. The steps are an order of replacement, not a queue in which Ongoing waits
until the end.

1. **Agree the model** (this document, shaped by the owner). Fix names, including the
   Free Review collision.
2. **Request, Decision, Change and Review as real shared objects.** Route today's review
   rounds through them first, since that is the most recent and best-tested path. The
   held new-page work (fbe5bbc) is reworked as a Change grain rather than installed as
   it stands.

   *Progress, Nov 24 (local only, nothing hosted):* the Change area exists in
   `lib/platform/change/model.ts`, with Request, Decision, Change (grain, base Version,
   difference, preserved wording, Consequence level, dependencies), Review (Approve,
   Decline, Correct, Ask) and Round, plus conflict flagging, withdrawal and one timeline.
   Review rounds are routed through it (`lib/platform/intake/review-round-changes.ts`):
   each Note and hand edit is a Request, Core's analysis is a Decision with its Changes,
   the Operator's answers are Reviews, and **what is recorded, added or revised is now read
   from the Change ledger**. "Add a page" is a Change of the new-page grain. Rounds taken in
   on protected Core before this are read into the ledger when decided.
   Still to do in this step: draw the Review summary from the Changes rather than the round
   record, then remove the round's duplicate fields; and the labelled placeholders that
   let the whole cycle run end to end (Observation, Task, Operator queue).
3. **One Knowledge.** Operator-learned facts and report corrections become Changes to
   canonical Knowledge. My Business shows the same records Core uses.
4. **One set of Work products.** The AI workflow's pages and plan become versions of the
   canonical Page, Section, Navigation and Asset identities. Delivery already speaks
   their language.
5. **Task and Cost as shared objects.** Operator work becomes visible and costed, and the
   Operator queue becomes a view.
6. **Observation feeds Requests.** Inquiries and first-party measurement create
   Requests. This closes the cycle end to end (Baseline #19), at first with labelled
   placeholders.
7. **Interfaces.** Build Operator and customer views over the shared objects, choosing
   Core, portal or WordPress per view.

The public miopages.com site for metrics is a separate track (P0-5, Nov 20). It needs
none of these steps to begin, although it will use the Observation object once that
exists.

## Questions for the owner

- Are these the right objects? Anything missing, merged wrongly or split wrongly? For
  example, is an Article a Work product like a Page, or something of its own?
- Myomaton's object structure: is there a document from that project, or the original
  page-one direction for MioPages, that this should be checked against?
- Step order: Request, Decision, Change and Review first (proposed), or Knowledge first?

## Appendix: duplicates found in code (Nov 24)

- `lib/platform/intake/presence-workflow.ts` case `State` (1,424-line file): separate
  fields for corrections, understandingCorrections, knowledgeReassessments,
  sourceRecovery, revisionRequest, replan, editorialFindings, editorialDecisions,
  operatorReview, wordpressReviews, withdrawnReviews, qualityReviews, conceptEditorial,
  widerChanges, reviewRounds, businessFacts. `SourceRecovery` and
  `KnowledgeReassessment` each carry their own `previous {report, direction, blueprint,
  pages}` snapshot.
- Two `Actor` types (`content-editing/proposal.ts`, `intake/presence-workflow.ts`), four
  `Decision`, three `Scope`, three `Revision`, two `Approval`, two `Evidence`.
- `WorkflowPage` (`presence-workflow-artifacts.ts`) parallels canonical Page and Section
  (`managed-sites`), and `PageProposal` (`content-editing`) is a third page shape.
- `lib/platform/intake` holds 82 files spanning interview, research, generation,
  accounts, policy SQL and WordPress observation. Ten files are C0-specific (`c0-*`).
