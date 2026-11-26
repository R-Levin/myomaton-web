# MioPages — Owner Requirements Baseline and Recovery Plan

Prepared November 21, 2026 at the start of the Claude engagement, from the owner's
handoff package (`MioPages-Claude\Review`): the six guide documents, the
owner-critical-conversations record (P0-1 to P0-27 and the Nov 18–21 entries),
development-control, the service model, both owner standing-instruction files and the
final Issue #12 handoffs.

**Status of this document:** this baseline condenses the owner's decisions. Everything
in Part 3 about code state is *Codex's account* and has not yet been checked against
the source. Verifying it is the first job.

**Names (Nov 24):** the owner is now the **Principal**, the customer business the **Client**, and the
Operator the **Specialist** (`docs/glossary.md`). Text written before Nov 24 keeps the old words.

---

## Part 1 — What the owner has decided

These are standing requirements. Later owner statements override earlier ones, and
nothing below came from an assistant proposal unless it says so.

### The product
1. **MioPages is a complete managed Web Presence growth service.** It learns a
   business, builds and runs its presence, turns visitors into inquiries, measures
   results and keeps improving. The website is one output. C0 (MioPages itself) is the
   proving case, not the product. *(Nov 20, reaffirmed repeatedly)*
2. **The lifecycle is one connected service:** optional Free Review *or* Direct Start →
   AI-assisted research and adaptive discovery → customer-correctable business
   understanding → assessment and Presence Direction → original site (copy, design,
   media, SEO, Actions) → Customer/Operator review → authorized delivery and Launch →
   inquiries and outcomes → first-party measurement and reporting → Ongoing improvement.
3. **Core is the system of record.** It owns knowledge, workflow, proposals, approvals,
   revisions and history. In principle WordPress is one delivery mechanism and stays out
   of the overarching definition of the MioPages service. In practice it removes a
   massive development hurdle, so it sits at the centre of what is being built now
   (owner, Nov 24). The resources to hand are WordPress, the cloud server running Core,
   and the 20i Reseller account where its use makes sense. Hosting providers (including
   20i) remain replaceable; 20i-only is an option under discussion, not a decision.
   Where customers and Operators communicate and do their work (inside WordPress, a
   MioPages portal, or a hybrid, which Operators will likely need) is an open question.
   *(Nov 24)*
4. **Core and the in-app AI do the customer-facing intellectual work.** The developer
   (formerly Codex, now Claude) builds and fixes Core. It never writes the marketing
   copy or site content as a stand-in for Core's AI output. *(P0-2, P0-3, Nov 21)*
5. **Ongoing centers on site/blog content improvement and real first-party metrics.**
   Social posting is a small optional derivative. GA4/Search Console are optional
   extras. *(P0-4)*
6. **There is a living, customer-owned Business Knowledge Base** that the customer can
   see, correct and enrich. *(P0-14)* **The Client is the authority on their own
   business** (Principal, Nov 24): a Fact is Confirmed only on the Client's word, with the
   record to show it (for example a Client email kept as Evidence, entered by a
   Specialist). Anything else, from a Specialist or Core, is Proposed until the Client
   approves it, at the latest when they approve Publish. The standing of whoever
   introduced a change must pass every acceptance. No levels of Specialist; the
   Principal (as Account Manager) may override, recorded as an override. The Client
   Portal updates Knowledge the same way.
