# Established practices that apply to the MioPages object model

**Status:** research notes for the owner, Nov 24 2026 (Claude). These are not decisions.
They test `docs/service-object-model.md` against established software practice and point
to what each practice would change. Sources are listed at the end.

The short version: the model's shape matches well-tried practice. The practices add four
things the draft lacks:
- a shared vocabulary;
- clear module borders;
- precise rules for how a Change behaves;
- a proven method for migrating while the system keeps running.

## 1. Domain-Driven Design: one language, clear borders

**What it is.** The standard approach for business software whose difficulty lies in the
business itself rather than the technology. It has three core ideas:
- **Ubiquitous language:** the owner, the code and the screens use the same words with
  the same meanings.
- **Bounded contexts:** the system is divided into areas, each with its own model and a
  clear border.
- **Aggregates:** each object guards its own consistency, and other parts change it only
  through its own front door.

**How it applies.** This is the most directly relevant practice.
- Today one word means two things: "Review" is both the Free Review product and the act of
  reviewing a change. Meanwhile several words mean one thing: correction, revision
  request, replan, finding, note and wider change all mean "a request for change". That
  is exactly what a ubiquitous language fixes.
- The 82-file `intake` folder is a missing set of borders.
- The repeated copies of facts and pages exist because no object owned them.

**What it would change.**
- Add a **plain glossary** that the owner approves, and use it in code and screens.
- Divide Core into a few named areas: Accounts, Knowledge, Site content, Change, Delivery,
  Measurement, Work, and AI. Each area owns its objects.
- Other parts can change an object only through its owner. For example, nothing writes a
  business fact except through Knowledge.
- **Caution:** use these ideas, not DDD's heavy vocabulary and ceremony.

## 2. Modular monolith: one Core, strong internal walls

**What it is.** One application divided into modules that keep to firm public interfaces.
It avoids splitting into many small services before there is a need.

**How it applies.** It matches the owner's Nov 20 direction that logical independence does
not require extra infrastructure for every function. The small 20i server is another
reason to stay with one application.

**What it would change.** The areas from §1 become top-level modules in `lib/platform`.
Each module exposes a small interface, and the rest of its code is private to it.

## 3. Ports and adapters: WordPress, OpenAI and 20i plug in

**What it is.** The core of the system defines what it needs from the outside world (the
"ports"). Each outside system connects through a replaceable "adapter".

**How it applies.** This is the technical form of the owner's position: WordPress is one
delivery mechanism and stays out of the service's definition, while still sitting at the
centre in practice.
- Delivery already works this way, through signed packages and the plugin.
- OpenAI, Pixabay, 20i, Search Console and a future Claude model would each be adapters.
- The Nov 23 option of trying Claude as the AI becomes an adapter swap, not a rewrite.

**What it would change.**
- Name the ports explicitly: Deliver, Read back, AI decision, Image source, Hosting,
  Measurement source.
- Keep anything specific to WordPress or OpenAI inside its adapter.

## 4. Pull requests and plan/apply: how a Change should behave

**What it is.** Two practices from software teams and infrastructure tools that have been
refined over many years.
- **The pull request:** someone proposes an exact change against a known base version.
  Reviewers see the difference, comment on it, and approve or reject it. It is then
  merged, and a conflict is flagged when the base has moved underneath it.
- **Plan/apply:** used by infrastructure tools. The tool shows exactly what *will* change
  before anything is applied, then applies precisely that plan.

**How it applies.** The model's Change object is this pattern.
- The Review summary page is a "plan".
- An Operator's hand edit in WordPress is a base that has moved. That is the Post 36
  situation, and it should be handled like a merge conflict, not silently overwritten.

**What it would change.** Give the Change object explicit rules taken from these
practices:
- a **base version**;
- a visible **difference**;
- **comments** attached to exact spots;
- **conflict** detection when the base has moved;
- **apply exactly what was approved**;
- **revert**.

## 5. Change types by consequence

**What it is.** IT service management (ITIL) sorts changes into three types:
- **standard:** pre-approved and routine;
- **normal:** reviewed;
- **emergency.**

Only the risky ones carry ceremony.

**How it applies.** It matches the record's three approval levels (routine, Operator review,
customer approval) and Baseline #22 (controls match the stage). It also answers the
ceremony overload from the Codex period: most changes should be "standard" and flow
without stopping anyone.

**What it would change.** Every Change carries a consequence level, which decides who must
review it. No one-off approval gates.

## 6. Case management: an account is a case, not a production line

**What it is.** There are two ways to model work.
- **A fixed workflow** (BPMN) suits a production line, where every item follows the same
  steps.
- **Case management** (CMMN) suits knowledge work. A case (here, a customer account) has
  goals, and tasks arise as circumstances unfold. People decide many next steps.

**How it applies.** MioPages accounts are cases.
- Onboarding, review rounds and Ongoing don't follow one rigid line.
- Operators decide much of what happens next.
- The current AI workflow is built as a fixed line (research, report, direction,
  blueprint, pages, editorial). That's why every new need was bolted on as another field.

**What it would change.**
- Model the Account as a case holding Tasks and Requests.
- Keep fixed sequences only where they are truly fixed. Building the first site is one:
  a short, fixed AI pipeline launched *by* a Task.
- The Operator queue is then the list of open Tasks across cases.
- **Caution:** don't install a generic workflow engine. The idea matters, not a product.

## 7. Structured content (Create Once, Publish Everywhere)

