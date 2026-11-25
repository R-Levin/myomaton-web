# Rebuild plan (Principal direction, Nov 25)

Rebuild Core's working heart on the shared objects; keep what is sound; retire, not repair,
what betrays the guiding concepts. Recorded in `docs/owner-critical-conversations.md`
(Nov 25). Supersedes items 5 and 6 of `docs/safeguards-review.md`: the code they would have
cleaned is retired instead.

## What we are building toward

A product a person can operate: a **Client Portal** and a **Specialist workspace**, with real
delivery to WordPress. Each milestone ends in something the Principal can see and use, not a
test count.

## How Core works after the rebuild

Every piece of work is the same cycle of shared objects (`docs/service-object-model.md`):

1. A **Request** arrives. Its origin is the start of the service ("understand the business",
   "create the site"), the Client, a Specialist, an email, an Observation or Core's own check.
2. A **Task** says who handles it: Core and its AI, a Specialist, or the Client.
3. The handler makes a **Decision**: the **Changes** it proposes to **Knowledge** or a
   **Work product** (Report, Direction, Site plan, Menu, Page, Section, Asset), each against an
   exact Version, at a consequence level.
4. A **Review** by the right person (routine changes go ahead; Specialist review; Client
   approval). The Client's word follows the standing rule.
5. **Delivery** puts approved Changes in WordPress as drafts; **Publish** is always an explicit
   approval. **Read-back** brings hand edits home as Requests.
6. **Observations** (Leads, Visitors, later search) raise new Requests. That is Ongoing.

Onboarding, Launch and Ongoing are this one cycle at different grains. Building the site once
is one large Change; everything after is smaller ones. There is one engine, not one per case.

## C0

C0 is MioPages itself, as a Client, and the system's full test case. It is an Account like any
other:
- its onboarding, done before Core existed, enters as **imported Knowledge**, the Client's
  confirmed word (the Principal speaks as the Client);