7. **Human Operator work is a normal, costed part of the service**, not a failure of
   automation. Launch needs every promised function to have a credible delivery path,
   whether system or person. *(P0-12, Nov 20: "the bigger challenge is to deliver the
   elements a human can not.")*
8. Startups and established small businesses are both eligible. Real C0, fictional C2
   and Myomaton data must never mix. Retire the legacy QR/self-managed offers. The
   HostShop login at my.miopages.com is separate.

### What a good site from Core must have
9. **Grounded in the full approved C0 knowledge:** the business brief, product model,
   R3 editorial work and owner direction. Not a few short summaries. *(P0-17, P0-19)*
10. **Shaped by real research:** several peer websites, inspected for terminology and
    *visual* design, with findings that visibly change the strategy, language and
    design. *(P0-20, P0-25)*
11. **Original:** the earlier accepted site and R3 are a reference and precedent for
    taste, not a template. The design should be contemporary and justified, never
    copied from competitors. *(P0-20)*
12. **Visually rich, with actual images placed in the pages:** acquired or stock images,
    or clearly marked **FPO** (for-position-only) images where final art isn't ready.
    Text descriptions of images don't count. *(P0-9, P0-10, P0-27)* The same applies
    to other missing material (testimonials, prices, results and so on): a visible
    placeholder where it belongs, never a gap and never an invention. *(Nov 22)*
13. **Uses the business's real brand assets as inputs:** never silently dropped (the
    logo once vanished for no reason). Nothing is fixed by rule, not even logo or name:
    Core designs each site and may recommend brand changes; the owner or customer
    decides. *(P0-17; clarified Nov 22: the earlier fixed styling was scaffolding)*
14. **Free of internal development language.** Copy must state confidently what
    MioPages delivers, through automation plus real Operator work. No invented claims,
    prices, testimonials or results, but also no defensive over-hedging. *(P0-15, P0-16)*
15. **New blocks and layouts are allowed** where the business need justifies them; the
    AI is not limited to a fixed menu of section types. Generated code still needs
    review before production. *(P0-19, P0-20)*
16. **No fixed page count.** Structure follows the business and its visitors.
16a. **Customers iterate on the draft:** what they like is retained, what they don't is
    revised, through a workable feedback-and-revision method tied to specific pages and
    sections. Captured for the future; not yet built. *(Nov 22)*
16b. **Humans review real WordPress sites** (20i Reseller hosting), not screenshots;
    screenshots are only an AI input. *(Nov 22)*
