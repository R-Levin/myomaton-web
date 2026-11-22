# MioPages: verified service inventory (2026-11-22, Claude)

Purpose: what exists today across the whole service, how sound it is, and where the
Codex-era damage sits. This is the foundation for the clean rebuild; archiving removes
old instructions and handoffs, never capabilities.

**How each line was checked.**
- **V:** verified in code, by tests or by a live read-only check.
- **R:** Codex's record only; not independently checked.

**Test state.** Unit tests: 574 of 578 pass and 3 are skipped. The 1 failure is a local
Windows `whoami` quirk. The WordPress delivery gate and the integration suites pass.

## Verdict: how far the damage goes

**Mostly localized.** No capability was deleted. Git history shows only early refactor
deletions (September). Every working branch's code is contained in the active branch
except one unmerged onboarding branch (see "Open items"). The owner records on `main`
are all present in the active branch too.

The damage sits in five layers on top of working machinery:

1. **AI instructions and validators of site creation.** This is the worst layer.
   - `presence-workflow-provider.ts` has 599 lines of layered defensive prompt text.
   - `presence-marketing-authority.ts` and `presence-decision-brief.ts` contain
     refusal rules that suppress what the owner asked for. Examples: placeholders,
     prices and testimonials are refused instead of marked as pending, and a
     competitor citation was required on every page.
2. **Ceremony.**
   - 145 pinned hashes across code and scripts.
   - About 600 approval, grant and authorization references in the intake layer
     alone.
   - Per-run manifests, receipts and hash-locked grants that make every step slow
     and brittle.
3. **Fixed design.** One brand record, one theme and seven fixed colours. The AI can
   only rearrange blocks, so every candidate looks the same.
4. **Core's interface.** The hosted Core page is a C0-specific development console.
   Its client lives under `scripts/intake/*.tsx`. The owner rejected it as unusable
   (Nov 16 and Nov 20).
5. **Documentation volume.** 83 docs, including about 2,100 lines of control history
   and handoffs, written as instructions to the next session.

## Hosts and what runs where (V unless marked)

| Host | What it is |
|---|---|
| miopages.com | Public MioPages WordPress on 20i shared (Reseller) hosting. Its links go to the 20i customer portal at my.miopages.com. |
| miopages.org | Password-protected development WordPress, also on 20i shared hosting. It holds draft **revision 6**: 13 pages, 2 images and 35 actions, Delivery plugin 0.0.12 (R), theme 0.1.0 (R). |
| wp-acceptance.miopages.com/core | Protected Core on a 20i cloud server, deployed build `2809543` (13 commits behind the active branch). A private PostgreSQL on the same host holds evaluation case databases. The main database is Supabase. Restored 2026-11-22 after the memory-guard outage. |
| runtime.miopages.com (+ domain-test) | Separate package on the same server. It runs an **older public Next.js MioPages build**: Home, Service, Experience and a Free Review page, publicly reachable and linked from nowhere. Its account is also the **operator workspace**: database setup, WordPress enrolment and staging scripts were run from it. |
| Local | WordPress at 127.0.0.1:4474, with copied plugin and theme. Local PostgreSQL is used for tests. |

## Service stages

