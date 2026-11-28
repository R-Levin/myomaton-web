# MioPages glossary

**Status:** agreed with the Principal, Nov 24 2026. These are the only names used for these
things, in conversation, in documents, on screens and in code. Code moves to these names
path by path during the restructuring (`docs/service-object-model.md`).

Each entry gives the term, what it means, and the words it **replaces**. A replaced word is
retired and is not used for that thing again. Capitals mark a defined term in documents;
screens use ordinary sentence case.

## People and the service

| Term | Meaning | Replaces |
|---|---|---|
| **MioPages** | The managed Web Presence growth service as a whole. | |
| **Core** | MioPages' own system. It holds every object below and runs the service. | "the platform", "the app" |
| **Client** | The business MioPages serves, and the people who speak for it. | "customer" (for the business), "tenant" |
| **Specialist** | A MioPages team member, or later an outside partner, doing service work for Clients. On Client-facing pages: *Web Presence Specialist*. | "Operator" |
| **Account Manager** | A Specialist with wider Permissions: every Account, overrides and troubleshooting. A Role, not a different kind of person. | |
| **Principal** | The founder of MioPages, who holds final product and business decisions. Holds every Role today. | "owner" (so that "owner" stays free for a Client's business owner) |
| **Prospect** | A business considering MioPages. | |
| **Visitor** | Someone on a Client's website who hasn't got in touch. | "user" |
| **Lead** | Anyone who has got in touch through a Client's site. Whether they look promising is a note on the Lead. Its messages are its history. | "contact", "inquiry", "submission", "enquirer" |
| **customer** | Someone who bought from a Client: the ordinary word, as the Client uses it. | |
| **Account** | One Client's whole relationship with MioPages: its Web Presence, people, commercial standing and Stage. | "case", "tenant", "workspace" |
| **Web Presence** | Everything through which a Client is found and chosen online. The website is the main part today. | "presence", "site" (when the whole is meant) |
| **Stage** | Where an Account is: **Prospect**, **Onboarding** (learning the business in depth), **Launch** (building the first site and taking it live) or **Ongoing** (the continuing service). A Prospect may take the **Free Review** or a **Direct Start** (paid service without it). Used for nothing else. | "intake", "discovery", "Creation"; "stage" for AI steps |
| **Free Review** | The free, short assessment offered to Prospects. Always called by its full name. | "Review" on its own, "Web Presence Review" |
| **Beacon** | A clearly labeled stand-in for a part of Core that isn't built yet, so the whole cycle can still run end to end (Baseline #19). | "fixture", "stub", "simulation" (in Principal-facing text) |
| **C0, C2** | C0 is MioPages itself as a real Client. C2 is a fictional test business. Their data never mixes, and neither is ever code. | |

MioPages is its own Client (C0), so a Lead on miopages.com is a Prospect for MioPages: the
same funnel, at two levels.

## What the service knows

| Term | Meaning | Replaces |
|---|---|---|
| **Knowledge** | Everything MioPages holds as true or proposed about a Client's business. | "business facts", "canonical knowledge", "confirmed information" |
| **Fact** | One item of Knowledge, with its source and its status: confirmed, proposed, observed, inferred, disputed, unknown or out of date. | "entry", "business fact", "claim", "provisional", "staged" |
| **Offering** | A service or product the Client sells, with what it includes and its pricing policy. A kind of Knowledge. | |
| **My Business** | The Client's view of their Knowledge, where they see, correct and add to it. | "Knowledge Base", "KB" (fine in conversation) |
| **Evidence** | Material gathered that is not itself Knowledge: the Client's documents and answers, research, peer website observations, Free Review findings, and what Read-back found. | "source material", "originals", "research" (when the material is meant) |
| **Confirm** | The Client (or an authorized Specialist) states that a Fact is true. Confirming a Fact is not approving a Change. | "attest" |

## What the service makes

| Term | Meaning | Replaces |
|---|---|---|
| **Work product** | Anything the service produces for a Client. Each has a stable identity and Versions. | "artifact", "deliverable" |
| **Report** | The Business Understanding Report: Core's reading of the business and its market. | |
| **Direction** | The Presence Direction: the strategy and design direction that follows from the Report. | |
| **Site plan** | The Pages, their purposes and the Menu. | "blueprint", "IA" |
| **Page**, **Section** | One page of the site, and one part of a Page. | "post", "block" (WordPress's words for how they are stored and drawn) |
| **Asset** | An image or other media placed in a Page. | "media", "image" |
| **Action** | Something a Visitor can do: a button, link or form. | "CTA" |
| **Menu** | The site's navigation. | "navigation" (fine in code) |
| **Article** | A blog or content piece written for Ongoing. | "post", "blog" |
| **Design** | The visual system Core decides for a site: type, color, layout and components. | "design system", "theme", "brand" (brand assets are Knowledge) |
| **Placeholder** | A visible marker where real material belongs but doesn't exist yet: an **FPO image**, or a pending testimonial, price or result. Never a gap, never an invention. | "pending notice" |
| **Version** | One saved state of a Work product. "Version 3 of the site" means the site as a whole at that point. | "candidate", "revision" (as a state), "source97" and the like |

## How anything changes

Every change goes through the same cycle: Request, Decision, Change, Review, Delivery,
Observation.

| Term | Meaning | Replaces |
|---|---|---|
| **Request** | Someone or something wants a change or an answer. It records its origin (the Client, a Specialist, Core, an Observation, a business change, or the start of a Stage), its target and its words. | "correction", "revision request", "replan", "finding", "wider change", "fact note", "page note", "feedback item", "recommendation" |
| **Note** | A WordPress Note on a block: one way to raise a Request. | "line note", "annotation" |
| **Decision** | Core's or a person's reasoning about a Request: evidence, what to change, what to leave alone, and why. "Leave it" and "watch it" are valid Decisions. | "analysis", "brief", "critique", "assessment" |
| **Change** | The exact proposed difference to Knowledge or a Work product: its base Version, the difference, what it must keep, its **grain** (a fact, a section, a page, a page's **words** only, a page's **layout** only, a new page, the Menu, the Design, the Report, the Direction, the Site plan or the whole site; a layout change can't change a word, and a words change leaves the layout as it is) and how to undo it. Screens say **Proposed change** or **Approved change**. | "revision" (as the act), "proposal", "patch", "edit" (when Core makes it) |
| **Hand edit** | A change a person made directly in WordPress. Read-back brings it in as a Request. If the base has moved, it is a **conflict**, never silently overwritten. | "drift", "Operator edit" |
| **Consequence level** | How much review a Change needs: routine (goes ahead), Specialist review, or Client approval. Publishing always needs approval. | per-step "grants", "mandates", "authorizations" |
| **Review** | A person responds to a Change: **Approve**, **Decline**, **Correct** or **Ask**. | "decision" (for a person's response), "sign-off", "approval" (for Facts: see Confirm) |
| **Review summary** | The page listing Proposed changes for Review, with their costs. | "summary draft" |
| **Round** | One batch of Requests taken in and reviewed together. Core's own internal critique-and-revise loops are **passes**, never Rounds. | "review round", "take-in" |
| **Delivery** | Putting approved Changes where they live: WordPress **drafts** for review, or the public site. It leaves a receipt and supports **Rollback** (return to the previous Version). | "release", "staging", "projection", "restore" |
| **Publish** | Make something public. Always an explicit approval, and the only meaning of "go live". | "release", "go-live" (for drafts) |
| **Read-back** | Core reading what is actually in WordPress: hand edits, Notes and what changed. | "readback", "take-in" |
| **Observation** | What happened afterwards: Visitors, Leads and customers, and later search data. Observations raise new Requests. | "signal", "snapshot", "metric" |
| **Outcome** | What came of a Lead or a Change: working, promising, neutral, worse or inconclusive. | |

## Who, when and at what cost

| Term | Meaning | Replaces |
|---|---|---|
| **Person**, **Role**, **Permission** | Anyone acting (a Client, a Specialist, the Principal, or Core itself); what they are acting as, for which Account; and what that Role may do. One definition across Core. | "actor", "authority", "scope", "grant", "mandate" |
| **Task** | Who must do what next, with what inputs, and what came of it: Core and AI jobs, Specialist work and Client actions. | "work item", "job", "next action" |
| **Queue** | The list of open Tasks across Accounts. | "Operator queue", "console", "overview" |
| **Operation** | One kind of AI step Core runs, such as research, writing a Section, or critique. | "stage" (for AI steps), "workflow operation" |
| **Budget**, **Cost** | An approved spending limit for AI and provider costs, with an expiry; and the money spent or estimated for a Task (AI, providers and Specialist time). | "grant", "reservation", "micros" (code only) |
| **Interface** | A place where people work with Core's objects: Core screens, the **Client Portal**, WordPress, email. Each is a view; none owns its own copy of the truth. | "surface", "console", "panel", "Customer Portal" |

## Core's areas

Core's code is divided into these areas. Each owns its objects, and other areas change those
objects only through the area that owns them.

| Area | Owns |
|---|---|
| **Accounts** | Account, Person, Role, Permission |
| **Knowledge** | Knowledge, Fact, Offering, Evidence, My Business |
| **Site content** | Work products: Report, Direction, Site plan, Page, Section, Asset, Action, Menu, Article, Design, Version |
| **Change** | Request, Decision, Change, Review, Round |
| **Delivery** | Delivery, Read-back, Rollback, Publish; the WordPress adapter |
| **Measurement** | Observation, Lead, Outcome |
| **Work** | Task, Queue, Budget, Cost |
| **AI** | Operations and the AI provider adapters |

## Names in older documents

Documents written before Nov 24 say "customer" for the Client, "Operator" for the
Specialist and "owner" for the Principal. They are history and are not rewritten. The
decision record keeps its file name, `docs/owner-critical-conversations.md`.
