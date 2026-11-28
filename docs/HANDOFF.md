# MioPages: handoff document

Written Nov 28, 2026, at the Principal's direction: "document everything and then put it in a
proper document that I can use to move on if I have to." It's meant for whoever carries the work
on, whether that's a person, another tool or Claude in a new session. Facts were checked on Nov 28
unless marked otherwise. No passwords or keys appear here, only where they are kept.

---

## 1. What MioPages is

A managed Web Presence service for small businesses. It learns a business, builds and runs its
website, turns visitors into inquiries, measures results and keeps improving. **Core** is the
software system that does the work. **WordPress** is where sites are delivered and reviewed. **C0**
is MioPages itself used as the first test Client; the Principal speaks for C0.

**The Principal's requirements**, in their own words, are in `docs/owner-critical-conversations.md`
(P0-1 to P0-27, then dated entries to Nov 28). `MIOPAGES-BASELINE.md` Part 1 is a condensed list
written by Claude on Nov 21. **Caution:** that list paraphrases, and some paraphrases hardened into
rules the Principal never stated (see section 8). When in doubt, the dated quotes in the decisions
record win.

## 2. Where things stand (Nov 28)

**Working:**
- **Core's engine** (`lib/platform/service/cycle.ts`): a Request leads to a Task, which leads to a
  proposed Change (a new Version), which a person reviews. Every Version is kept, and an earlier one
  can be made current again.
- **The real AI writer**, through OpenAI, metered against a spending cap. A free stand-in (the
  "Beacon") is used for testing.
- **Peer research:** 7 comparable websites, with screenshots, for C0.
- **C0's Business Understanding Report:** version 4, approved by the Principal as C0's Client.
- **A Specialist workspace and a Client portal,** run locally on the development PC.
- **Delivery to WordPress as drafts,** signed, with pictures. Hand edits and Notes in WordPress
  come back into Core.
- **A page's words and its layout kept separate** (built Nov 28): a layout change cannot alter the
  approved words.

**Not good enough:**
- **The C0 site Core produces** is long, crowded and heavy with frames and "Content needed" boxes.
  The Principal called it "a bloated, inexplicable deformed clone." The current draft is on
  miopages.org, pages 82–91.
- **The Principal's verdict on the process:** "a litany cascade of atrocious failure" (Nov 28).

**Not started:**
- Core on the hosted server (milestone 4).
- Publishing to the public site, and email in and out (milestone 5).
- Real visitor measurement, Ongoing improvement, billing.

**A site that did work:** on Oct 12 a 7-page MioPages site was built, short and clean, which the
Principal calls "a pretty decent website." Screens are in
`runtime-content/miopages-finalization/*.png`; its renderer is still in the code
(`components/managed-sites/focus-page.tsx`, `app/focus-presentation.css`); its content is in Git
at commit `847c575` (`scripts/customer-previews/miopages-c0-accepted.json`). Its words were
edited by people (the "R3" pass).

## 3. Systems and access