| Stage | What exists | State | Damage affecting it |
|---|---|---|---|
| **Entry: Free Review / Direct Start** | Shared versioned intake (`app/api/intake`, `lib/platform/intake`). Review questionnaire, synthesis, revisions and exact Operator approval (`lib/platform/reviews`). | Local and development. An older public Free Review page is on runtime.miopages.com; no live public intake. (V) | Little. |
| **Adaptive interview and research** | Intelligent question engine (`intelligent*.ts`). Local adaptive onboarding. Peer website research with desktop and mobile capture. Real OpenAI proofs run. The owner rejected the fixed 10-step questionnaire as a real interview (P0-7). | Partial. An unmerged branch holds the authenticated Core interview and research-first discovery (see "Open items"). (V) | Moderate: hash-pinned response contracts in `intelligent-responses.ts` (13 pins). |
| **Business Knowledge Base ("My Business", P0-14)** | Canonical Knowledge and Offering records with immutable revisions. Customer and Operator correction proposals with history. My Business grouped view. | Partial: proposals and viewing work; confirmation and reassessment wiring are incomplete. (V) | Little. |
| **Report and Presence Direction** | Genuine hosted Business Understanding Report (owner: broadly accurate, P0-12) and Direction. Correction path. | Works. The Direction is prose only: no structured visual decisions. (V) | Moderate. |
| **Site creation** | Workflow engine (`presence-workflow.ts`, 1,143 lines): research → report → Direction → blueprint → pages → editorial critique → revision, with retries and recovery. Native component vocabulary. All candidates retained (41/6 hosted, 97, 106, 113, 129). | Works technically; output rejected (F, D−, "near usable", then 129 rejected). (V) | **Heavy.** Prompts, validators, fixed design, small revision caps, and a citation rule that forces hedged copy. Step 2 fixed the worst conflicts. |
| **Media** | Pixabay search, download and per-placement rights review. OpenAI image-generation contract. Customer uploads and supplied media. Asset and AssetUsage records with provenance. FPO in Next.js and, since Step 2, in WordPress. | Works. (V) | Light: placement rules were tied to unchanged Home content (fixed in Step 2). |
| **WordPress delivery** | Plugin `miopages-delivery` 0.0.13 and block theme `miopages-managed-site`:<br>• site enrolment with keys, rotation and revocation (DB migrations 0016–0019);<br>• Ed25519-signed releases pulled over authenticated HTTPS, staged privately, with signed receipts back to Core;<br>• `wp miopages native-draft`: creates and updates real WordPress pages as drafts with stable IDs, blocks, navigation and actions, revisions, rollback and signed receipts;<br>• private media staging and attachment with protected preview;<br>• signed brand projection, scoped DB roles, environment diagnostics. | Works on miopages.org (revision 6, R). The older release path is text-only and limited to 16 pages; the native-draft path carries media. **Not built:** WordPress edits flowing back to Core, publishing live, visitor measurement in WordPress, working forms. (V) | Ceremony is heavy in the operator scripts (hash-pinned one-off staging scripts). The machinery itself is sound. |
| **Existing (non-20i) WordPress (P0-6)** | Design for an opt-in mode: read-only audit first, allowlisted page ownership, outbound pull, no forced host, DNS or mail move. The environment diagnostic already separates an existing-host audit from a controlled install. | Planned; **not proven off-host**. The planned proof: the same plugin on a second host, a signed synthetic release, a receipt, then a bounded draft and rollback. (V) | None. |
| **Next.js managed-site renderer** | `components/managed-sites`, `app/[[...path]]`, design tokens, FPO visual, contact form. | The older delivery path; it serves runtime.miopages.com. (V) | Fixed design tokens. |
| **Accounts, roles, portal** | Protected owner login. Customer binding, activation and roles. Account work view with corrections, review activity and inquiries. | Technically works; owner rejected the usability (Nov 20). (V) | Heavy: C0-specific console. |
| **Contact and inquiries** | Contact definitions, scoped submissions, delivery and acceptance hooks, outcomes. A hosted synthetic inquiry with recommendation. | Foundation only; development-gated, no real form delivery. (V) | Little. |
| **Measurement** | First-party event ledger (local), deduplication, accepted-Contact reconciliation, internal review collector, Performance Snapshot fixtures. | Local only; no WordPress visitor collection. (V) | Little. |
| **Ongoing** | Recommendation → Operator change → signed private revision, receipt and restore, exercised with synthetic inputs. Shared generation supports revisions. Architecture in `shared-intelligence-creation-ongoing-architecture.md` (P0-21). | Synthetic only. (V) | Little. |
| **Billing / commercial** | Commercial evidence fields in activation (manual record). 20i HostShop named as the first candidate. | Not built (manual surrogate only). (V) | None. |
| **Infrastructure and recovery** | Backup and restore tooling with tests (`scripts/backup`). PG17/PG18 bootstrap and recovery. Private launcher with memory guards (fixed 2026-11-22). | Works. (V) | Light. |

## Owner requirements on record
P0-1 to P0-27 and the November 18–21 decisions are in `docs/owner-critical-conversations.md`.
The ones that shape the rebuild:
- P0-1: Core runs the whole service, with no humans shuttling routine work.
- P0-3: genuine Core and AI output, never Codex stand-ins.
- P0-4: Ongoing means site, blog and content improvement plus first-party metrics.
- P0-6: managed and adopted external WordPress.
- P0-11 and P0-15: understandable, actionable owner and customer views.
- P0-12: Operator labour is legitimate service delivery.
- P0-14: a living Business Knowledge Base.
- P0-20: peer research, original design, new blocks.
- P0-21: a shared AI foundation for Creation and Ongoing.
- P0-27: outcome over compliance or minimal spend.

`MIOPAGES-BASELINE.md` Part 1 condenses these.

## Open items to reconcile (not lost, not yet merged)
1. **`codex/shared-intelligent-onboarding-live-proof-2026-11-10`**: 23 commits and about
   2,400 lines that are not in the active branch. They cover an authenticated Core customer
   interview, research-first gap discovery and live OpenAI interview proofs. Decide
   whether to merge them into the rebuilt interview or treat them as superseded; review
   before rebuilding the interview.
2. Protected Core runs `2809543`, 13 commits behind the active branch (22 files).
3. The miopages.org plugin is recorded as 0.0.12 against 0.0.13 in the repo (R). The local
   WordPress plugin copy also drifts from the repo outside the Step 2 files.
4. runtime.miopages.com: stop the old public app and keep the account's operator files.
   This needs owner action in My20i or access to that package.

## Keep vs rebuild
**Keep and reuse:**
- canonical data model and revisions;
- intake and Review;
- Knowledge Base records;
- workflow persistence and recovery;
- research capture;
- media acquisition and rights;
- the whole WordPress delivery stack (enrolment, signing, pull, native drafts, media,
  rollback, receipts);
- contact, measurement and Ongoing foundations;
- backups;
- retained AI outputs and candidates.

**Rebuild cleanly from Part 1:**
- the AI instructions for every stage;
- the validators (keep only real safeguards, and turn "refuse" into a "placeholder
  pending" notice wherever content is missing);
- the design system (Core-decided per site; only the MioPages logo and name fixed);
- the authorization ceremony (one budget approval plus a plain log);
- Core's owner, customer and Operator interface;
- the documentation set (archive the history).
