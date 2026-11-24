# MioPages glossary

**Status:** draft for the owner's corrections, Nov 24 2026 (Claude). Once the owner
approves it, these are the only names used for these things, in conversation, in
documents, on screens and in code. Code moves to these names path by path during the
restructuring (`docs/service-object-model.md`).

How to read each entry: the term, what it means, and the words it **replaces**. A
replaced word is retired: it is not used for this thing again, and any word that means
two things is split.

## The service and the people in it

| Term | Meaning | Replaces / not to be confused with |
|---|---|---|
| **MioPages** | The managed Web Presence growth service as a whole. | |
| **Core** | MioPages' own system: it holds every object below and runs the service. | "the platform", "the app" |
| **Owner** | The founder of MioPages, who holds final product and business decisions. | |
| **Operator** | A MioPages team member doing service work for Accounts. The owner can also act as one. | |
| **Customer** | The business that MioPages serves, and the people who speak for it. | "client", "tenant" (code only) |
| **Prospect** | A business considering MioPages before it becomes a Customer. | |
| **Visitor** | Someone using a Customer's website. | "user" |
| **Account** | One Customer's whole relationship with MioPages: its Web Presence, people, commercial standing and Stage. | "case", "tenant", "workspace" |
| **Web Presence** | Everything through which a Customer is found and chosen online. The website is the main part today. | "presence", "site" when the whole is meant |
| **Stage** | Where an Account is: Prospect, Onboarding, Launch or Ongoing. Used for nothing else. | Not for AI steps (see Operation) or WordPress drafts (see Delivery) |
| **Free Review** | The free, short assessment offered to Prospects. Always called by its full name. | "Review" on its own (now means something else), "Web Presence Review" |
| **Direct Start** | Starting the paid service without a Free Review. | |
| **Onboarding** | Learning the business in depth: research, interview, the Customer's answers and materials. | "intake", "discovery", "knowledge transfer" |
| **Launch** | Building the first site and taking it live. | "Creation" |
| **Ongoing** | The continuing service after Launch: metrics, content and improvement. | |
| **Beacon** | A clearly labelled stand-in for a part of Core that isn't built yet, so the whole cycle can still run end to end (Baseline #19). Not a page Placeholder. | "fixture", "stub", "simulation" in owner-facing text |
| **C0, C2** | C0 is MioPages itself as a real Customer. C2 is a fictional test business. Their data never mixes, and neither is ever code. | |

## What the service knows

| Term | Meaning | Replaces |
|---|---|---|
| **Knowledge** | Everything MioPages holds as true or proposed about a Customer's business. | "business facts", "canonical knowledge", "confirmed information" |
| **Fact** | One item of Knowledge, with its source and status. | "entry", "business fact", "claim" (when a fact is meant) |
| **Fact status** | One of: confirmed, proposed, observed, inferred, disputed, unknown or out of date. | "provisional", "staged" |
| **Offering** | A service or product the Customer sells, with what it includes and its pricing policy. A kind of Knowledge. | |
| **My Business** | The Customer's view of their Knowledge, where they see it, correct it and add to it. | "Knowledge Base", "KB" (fine in conversation) |
| **Evidence** | Material gathered that is not itself Knowledge: the Customer's documents and answers, research findings, peer website observations, Free Review findings, and what read-back found on the site. | "source material", "observations" (in the research sense), "originals", "research" when the material is meant |
| **Confirm** | The Customer (or an authorised Operator) states that a Fact is true. Confirming a Fact is not approving a Change. | "attest", "confirmation" for anything else |

## What the service makes