**What it is.** NPR pioneered this. Content is stored as structured objects independent of
how it looks: a story, its parts and its images. Each outlet (web, apps, partners)
renders it in its own way. Content is created once and reused everywhere.

**How it applies.** The model's Work products are this: Page, Section, Asset, Action and
Navigation, with WordPress as one renderer. It also supports reuse across stages. A
service description in Knowledge can feed the site, an Article and a report without
being rewritten each time. The danger it warns against is content that exists only as
WordPress block markup, which can't be reused or changed precisely.

**What it would change.**
- Core holds the structured version of every page.
- WordPress blocks are generated from it.
- Read-back maps WordPress edits back onto that structure.

## 8. An append-only history

**What it is.** Each change of state is recorded as a dated event rather than by overwriting
the old value. Current state can always be explained, and "what changed since last time"
is easy to show.

**How it applies.** Core already keeps revisions and refuses to delete history. A shared
history format across all objects would give the owner one plain timeline per account.
That answers the old complaint of not being able to tell what changed.

**What it would change.**
- Every object records its changes in one shared format: who, what, when, and from which
  Request.
- **Caution:** full "event sourcing", rebuilding everything from events, is unnecessary
  here.

## 9. AI as small, routed, scoped steps

**What it is.** Anthropic's guidance on building with language models recommends
predictable "workflows" over open-ended agents wherever the steps are known, and
starting with the simplest thing that works. Three of its patterns apply:
- **Routing:** classify an input and send it to a specialised step.
- **Prompt chaining:** a sequence of steps with checks between them.
- **Evaluator-optimizer:** one call produces the work, another critiques it, and the
  loop repeats until the result is good enough.

**How it applies.** This is the granular-AI point.
- Each Request is routed by its grain to a specific AI operation (fact, section, page,
  new page, site plan). Each operation sees only what bears on its target.
- The existing editorial critique is an evaluator.
- First-site creation is a prompt chain.
- P0-1 already rules out an "autonomous agent swarm". This guidance agrees.

**What it would change.**
- Replace the one broad review-analysis call with routing plus a small set of scoped
  operations.
- Onboarding, Launch and Ongoing share the same operations and pass them different
  context.

## 10. Strangler fig: migrate while flying

**What it is.** Martin Fowler's pattern for replacing a running system piece by piece. New
code grows around the old, takes over one path at a time, and the old code shrinks until
it can be removed. There is no big-bang rewrite.

**How it applies.** This is "building the plane in the air". It is the safe way to move the
current AI workflow onto shared objects while protected Core and miopages.org keep
working.

**What it would change.** The migration order becomes explicit:
- route one path at a time through the new objects, starting with review rounds;
- prove that the path behaves the same, using the existing tests and the dry run;
- remove the old fields for that path;
- move on to the next path.

## 11. Hypothesis-led improvement for Ongoing

**What it is.** Product and growth teams treat each change as a hypothesis with a baseline, a
measure and a review window. Results are recorded honestly as worked, didn't work or
inconclusive.

**How it applies.** The record already asks for this (the "EvaluationPlan" in the
shared-intelligence design). In the model, it is simply what an Observation-origin
Request carries.

**What it would change.** Nothing new. It confirms that Ongoing needs no machinery beyond the
shared cycle plus measurement.

## What doesn't fit

- **Microservices:** too much infrastructure for the stage and the server.
- **Full event sourcing:** more than needed.
- **A generic workflow or BPM product:** the idea from §6 matters, not the tool.
- **Autonomous agents:** P0-1 rules them out, and the AI guidance agrees.

## What this means for how we proceed

The practices confirm the model and add five concrete refinements:
1. **A glossary first.** Fix one name per object, approved by the owner and used in code
   and screens. Fix the "Review" collision.
2. **A context map.** Name a few Core areas, each owning its objects, and move the code
   into them.
3. **Change behaves like a pull request:** base, difference, comments, conflicts, exact
   apply, revert, and a consequence level.
4. **AI as routed, scoped operations**, shared by every stage.
5. **Strangler-fig migration**, one path at a time, starting with review rounds.

## Sources

- Anthropic, [Building effective agents](https://www.anthropic.com/engineering/building-effective-agents).
  The page notes that its tooling advice has dated since December 2024; the patterns
  still stand.
- Martin Fowler, [Strangler Fig Application](https://martinfowler.com/bliki/StranglerFigApplication.html);
  see also [Microsoft's pattern guide](https://learn.microsoft.com/en-us/azure/architecture/patterns/strangler-fig)
  and [AWS prescriptive guidance](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/strangler-fig.html).
- Lullabot, [Understanding Create Once Publish Everywhere (COPE)](https://lullabot.com/articles/understanding-create-once-publish-everywhere-cope);
  Daniel Jacobson, [NPR examples of COPE](https://www.slideshare.net/danieljacobson/npr-examples-of-cope).
- WordPress, [Notes documentation](https://wordpress.org/documentation/article/notes/) and
  [Notes feature in WordPress 6.9](https://make.wordpress.org/core/2025/11/15/notes-feature-in-wordpress-6-9/).
  Notes attach to whole blocks, notifications are limited, and per-item notes are
  planned. This confirms that notes are a light raising channel, not a management
  interface.
- Domain-Driven Design (Eric Evans), modular monolith, ports and adapters (Alistair
  Cockburn), ITIL change types, OMG's CMMN case management and pull-request or plan/apply
  practice are long-established. They are summarised here from general knowledge
  rather than from a specific page.