16c. **A site is judged by what the Client will see.** Core designs each site's actual look and
    layout, not only its colours and fonts; a new site must look newly designed for that business,
    shaped visibly by the research, and must not look like the earlier accepted site or any fixed
    template. Nothing is called done, or shown to the Principal, until the rendered site has been
    looked at and compared with the earlier site and the peers. *(Nov 26: "we are looking for what
    Cx will see")*

### How development must work
17. **Outcome first.** Tests are part of engineering, not product progress. Never
    present passing checks, schemas or receipts as acceptance. *(P0-23, P0-27)*
18. **Never narrow the owner's requirement into an easier technical proof**, and don't
    starve quality to save pennies. Don't spend to a ceiling just because it exists,
    either. *(P0-27)*
19. **Keep one connected end-to-end cycle running**, with clearly labeled placeholder
    "beacons" where pieces are unfinished, and advance onboarding, site, portals, leads,
    measurement and Ongoing **in parallel**. *(P0-23)*
20. **Reuse what works** across all development. Explain the need before building
    anything new; no parallel demo architecture.
20a. **Object orientation is the fundamental guiding principle, and the primary focus
    now.** The service is built from a small set of shared objects (knowledge, requests,
    decisions, changes, reviews, delivery, observations and the like), and every stage
    (onboarding, site creation, review, knowledge correction, Ongoing) is a workflow
    composed from them, not a new machine. This applies across the whole service and
    within its parts. Before anything is built, say which object it uses or extends; if
    it fits none, stop and discuss. Carried over from Myomaton, where the same components
    served different tasks. *(Nov 24; the model lives in `docs/service-object-model.md`)*
21. **Do the routine work without asking.** Stop only for real gates: spending,
    sending protected data to providers, hosted/live changes, credentials, merges,
    publication, customer approval. Ask once, with precise scope. *(Nov 14, P0-18, Nov 21)*
22. **Controls should match the stage.** Local iteration needs little ceremony;
    protected writes and public or customer actions need progressively stronger
    controls. The founder may hold several roles. *(P0-18)*
    The system must be safe but not overweening: keep the safeguards that protect real
    data, money and the Client's word, and remove ceremony that only slows the work. The
    previous tool ignored repeated direction that it was too conservative and timid; that
    must not recur. *(Nov 25)*
23. **Check your own work hard before showing it.** Review it adversarially and fix what
    you find. The owner is not the QA department. *(P0-16, P0-19)*
24. **Report in plain business language**: what changed, what's still wrong and the one
    decision needed. No jargon-dense receipts. *(P0-11, P0-16, Nov 20)*
25. **Don't make the owner repeat retained information**, and don't ask them to retest
    fixtures.
26. **Decisions made in conversation are recorded when they happen** in
    `docs/owner-critical-conversations.md`, so nothing decided inline is lost to the
    project. *(Nov 22)*

---

## Part 2 — How the previous workflow failed (the patterns to prevent)

From Codex's own causal account and the owner's recorded verdicts (F, D−, "much better
but…", and the final rejection of candidate 129):

| Pattern | Concrete example on record |
| --- | --- |
| **Assistant-invented rules overrode owner direction** | A generic "never fill the site with placeholder images" instruction suppressed the owner's explicit FPO request. A rule requiring competitor sources for every page rejected sound blueprints. |
| **Inputs silently narrowed** | The page writer was cut off from the research, report and Presence Direction (P0-19). Only ~2 KB of approved knowledge reached the provider while the full brief sat unused. |
| **Delivery path dropped work** | Stock image packets existed, but the newer site export used a base path with no image projection. Candidates 113 and 129 had zero images. |
| **Strategy never refreshed** | The report, Direction, blueprint and research were unchanged across the last revision round, so only the prose improved. |
| **Tests mistaken for progress** | Browser, schema and signature checks were reported as milestones. Commercial quality was not checked before the owner saw results. |
| **Process overhead outgrew the product** | Hash-bound grants, per-build consent, ledgers and very long handoffs consumed large amounts of effort while the site stayed weak. |
| **Unreadable handoffs** | The owner repeatedly couldn't tell which candidate, system or revision they were looking at. |

**The common cause:** owner direction got summarized into a smaller task at each
handoff. An assistant-created restriction then entered code, later work treated it as
authoritative, and tests checked against the restriction rather than the requirement.

**The structural fix for this engagement:** Part 1 is the reference. Every
consequential output is checked against it **before** the owner sees it, and any rule
added to code or prompts must trace to a Part 1 item or a real security or legal need.

---

## Part 3 — Current state (Codex's account, to be verified)

- **Active code:** branch `codex/first-operational-cycle-2026-11-12` at `c7debcc`, in
  worktree `C:\Users\mplxs\Projects\myomaton-web\runtime-content\c0-integration-spine-phase-b-worktree-20261110`.
  The repo root checkout is an older branch, and `main` has a different history.
  **Do not merge, reset or fast-forward between them.**
- **Instructions file:** the code follows `AGENTS.md` (Codex's file). It must be read
  and reconciled with `CLAUDE.md`.
- **Latest site:** six pages on local WordPress at http://127.0.0.1:4474 (candidate
  129, Core review 131). Unaccepted: no images or FPO, a thin Review example, no design
  change from research, and long process-heavy copy.
- **Protected WordPress** (miopages.org, password-protected) holds an older 13-page
  revision 6. **Protected Core** (wp-acceptance.miopages.com/core) is intermittently
  down (200/502, 23 PM2 restarts, cause unknown) and runs an older build (`2809543`).
  A tested comparison fix was never deployed.
- **Spending:** current C0 case estimate ≈ $14.91 (conservative ≈ $15.27). The request
  allowance is used up, and the grant expires Nov 22, 2026 at 15:58 UTC. **No paid AI
  calls are authorized until the owner approves a new budget.**
- **Worth keeping (per Codex):** saved AI outputs and history, the Core→WordPress
  proposal, delivery and rollback machinery, stable page IDs, source custody, adaptive
  questioning proofs, the asset and media acquisition code (Pixabay, FPO component),
  and the contact and measurement foundations.
- **Server:** a small 20i host that has run out of memory before. It is not evidence
  of capacity for 50–100 customers.

---

## Part 4 — Recovery plan

### Step 0 — Set up (this week; no spending and no live changes)
1. Run Claude Code **in the active worktree**, not the repo root.
2. Have it read `AGENTS.md`, `CLAUDE.md` and this baseline. Report conflicts between
   the instruction files to the owner instead of silently choosing one.
3. Leave the credentials version of the access guide **out of AI context**.

### Step 1 — Verification audit of the whole service (read-only)
**Part A: the whole service.** For each lifecycle stage in requirement 2 (Entry,
discovery, Business Knowledge Base, report/Direction, site creation, review portals,
delivery, inquiries, measurement/reporting, Ongoing, accounts/billing, hosting/exit),
start from `docs/platform-capabilities.md` and confirm against the code what is
**working, partial, a labeled beacon, or missing**, and what is reusable. Produce one
plain-language table showing where the overall service actually stands.

**Part B: the C0 site problem.** Check Part 3 against the actual code and records,
then produce a plain-language map:
- Trace the C0 path end to end (sources → research → report → Direction → blueprint →
  page writing → media → WordPress export) and mark, at each stage, which **Part 1
  requirement is met, partly met or blocked, and by what code or prompt**.
- Specifically confirm the three known defects: the FPO/placeholder prompt rule, the
  media projection missing from the site export, and whether page writing receives the
  full approved knowledge plus research and Direction.
- List every assistant-authored restriction in prompts and validators, with its
  justification or lack of one.
- List the server instability evidence. Diagnose it only if read-only access allows.

**Owner sees:** a short findings summary and a proposed fix list. There are no
technical receipts in the summary; they go in an appendix.

### Step 2 — Fix the pipeline locally, with no new AI spending
- Remove or correct the rules that conflict with Part 1. Connect media and FPO
  placement to the export, and pass the full knowledge, research and Direction to the
  page writer.
- Prove the media path by rendering **the existing saved site with existing images or
  FPO** in local WordPress. The content stays Core's; only the delivery path is fixed.
- Review the result adversarially against Part 1 before showing the owner.

### Step 3 — One properly funded generation round (requires owner approval)
- Ask for **one** budget and scope decision covering refreshed research (including
  visual peer research), a new report, Direction and blueprint, all pages, images or
  FPO, and critique and revision cycles.
- Produce the site, review it against Part 1, fix what's fixable, then show the owner
  one coherent candidate with a plain explanation of what changed and why.

### In parallel (don't let the site monopolize the roadmap)
- Stabilize protected Core: cause of the 502s, memory, and deploying the tested
  comparison fix. **Deployment is an owner gate.**
- The proportionate security/interaction review the owner already requested (Nov 21):
  simplify development-stage ceremony while keeping secrets, privacy, spending and
  publication controls.
- Keep the connected cycle (inquiry → measurement → recommendation → Ongoing) moving,
  with beacons clearly labeled.

---

## Part 5 — Decisions only the owner can make

| Decision | When needed | Recommendation |
| --- | --- | --- |
| Budget and scope for the next paid generation round | Before Step 3 | Set one envelope that's enough for real research plus revision, not a microscopic cap. |
| Deploying fixes to protected Core | When stabilization is ready | Approve per deployment with rollback retained. |
| Rotating the OpenAI key and other credentials handled by prior AI sessions | Once the new setup works | Rotate. The credentials-version archive has been exposed to multiple tools. |
| Whether to simplify the grant/hash/ledger regime for development | After the security review | Simplify for local and dev work; keep strong gates for live/customer actions. |
| Whether Claude Code may push to the working branch on GitHub | Before Step 2 | Allow branch pushes; keep merges into `main` as an owner decision. |