| System | What | Access (where kept; nothing is stored in Git) |
|---|---|---|
| **miopages.org** | Password-protected review WordPress on 20i shared hosting. The Principal looks at drafts here, and only here. WordPress 7.1.4, delivery plugin 0.1.5, theme 0.1.6. | SSH key `~/.ssh/miopages_wp_20i`, user `miopages.org@ssh.us.stackcp.com`. WP-CLI: `/usr/php84/usr/bin/php /usr/local/bin/wp --path=$HOME/public_html` (on Windows Git Bash, prefix commands with `MSYS_NO_PATHCONV=1`). WordPress and gate logins: `runtime-content/private/review-sites/miopages-org-login.txt`. Signing settings: `runtime-content/private/review-sites/new/`. |
| **miopages.com** | The public MioPages website, on 20i shared hosting. Not touched by this work. | 20i account (the Principal's). |
| **Protected Core** | wp-acceptance.miopages.com/core on a 20i cloud server: the old Codex-era Core. No longer connected to miopages.org. | SSH key `~/.ssh/miopages_20i`, port 39304, user `wp-acceptance.miopages.com@ssh.iad.stackcp.com`. |
| **runtime.miopages.com** | An old public Next.js build on the same server. To be stopped (a Principal action in My20i). | 20i. |
| **Databases** | Supabase (free plan) for the old protected Core; a private PostgreSQL on the Core server. The new Core runs on a throwaway local database during development. | Supabase account (the Principal's). |
| **OpenAI** | Core's AI. | Environment variable `OPENAI_API_KEY` on the development PC. |
| **Pixabay** | Free pictures (the Principal's choice). | `runtime-content/private/pixabay.key`. |
| **GitHub** | Code: `R-Levin/myomaton-web`. | The Principal's account. |

Private settings on miopages.org live in `~/miopages-private/` (with archives of earlier plugin,
theme and settings; a database export from Nov 27; and the Nov 23 drafts archived on Nov 28).

## 4. The code

- **Repository:** `R-Levin/myomaton-web`. Active branch `claude/rebuild-2026-11-22`, in the worktree
  `runtime-content/c0-integration-spine-phase-b-worktree-20261110`. Never merge or reset `main` into
  it; merging into `main` is the Principal's decision.
- **Tags:** `c0-state-a-2026-11-26` (the site the Principal said "might work in production") and
  `c0-state-b-2026-11-27`. How to go back: `docs/states.md`.
- **Stack:** Next.js 16.4.5, React 19, TypeScript, PostgreSQL, Node 24. WordPress plugin and theme in
  PHP. Read `node_modules/next/dist/docs/` before changing Next.js code (it differs from older
  versions).

**The parts that matter now:**

| Path | What it does |
|---|---|
| `lib/platform/service/cycle.ts` | The engine: Requests, Tasks, Changes, Reviews, Versions; restore; page grains |
| `lib/platform/service/ai-writer.ts` | Calls the AI for each Work product, checks the answer, retries once |
| `lib/platform/service/beacon-writer.ts` | The free stand-in for the AI |
| `lib/platform/service/page-words.ts` | A page's words as numbered pieces; layout fill, word edits, mending, comparison |
| `lib/platform/service/delivery.ts` | Sends approved pages to WordPress; reads back Notes and edits |
| `lib/platform/service/research.ts`, `assets.ts`, `evidence.ts` | Peer research, pictures, the Client's documents |
| `lib/platform/intake/core-authoring-instructions.ts` | **What Core's AI is told.** The main source of the bloat (section 8) |
| `lib/platform/intake/presence-workflow-artifacts.ts`, `presence-native-component.ts` | The page format Core writes, and how it is checked |
| `app/workspace/`, `app/portal/` | The Specialist workspace and Client portal |
| `scripts/service/workspace-preview.ts` | Starts the local workspace, a throwaway database and a local WordPress |
| `scripts/service/check-design-rules.ts`, `draft-pdf.ts` | Rendered-page check and screenshots/PDF of the drafts |
| `wordpress/miopages-delivery/` | The WordPress plugin that receives signed drafts |
| `wordpress/miopages-managed-site/` | The WordPress theme (`style.css`, `menu.js`, `readable.js`) |
| `components/managed-sites/`, `app/*presentation.css` | The October renderer (Next.js), unused since |

**How to run:**
- **Tests:** `npm test` (654 tests: 651 pass, 3 skipped, on Nov 28). PHP plugin checks:
  `php scripts/test-wordpress-delivery.php`.
- **Workspace with the free stand-in:** `npx tsx scripts/service/workspace-preview.ts`, then
  http://127.0.0.1:4480/workspace.
- **Workspace with the real AI on C0:** the `workspace-ai-c0-milestone-3` entry in
  `.claude/launch.json`:
  `--ai-run c0-milestone-3 --cap 28 --review-site runtime-content/private/review-sites/new/miopages-org.json`.
  It spends money; the Principal approves every paid step.
- **Screens of what's on miopages.org:**
  `npx tsx scripts/service/draft-pdf.ts --base https://miopages.org --login runtime-content/private/review-sites/miopages-org-login.txt --out <folder>`.

## 5. Data

- **C0's run** (outside Git, private): `runtime-content/ai-runs/c0-milestone-3/`.
  - `record.json`: Core's whole record for C0, with every Version of every page.
  - `answers.jsonl`: every AI answer, including refused ones.
  - `onboarding-usage.json`: the spending ledger. `scope.json`: the cap and limits.
  - `research/`: the peer screenshots. `site-draft-*`: screenshots and PDFs of each draft.
- **C0's knowledge:** imported from its onboarding (`knowledge.json` in the run folder; manifest in
  `lib/platform/knowledge/`).
- **Snapshots:** `runtime-content/snapshots/2026-11-27-night-c0-record/`.

## 6. Money

- **C0 real-AI run (milestone 3), Nov 25–28:** $24.63 spent, cap $28 (approved in steps: $15, $17,
  $18, $21, $24, $28).
  - About $9.40 got to the Nov 26 site.
  - About $15 went on the redesign attempts of Nov 27–28, which didn't improve the site.
- **Codex era (October to Nov 21):** recorded in the old ledgers on protected Core; not re-totaled
  here.
- **Typical AI cost per Client to a first site** (rough, from this run): $3–6. Never measured
  cleanly.

## 7. History in brief

- **Sep to early Oct:** a Next.js platform, managed-site renderer, design tokens, contact forms,
  backups.
- **Oct 12:** the decent 7-page C0 site, with people-edited words and a fixed, well-made design.
- **Late Oct to Nov 21 (Codex era):**
  - Core moved to AI-generated sites delivered to WordPress.
  - Verdicts: "can't make heads or tails" (Nov 16), F (Nov 17), D− (Nov 17), "much better" (Nov 18),
    then rejected.
  - Heavy process overhead built up: hashes, grants, receipts, long handoffs.
- **Nov 21:** Claude took over. The baseline was written and the Codex-era history archived.
- **Nov 22:** Claude rewrote Core's AI instructions, including the lines that cause the bloat.
- **Nov 25:** the rebuild plan, milestones 1–2 (engine, workspace, portal), all local.
- **Nov 26:** the first real AI run on C0. The Principal: "might work in production," but looks
  like the old site.
- **Nov 27–28:** redesign attempts, a design brief, rules and checks, words and layout separation.
  The site didn't get better. The Principal stopped the work.

## 8. What went wrong, and why (for whoever continues)

- **Core is told to bloat.** `core-authoring-instructions.ts`, written by Claude on Nov 22 (commit
  `09191ce`), says:
  - "use all of it"
  - "write and design the page completely"
  - "every section must give the reader a different reason"
  - "make the site visually rich … plan an image wherever it helps … otherwise still place the image
    node"
  - "never leave the spot out just because the material is missing"

  That's why pages are long, full of FPO frames and "Content needed" boxes. Each line hardened a
  remark of the Principal's into an absolute rule, or added Claude's own opinion.
- **Nothing ever subtracted.** Each failure was answered with more instructions, checks, scripts and
  repairs, never by removing a cause.
- **Progress was reported as counts and passing checks,** not as whether the site looked good to a
  visitor.
- **Free-form layout:** Core composes each section node by node (panels, columns, nested groups).
  The October site used four section kinds drawn well by the renderer.
- **Process overhead:** the project holds about 95 documents (about 23,000 lines) and 24,500 lines of
  library code for a 10-page site.
- **Treat the baseline with care.** Some of its items are Claude's paraphrase, not the Principal's
  words.

## 9. Open decisions (the Principal's)

1. The simplified version (the Principal's direction of Nov 28, now under way): AI research → a nice
   site → WordPress for the Principal to look at, with words and layout managed simply.
2. How Part 1 #12 (FPO frames and visible placeholders) should apply, if at all.
3. Brand color (the indigo) and the heading font for C0.
4. When to move Core to the hosted server (milestone 4), and publishing and email (milestone 5).
5. Whether to merge this branch into `main`.
6. The unmerged branch `codex/shared-intelligent-onboarding-live-proof-2026-11-10` (an interview
   and onboarding proof): merge or retire.
7. Stopping runtime.miopages.com (in My20i).

## 10. Documents: what to read

**Read first:**
- `docs/owner-critical-conversations.md`: the Principal's decisions.
- This file.
- `docs/tasks.md`: the current work.

**Useful reference:**
- `docs/service-object-model.md` and `docs/glossary.md`: the shared objects and the names.
- `docs/what-lives-where.md`: hosts and delivery.
- `docs/rebuild-plan.md`: milestones and progress notes.
- `docs/states.md`: how to go back to earlier states.
- `docs/design-rules.md`: the nine design rules approved Nov 27.

**History** (records, not instructions):
- `docs/archive/`: the Codex era.
- Reviews, triage and briefs dated Nov 26–28.
- Most other files in `docs/`.

**Working rules for Claude:** `CLAUDE.md` and `AGENTS.md`.