- the parts of it that are the actual product (MioPages' own site and brand) are its **Work
  products**, delivered like any Client's;
- its own material is **data**. Nothing in Core is written for C0 alone.

## Keep (sound; carried into the rebuilt Core)

| Area | What |
|---|---|
| Database | Accounts, Web Presences, sites, Pages, Sections, Assets, Actions, Menus, Knowledge and Offering with immutable revisions; the schema and migrations |
| Shared objects | Change record (`change/`), Knowledge and Facts (`knowledge/`), Work product identities and versions (`work-products/`), Client people (`accounts/`), Tasks (`work/`) |
| AI connection | The Responses transport, its usage ledger, spending cap and rate card; the instructions that produced the Report the Principal judged broadly accurate |
| WordPress | The delivery plugin and theme, enrolment, signed drafts, receipts, read-back, Notes |
| Design and media | Design projection and rendering, FPO, stock search and per-placement rights, Asset provenance |
| Contact and measurement | Contact definitions and submissions, Lead outcomes, the first-party measurement ledger |
| Operations | Sign-in and permissions, backup and recovery, the protected update sequence |

## Retire (replaced by the rebuilt Core, not repaired)

- The AI workflow engine (`presence-workflow.ts` and its dozen record shapes), its provider
  authorization files and "marketing authority", and the separate disposable, evaluation and
  protected ways of running it.
- The ten C0-only files (`intake/c0-*`) and C0-only code elsewhere: what they hold that is
  real C0 material becomes data.
- Parallel page shapes (`WorkflowPage`, `PageProposal`) once the rebuilt Core writes Page and
  Section Work products directly.
- Codex's rehearsal, proof and recovery scaffolding around those paths.

Retired code is removed when the milestone that replaces it is accepted, never before, so
something always runs end to end. Git keeps its history.

## Milestones

1. **One Core on the objects (local).** One engine runs the cycle above from the start of the
   service to WordPress drafts: Report, Direction, Site plan, Pages, a Review Round and a
   Publish approval (Publish itself stays a Beacon), with labelled stand-in AI answers. C0's
   imported Knowledge is the test case. *Acceptance:* the end-to-end run passes on the new
   engine, and the old workflow is no longer used by it.
2. **The Specialist workspace and Client Portal** on that Core: the Queue, Proposed changes and
   the Review summary, My Business, approvals, Client people, email entry. *Acceptance:* a
   person can do each job on screen without help.
3. **One real AI run on C0** (needs the Principal's approval of the spending). *Acceptance:*
   the site meets Part 1 of the baseline (#9–#16).
4. **The rebuilt Core on protected Core**, replacing the old one for C0 (needs the Principal's
   approval). *Acceptance:* the same run on the hosted system.
5. **Publish to WordPress, and email in and out** (`docs/email-proposal.md`). *Acceptance:* a
   real change reaches miopages.com with the Principal's approval, and a Client email becomes a
   Request on its own.

## Guardrails while rebuilding

- Name the object before building anything; one object, one place, one name.
- Keep only the safeguards in the review's "Keep" list; add none that do not trace to Part 1
  or a real security or legal need.
- Adversarial review before showing anything; the Principal is not QA.

## Progress

- *Nov 25, milestone 1 begun (local):* the engine (`lib/platform/service/cycle.ts`) runs Launch
  on the shared objects. The start of the Stage raises a Request to understand the business;
  Core writes the Report, and only the Client may approve it. A Client correction is a Request in
  their words, and Core reworks from the draft. Each approval raises what builds on it
  (Direction, Site plan, one Request per page); Pages and Sections keep their identities and
  Versions; a later Request on a page is the same cycle at a smaller grain. It runs end to end
  with a labelled Beacon in place of the AI.
  Each Account's service record is now kept in the database as append-only versions; a save
  from a stale read is refused, so two people never overwrite each other. Core reads the
  Account's Knowledge from the one Knowledge record, with each item's standing and whether it
  may appear on the website.
  Onboarding done outside Core enters an Account as its Knowledge through the normal Knowledge
  writer (`knowledge/import.ts`); C0's reviewed manifest is one such data file, and loads into
  any Account (the old loader demanded the whole database match a frozen snapshot).
  The real AI writer (`service/ai-writer.ts`) is built on the kept AI connection: every call is
  priced and recorded against the Account's budget, the AI may cite only the Account's own
  Knowledge (proposed items are marked as not yet confirmed), Core's current authoring
  instructions are used, and each answer is checked before it becomes a proposed Version. Tested
  through the whole Launch over an offline connection; no paid call has been made.
  Delivery (`service/delivery.ts`) sends the engine's current Pages, Menu and Design to
  WordPress drafts through the kept signed path, with each page and section keeping its
  identity. Read-back turns open Notes and hand edits into Requests on their pages; delivery
  waits until hand edits are worked in, so they are never overwritten, and the next delivery
  answers and resolves each Note that was carried out.
  Publish: the Client alone approves publishing the site exactly as it stands; the request lists
  the Proposed facts the site rests on, and approving confirms them in Knowledge as the Client's
  word. Public delivery itself is a labelled Beacon until milestone 5.
- *Nov 25, milestone 1 accepted locally:* `tests/integration/service-launch.test.ts` runs C0 on the
  rebuilt Core from its imported onboarding through Launch, WordPress drafts and a Review Round to
  the Client's Publish approval, saved at every step, with the old workflow used nowhere. AI calls
  go through the metered connection over an offline stand-in; no paid call has been made.
  Carried into milestone 2 (they belong with the screens): Report corrections stating facts in the
  new engine, Client email entry and the people list wired to it, and a hand edit taken in as the
  Specialist's own Change rather than as a Request for Core to rework. The old workflow keeps
  serving protected Core and today's screens until milestones 2 and 4 replace them; it is
  removed then.

## Milestone 2 screens (plan, Nov 25)

Plain server-rendered pages, one form per action, every action checking who is acting.
- **Specialist workspace** (`/workspace`): the **Queue**, every Task across Accounts with who
  must act; each Account's page shows where Launch stands, its Work products and their current
  Versions, the **Proposed changes** waiting (each readable in full, with Approve, Correct in
  your own words, or Decline), Core's work waiting to run, the Account's Knowledge, its Client
  people, and Client email entry.
- **Client Portal** (`/portal`): what needs the Client (the Report to confirm, a Publish to
  approve, Proposed facts), and My Business.
- Locally, a preview command sets up a throwaway database with C0 as an Account and a choice of
  who you are (a Specialist, or one of C0's Client people). Core's AI is the labelled stand-in
  there; the real AI needs the Principal's approval (milestone 3). Sign-in on protected Core
  comes with milestone 4; until then these pages refuse to run anywhere but locally.
- *Nov 25, milestone 2 first slice (local preview):* `npx tsx scripts/service/workspace-preview.ts`
  starts the Specialist workspace (`/workspace`) and Client Portal (`/portal`) against a throwaway
  database holding C0. Checked in the browser: a Specialist starts Launch and lets Core (the
  labelled Beacon) write the Report; the Client reads it in full in their portal and corrects it
  in their own words, and sees their request listed as being worked on. Also built: Proposed
  changes with Approve / Correct / Decline, Publish approval (which confirms the Proposed facts the
  site relies on), Proposed facts the Client confirms, corrects or declines, Specialist facts, and
  the Client people list. Still to do: Client email entry on the engine, WordPress delivery and
  Notes from the workspace, Report corrections that state facts, and a full walk-through to Publish.

- *Nov 25, milestone 2 second slice (local preview):* a full walk-through to Publish on screen.
  The Specialist starts Launch; the Client approves the Report in the portal; Core (the Beacon)
  writes the Direction, Site plan and pages, each approved by the Specialist. A **Client email**,
  entered by the Specialist, counts as the Client's Request only when the sender is on the Client
  people list; one about the site in general waits for the Specialist to **direct** it to a Work
  product (or answer it with no change), and Core reworks that page from the Client's own words.
  The Client holds off Publish with a reason; the Specialist directs it to the Home page; Core
  reworks it; the Client reads every page in the Publish request and approves, which confirms the
  Proposed fact the site cites. The portal's "What you asked for" shows what became of each
  request (being worked on, done in which Version, or answered). Refusals now show in plain words.
  **Not done:** WordPress from the workspace. The delivery plugin writes drafts in a MySQL
  transaction, as on the hosting, and this computer has no MySQL; the preview's own throwaway
  WordPress (`scripts/service/preview-wordpress.ts`) is built but stays off until a local MariaDB
  is set up (a download, for the Principal's OK). Delivery and Notes remain tested on the plugin's
  own code (`tests/integration/service-launch.test.ts`). Also still to do: Report corrections
  that state facts, and a hand edit as the Specialist's own Change.
- *Nov 25, WordPress from the workspace (local preview):* with the Principal's OK, a portable
  MariaDB now backs the preview's own throwaway WordPress. Checked in the browser: the Specialist
  sends the approved site as review drafts (they render in WordPress with the managed theme, the
  Menu and FPO image placeholders); a Note on the Start page is read back as a Request on that
  page; Core reworks it, the Specialist approves, and the next draft answers and resolves the
  Note in WordPress. (The Note was added through WordPress directly, standing in for a person
  typing it in the editor.) Still to do in milestone 2: Report corrections that state facts, and
  a hand edit as the Specialist's own Change.
