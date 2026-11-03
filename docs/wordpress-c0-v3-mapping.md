# WordPress mapping for accepted C0 v3 — first read-only slice

Status: design/prototype fixture, **not publishable**. Source: `scripts/customer-updates/miopages-focus-reviewed.json`, accepted `A Business in Focus / service-led v3` development state. Exporter: `scripts/export-wordpress-c0-v3-fixture.mjs`; output: `docs/wordpress-c0-v3-structural-fixture.json`.

## Verified fixture inventory

- Four pages: `/` (5 Sections; `arrival` recipe), `/service` (8; `service` recipe), `/experience` (5; `evidence` recipe), `/review` (5; `assessment` recipe); **23 total**.
- Existing section types encountered: `hero`, `intro`, `relationship`, `collection`, `cta`. Visual variations live in reviewed section presentation settings.
- Five sections use `source` bindings, rather than resolved public display text. Fixture represents these as `requires-canonical-projection`. They **must not** be rendered as arbitrary source JSON or silently omitted from a fidelity claim.
- The reviewed design system and selected page recipes are exported; approved wordmark **identity references only** are present. Asset bytes, approved-host URLs and media permission are not exported or presumed available.
- Five unresolved visual/media roles are noted; no FPO media, evidence, fake reports or functioning Review forms are authorized.
- Fixture explicitly says `publishable:false`. It does not grant content approvals, produce ready-to-publish HTML or connect to hosted Supabase.

## First WordPress design mapping (proposal, not implementation)

| Existing canonical object / renderer behavior | Proposed WP ownership | Notes/gate |
| --- | --- | --- |
| Managed Site design system, selected service-led v3 presentation | Versioned `miopages` theme settings and global CSS tokens | Retain palette, typography (Source Sans 3), spacing, page grammar, mobile appearance; don't emit ad hoc page CSS |
| Page routes and archetypes (`arrival`, `service`, `evidence`, `assessment`) | Plugin-owned managed page records plus theme templates/pattern grammar | Preserve exact routes and navigation; prevent regular editor writing to managed records |
| `hero` | `miopages/hero` dynamic Gutenberg block or theme component | Bounded props, optional verified media and approved actions |
| `intro` | `miopages/intro` | Text + constrained display variants; possible artifact/evidence presentation only with authorized media |
| `relationship` | `miopages/relationship` | Preserve continuity/stages, included scope, shared responsibilities and bounded graphic rules |
| `collection` | `miopages/collection` | Structured items; preserve canonical public-only projection and no private pricing |
| `cta` | `miopages/cta` | Resolve authorized local page destination by immutable Page ID; do not generate broken forms |
| Navigation and actions | Plugin-owned menu/site-shell components | Root-domain canonical URLs and relative link policy must be proven |
| Approved logos and future media | Protected WP media cache with source hashes and usages | Restore/ownership/right checks; refuse unresolved media |
| Approved versioned release | Plugin-side staged content plus active immutable release marker | Atomic activation mechanism and cache purge still need engineering proof |

The mapping to WordPress blocks is **provisional**: a dynamic block is an attractive controlled presentation unit, but final choice of Gutenberg blocks vs plugin-owned page templates must be tested for renderer fidelity, security and maintainability. Neither the block markup nor CSS is yet implemented.

## Read-only repository module map

- Frozen accepted data: `scripts/customer-updates/miopages-focus-reviewed.json`, guarded transition `scripts/customer-updates/miopages-focus.ts`; **do not run promotion against hosted 16-migration C0**.
- Public-approved knowledge/Offering expansion and binding refusal: `lib/platform/canonical/projections.ts`. WordPress release serialization should reuse authorization-gated projections rather than copy unapproved internal Offerings or inferred values.
- Visual presentation and semantics: `components/managed-sites/focus-page.tsx`, `focus-visual.tsx`, `presentation-page.tsx`, `lib/platform/presentation/plan.ts`, `app/focus-presentation.css`. These are reference behavior/specifications, **not PHP code to port verbatim**.
- Local visual verification: `scripts/review-miopages-canonical.mjs`, `scripts/preview-miopages-canonical.ts`, `docs/miopages-canonical-promotion.md`. Reference proof uses accepted canonical presentation, including intentionally absent unapproved imagery.

## Immediate technical gates

1. Execute `node scripts/export-wordpress-c0-v3-fixture.mjs` for a read-only inventory; use `--write` only intentionally to regenerate the tracked fixture and review the diff.
2. Inspect the precise canonical-projection and renderer interfaces and design a **public-only, immutable release serialization**. Structural fixture is deliberately inadequate for publication.
3. Resolve the five bound sections through reviewed canonical business data with the existing public-only authorization gates, not arbitrary values.
4. Verify real media bytes, permissions and presentation fallbacks, and specify stable navigation/action destinations.
5. Only then build a WordPress renderer that consumes the signed, approved publishable release and compare responsive results with the accepted v3 reference.

No live site, database or customer changes are authorized by this mapping.

## Canonical projection implementation checkpoint — 2026-11-02

A guarded **read-only** exporter now exists at `scripts/project-wordpress-c0-v3.ts`. It loads the frozen, reviewed `after` graph, imports the production `normalizeBinding` and `projectContent` functions, resolves the five source-bound sections using the corresponding public-approved Knowledge/Offering row, and refuses any null projection. It validates all four routes, 23 sections, page-targeted actions and navigation references, and marks its JSON output `publishable:false`. It does not request live DB access, write by default, or include managed asset bytes. The `--write` option emits the proposed `docs/wordpress-c0-v3-public-projection-fixture.json` only after execution and review.

**Validation limitation:** Repository source has been inspected and code committed through GitHub, but the new TypeScript script has **not been run against a local checkout** in this session. Its public projection fixture has therefore **not** been generated or marked validated. The existing structural fixture action and navigation target fields were corrected against the frozen graph, but a full local reproducibility test also remains pending.

**Next exact operator/developer action in a checkout with dependencies installed:** run `node --import tsx scripts/project-wordpress-c0-v3.ts`, confirm 4/23/5 and no refusal, run twice and compare digests; run `node scripts/export-wordpress-c0-v3-fixture.mjs --write` only after reviewing the changed tracked structural fixture; then `node --import tsx scripts/project-wordpress-c0-v3.ts --write`, audit public text and secrets/media refusals, and commit the generated file only after review. No hosted database credentials are needed.
