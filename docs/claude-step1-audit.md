# Step 1 audit — technical appendix (2026-11-21, read-only)

Worktree: c0-integration-spine-phase-b-worktree-20261110, branch
codex/first-operational-cycle-2026-11-12 @ c7debcc, up to date with origin.
Uncommitted: CLAUDE.md (modified), MIOPAGES-BASELINE.md (untracked). Root checkout is
docs/wordpress-delivery-feasibility-2026-11-02 @ f352c06 (older, as stated).
No code, hosted system, database or provider was touched. The only network calls were
GETs to local WordPress at 127.0.0.1:4474.

## Instruction files
No direct conflict between AGENTS.md and CLAUDE.md. Two points of friction:
- AGENTS.md: "Use the canonical service contracts for product direction". CLAUDE.md:
  "Part 1 of the baseline is the reference." Where a docs/ contract differs from Part 1,
  follow Part 1 (CLAUDE.md rule) and flag it.
- AGENTS.md's Next.js block is auto-rewritten by `next dev`; harmless.

## Defect 1 — placeholder/FPO rule: CONFIRMED, and wider than one line
- lib/platform/intake/presence-workflow-provider.ts:551 (applies when nativeComponents===2,
  i.e. the run that produced 129): "Never invent acquired assets or fill the site with
  placeholder images" + "use original native blocks for abstract relationships instead of
  requesting additional unavailable illustrations" + "Keep the conceptual service-led Hero".
- lib/platform/intake/presence-review-instructions.ts:9 stockPlacementInstructions(v2):
  stock is "an optional selection pool"; any changed page/content/use requires new rights
  review.
- lib/platform/presentation/fpo.ts:12 + plan.ts:67-68: FPO is allowed only when the DB is a
  read-only disposable `canonical_test_*_preview` schema; it is "refused in ordinary
  deployment". FPO is rendered only by the Next.js renderer (components/managed-sites/*).
- WordPress has no FPO support at all (no match in wordpress/). class-miopages-native-component.php:137-142:
  an image node without bound media throws (the whole render fails); local CLI renders a
  text note, "Image placement awaiting asset review", which is not an image.
- scripts/project-wordpress-c0-v3.ts:69 asserts no previewMedia reaches WordPress.

## Defect 2 — media missing from the export: CONFIRMED
- lib/platform/intake/presence-workflow-delivery.ts:48 workflowNativeReviewCandidate (Core's
  review preview + native WordPress drafts) projects heading/text/block only: no image field.
- The older projectWorkflowPreview (same file, ~line 80) carries an image only for visuals in
  state "approved".
- scripts/intake/original-evidence-local-packet.ts:34: images are included only with the
  "reuse-reviewed-home-stock" flag, and only if Home is byte-identical to version 64.
  Any Home revision -> "Reviewed Home content changed; new media review required".
- Local WP 4474, pages 203/215/216/217/218/219: each has 2 <img>, both the base64 wordmark
  (header and footer). There are zero content images and zero pending-media notes.
- No search description meta is output by the WP plugin/theme (grep for searchDescription in
  the PHP turned up nothing).

## Defect 3 — page writer inputs: LARGELY FIXED in the current path; older path remains
- In the source-aware path (marketingAuthority.projectionVersion 2), the page writer receives
  the full originals: business brief 13,408 B, product model 28,253 B, R3 10,063 B
  (docs/c0-source-aware-run-proposal.json; presence-source-material.ts:83-123). It also gets
  research full text plus desktop/mobile screenshots, report, Direction, blueprint and
  decisionBrief (presence-marketing-authority.ts:136-160).
- Caveat: claim authority ("businessKnowledge") uses hand-selected exact passages
  (marketingSources, :81-85). Codex's own note says the Ongoing selections are partial.
- The older non-v2 page branch is still in the code and still omits report, Direction and
  research (presence-marketing-authority.ts:171 comment). It is dormant only while grants
  use v2.
- Strategy not refreshed: Codex's lineage record says source 71 -> report 73 / Direction 76 /
  blueprint 78. The final round (critique 113/115 -> 129) revised pages only.