| Term | Meaning | Replaces |
|---|---|---|
| **Work product** | Anything the service produces for a Customer. Every one has a stable identity and Versions. | "artifact", "deliverable" |
| **Report** | The Business Understanding Report: Core's reading of the business and its market. | |
| **Direction** | The Presence Direction: the strategy and design direction that follows from the Report. | |
| **Site plan** | The pages, their purposes and the menu. | "blueprint", "IA" |
| **Page** | One page of the site. | "post" (that's WordPress's internal word) |
| **Section** | One part of a Page. | "block" (a block is how WordPress draws a Section) |
| **Asset** | An image or other media placed in a Page. | "media", "image" |
| **Placeholder** | A visible marker where real material belongs but doesn't exist yet: an **FPO image**, or a pending testimonial, price or result. Never a gap, never an invention. | "pending notice" |
| **Action** | Something a Visitor can do: a button, link or form. | "CTA" |
| **Menu** | The site's navigation. | "navigation" (fine in code) |
| **Article** | A blog or content piece written for Ongoing. | "post", "blog" |
| **Design** | The visual system Core decides for a site: type, colour, layout and components. | "design system", "theme" (the theme is WordPress's), "brand" (brand assets are Knowledge) |
| **Version** | One saved state of a Work product. "Version 3 of the site" means the site as a whole at that point. | "candidate", "revision" (as a noun for a state), "source97" and the like |

## How anything changes

All changes go through the same cycle: Request, Decision, Change, Review, Delivery,
Observation.

| Term | Meaning | Replaces |
|---|---|---|
| **Request** | Someone or something wants a change or an answer. It records its origin, its target and its words. | "correction", "revision request", "replan", "finding", "wider change", "fact note", "page note", "feedback item", "recommendation" (as the thing to act on) |
| **Origin** | Where a Request came from: the Customer, an Operator, Core (a quality check), an Observation, a business change, or the start of a Stage. | |
| **Note** | A WordPress Note on a block. It is one way to raise a Request, not a separate kind of thing. | "line note", "annotation" |
| **Decision** | The reasoning about a Request: evidence, inference, what to change, **what to leave alone**, and why. "Maintain" and "watch" are valid Decisions. | "analysis", "brief", "critique" (as output), "assessment" |
| **Change** | The exact proposed difference to Knowledge or a Work product. It has a base Version, a visible difference, things it must preserve, a Grain and a way to undo it. | "revision" (as the act), "proposal", "edit" (when Core makes it), "patch" |
| **Grain** | How much a Change touches: a fact, a section, a page, a new page, the menu, the design, or the whole site. | |
| **Hand edit** | A change a person made directly in WordPress. Read-back brings it home as Evidence and a Request. If the base has moved, it is a **conflict**, never silently overwritten. | "drift", "Operator edit", "WP-origin change" |
| **Consequence level** | How much review a Change needs: routine (flows on its own), Operator review, or Customer approval. Publishing always needs approval. | per-step "grants", "mandates", "authorizations" for ordinary work |
| **Review** | A person looks at a Change and responds: **Approve**, **Decline**, **Correct** or **Ask**. | "decision" (when a person's response is meant), "sign-off" |
| **Approve** | Accept a Change for Delivery. | "approval" for fact confirmation (see Confirm) |
| **Review summary** | The page listing pending Changes for Review, with their costs. | "summary draft" |
| **Round** | One batch of Requests taken in together and reviewed together. | "review round", "take-in" |
| **Delivery** | Putting approved Changes where they live: WordPress **drafts** for review, or a **published** site. It produces a receipt and supports rollback. | "release", "staging", "go-live" (for draft delivery), "projection" |
| **Publish** | Make something public. Always an explicit approval, and the only use of "go live". | "release", "go-live" for drafts |
| **Read-back** | Core reading what is actually in WordPress: hand edits, Notes and what changed. | "readback", "take-in", "observation" (of the site) |
| **Rollback** | Return a delivered site to its previous Version. | "restore", "revert" (fine for one Change) |
| **Observation** | What happened afterwards: visits, inquiries and their outcomes, and later search data. Observations raise new Requests. | "signal", "snapshot", "metric" (a metric is one kind) |
| **Inquiry** | A Visitor contacting the Customer through an Action. Becomes a **lead** if qualified. | "submission", "contact" |
| **Outcome** | What came of an Inquiry or a Change: working, promising, neutral, worse or inconclusive. | |

## Who, when and at what cost

| Term | Meaning | Replaces |
|---|---|---|
| **Person** | Anyone acting: Customer, Operator, Owner, or Core itself. | "actor", "principal" |
| **Role** | What a Person is acting as, for which Account. | |
| **Permission** | What a Role may do. One definition across Core. | "authority", "scope", "grant", "mandate" |
| **Task** | Who must do what next, with what inputs, and what came of it. Covers Core and AI jobs, Operator work and Customer actions. | "work item", "job", "next action", "work" |
| **Operator queue** | The list of open Tasks across Accounts. | "console", "overview" |
| **Operation** | One kind of AI step Core runs, such as research, writing a section, or critique. | "stage" (for AI steps), "workflow operation" |
| **Budget** | An approved spending limit for AI and provider costs, with an expiry. | "grant" |
| **Cost** | Money spent or estimated for a Task: AI, providers, and Operator time. | "reservation", "micros" (code only) |
| **Interface** | A place where people work with Core's objects: Core screens, a portal, WordPress, email. Each is a view; none owns its own copy of the truth. | "surface", "console", "panel" |

## Core's areas

Core's code is divided into these areas. Each one owns its objects, and other areas
change those objects only through the area that owns them.

| Area | Owns |
|---|---|
| **Accounts** | Account, Person, Role, Permission |
| **Knowledge** | Knowledge, Fact, Offering, Evidence, My Business |
| **Site content** | Work products: Report, Direction, Site plan, Page, Section, Asset, Action, Menu, Article, Design, Version |
| **Change** | Request, Decision, Change, Review, Round |
| **Delivery** | Delivery, Read-back, Rollback, Publish; the WordPress adapter |
| **Measurement** | Observation, Inquiry, Outcome |
| **Work** | Task, Operator queue, Budget, Cost |
| **AI** | Operations and the AI provider adapters |

## Questions for the owner

1. **Customer or Client** for the business MioPages serves?
2. **Operator**: is this still the right word, especially for outside partners who may do
   Operator work later?
3. **Change**: is it clear enough in plain business language, or would "Proposed change"
   read better on screens?
4. **Round** for a batch of Requests reviewed together: acceptable, or another word?
5. Anything you call by a name that isn't here, or anything here you'd never say?