## Assistant-authored restrictions (prompts + validators)
Key: K = keep (traces to Part 1 #14 or legal/security), F = fix/remove (conflicts with Part 1),
P = partly justified (over-broad).

| # | Where | Rule | Verdict |
|---|---|---|---|
| 1 | provider.ts:551 | No placeholder images; no extra illustrations; use native blocks instead | F (#12) |
| 2 | provider.ts:551 | "Keep the conceptual service-led Hero" | F (#11, #15) |
| 3 | review-instructions.ts:9 | Stock optional; any content change voids the placement review | P (license real; per-change re-review too strict for private preview) |
| 4 | fpo.ts / plan.ts | FPO only in disposable preview schema; refused elsewhere | F (#12) |
| 5 | WP native-component.php:142 | Unbound image node throws | F (should render FPO) |
| 6 | local-packet.ts:34 | Stock reuse only if Home identical to v64 | F |
| 7 | decision-brief.ts:102-104 | Every Page must cite a peer/market source | P (remnant of the rejected competitor-per-page rule) |
| 8 | decision-brief.ts:51 + marketing-authority.ts:279 | copyPolicy "unpriced-no-testimony"; regex blocks any $ amount, star ratings, "customers say", guarantee+outcome | P (right now; it will block real prices once the owner sets them; it caused the FAQ124 false positive) |
| 9 | bindCitations / verifyCitations | Every section body must cite approved claim IDs | P (honesty; pushes thin, hedged copy) |
| 10 | delivery.ts:24 | Semantic blocks refused for protected delivery | P (#15 needs code review, but this blocks even private review) |
| 11 | provider.ts:551 | mobileOrder 0 (same visual and DOM order) | K (accessibility) |
| 12 | provider.ts:551 | Stock never depicts a customer or testimonial | K (#14) |
| 13 | provider.ts:65 | No invented contacts/prices/case studies; null action destinations | K (#14, security) |
| 14 | marketing prompt | Two entry choices in Home Hero | K (Part 1 #2) |
| 15 | multiple | Don't copy third-party wording/design; 12-word overlap check | K (legal) |
| 16 | exposesInternalCopy | Excluded/internal phrases refused | K (#14) |
| 17 | provider.ts:72 (managed-v1 only) | "only necessary supporting Intro sections", <=2 actions | P (older path) |
| 18 | grant caps | maxEditorialRevisions/maxCommercialReplans; $5 round | P (spend gate real; caps sized too small, #18) |

The prompt stack for a page in the 129 configuration is several thousand characters of
rules layered over the task. Much of it is defensive wording added after earlier failures.
That fits Part 2's "process overhead" pattern and probably explains the long, process-heavy copy.

## Design path
Palette and typography come from fixed approved brand config (draft-brand.ts). The page
writer controls only layout primitives (arrangement/columns/surface/typeScale) in
presence-native-component.ts. Peer visual research can't change typography, color use or
imagery; the visual vocabulary is fixed. This partly blocks #10 and #11.

## Server instability
- Records (development-control.md:285-330): the 502 was the app's own memory guard. It
  stopped Core when free memory dipped 288 KiB under a 512 MiB reserve; this was not a Linux
  OOM. autorestart was false. Fix deployed: 128 MiB heap, bounded autorestart (max 3).
  Host: 1 CPU, ~1.67 GiB, no swap.
- Core is deliberately stopped during every heavy AI worker run (chat-recovery: "Core app
  deliberately stopped for memory while worker"). The owner gets 502s whenever work is
  running.
- "23 PM2 restarts, cause unknown": not found in the repo records. They show restart
  count 10 and a diagnosed cause. Long-run reliability was never verified. Deployed app
  2809543, comparison fix not deployed: consistent with records. Not checked live (that
  needs hosted access).

## Part 3 verification
| Claim | Status |
|---|---|
| Branch/HEAD/worktree; root older; don't merge | Verified |
| Local WP 4474, six pages, candidate 129 | Verified (running, six pages, no content images) |
| Core review 131 = same content | Codex record only |
| Protected WP rev 6 (13 drafts, 2 images) | Codex record only (needs hosted read) |
| Protected Core build 2809543, comparison fix undeployed | Consistent with records; not live-checked |
| 23 restarts, cause unknown | Not supported by records; cause was diagnosed (see above) |
| Spend $14.91 / $15.27, requests exhausted, expiry Nov 22 15:58 UTC | Consistent with records |
| Reusable components exist (Pixabay, FPO component, delivery/rollback, contact, measurement) | Verified present in code |
