# Accepted MioPages C0 revamp implementation checkpoint

## Accepted scope

The operator accepted the isolated C0 revamp for this stage, with one correction:
**Help the right people find you online. Make contacting you a breeze.**
The [curated accepted content](../scripts/customer-previews/miopages-c0-accepted.json)
matches the accepted structured draft's content, configuration and destinations
exactly, except for this required Home Hero correction. Local comparison evidence
is ignored under `runtime-content/miopages-finalization/`. This is stage acceptance,
not approval to apply the revamp to real MioPages or publish operational workflows.

Home remains available through the logo. Header and footer use Why MioPages? →
`/service`, What You Get → `/what-you-get`, How It Works → `/getting-started`,
Questions & Answers → `/faq`, and the final highlighted Get Your Free Review →
`/review`. `/start` is contextual, not Navigation. `/experience` is inactive/404;
production redirect continuity remains a later transition decision.

Review has two disabled, non-submitting Start My Free Review controls and optional
direct-start/continuation links to Start. Start describes qualification, scope,
commercial agreement, deeper paid onboarding, approved direction, build/review,
launch and Ongoing. How It Works remains explanation. Support remains subordinate.
No Review persistence, prospect records, intake, payment, accounts, onboarding or
operator-assistance workflow is implemented. The progressive information-reuse
requirement remains documented in the [conversion-surface learning](miopages-conversion-surfaces.md).

## One reproducible execution path

Run from a checkout with dependencies, local PostgreSQL configuration and the
existing canonical managed Assets:

```powershell
npm run build
node --env-file=.env.local --import tsx scripts/preview-miopages-c0.ts
```

The [builder](../scripts/customer-previews/miopages-c0.ts) consumes curated content,
stable customer identities/configuration and the current canonical baseline. It
does not depend on earlier preview scripts, running servers, Word files, receipts
or generated state. The source manifest is intentionally not a database dump:
it excludes versions, run timestamps, applied-state receipts, logs and transient
metadata. Business Knowledge/Offering payloads retain their accepted evidence.
The [human R3 copy authority](../scripts/customer-previews/miopages-editorial-r3.json)
is retained for provenance and the fifteen-answer FAQ regression.

The [fixture](../scripts/customer-previews/miopages-c0-fixture.ts) snapshots all real
customers/migrations read-only, verifies current canonical MioPages matches its
committed baseline, creates a random isolated `_preview` schema and copies only
MioPages into it. All draft writes and canonical business reconciliation occur
there. Existing canonical identities remain; superseded canonical Sections and
Navigation items remain inactive history. Disposable-only obsolete Sections and
unused label variants are not recreated. Assets are copied into a temporary
media root and real bytes are verified unchanged.

The [runner](../scripts/preview-miopages-c0.ts) starts a read-only production server
with the existing explicit preview gate, validates exact structured rendering,
Navigation, CTAs, legacy refusal and workflow/media refusal, and prints its URL.
It writes only ignored local evidence to `runtime-content/miopages-c0/`.
Stopping it removes only its own fresh isolated schema. It offers no real-customer
application mode. Existing earlier preview owners/evidence are not dependencies.

## Reusable platform support

Four existing source files retain bounded generic capabilities:

- [Presentation plan](../lib/platform/presentation/plan.ts): explicit overview
  recipe restricted to service-led v3; older recipes stay pinned.
- [Focus stylesheet](../app/focus-presentation.css): recipe-scoped readable overview
  typography, responsive two/three-column collections and existing spacing/palette.
- [Focus renderer](../components/managed-sites/focus-page.tsx): overview collection
  columns and disabled prototype controls behind the explicit disposable gate.
- [Section normalizer](../lib/platform/managed-sites/sections.ts): bounded Hero/CTA
  prototype-control label; ordinary production omits these controls.

No MioPages route, customer ID or copy is embedded in generic runtime code.
The temporary `_home_revamp` gate expansion was reverted: final tooling uses the
already-established `_preview` schema convention, retaining the original gate.
No CSS/design changes are introduced during finalization.

## Reconciliation inventory

Every one of the 37 dirty source paths at task entry is classified below.
A = final required implementation; B = final test/documentation; C = superseded
preview implementation. No ambiguous (E) files were found. Ignored generated
screenshots, Word/text exports, receipts and runtime evidence are D and excluded
from Git; they are retained locally because they document acceptance or belong
to existing preview owners. No generated runtime source is staged.

The 25 obsolete untracked code/test paths were removed only after reference
inspection, accepted-content comparison and creation of the final replacements.
They recreate obsolete intermediate states or depend on sequential local receipts.
Historical documents remain, explicitly marked historical with links repaired to
successor tooling. Their earlier names/commands/URLs/fingerprints describe history.
An ignored pre-reconciliation archive preserves recoverability. Existing canonical
C0 establishment tests remain untouched; final revamp tests have distinct names.

Five final source/test files plus the curated JSON and this document replace the
25 obsolete paths. Focused final tests are
[unit/rendering tests](../tests/miopages-c0-revamp.test.tsx) and
[PostgreSQL/production tests](../tests/integration/miopages-c0-revamp.test.ts).
They retain meaningful identity, copy, FAQ, layout-version, safety-gate, CTA,
cross-customer asset and real-state preservation coverage instead of assertions
about superseded editorial variants.

Final validation, rendered verification, safety fingerprints and retained-file
inventory are recorded below before staging. No real customer transition is part
of this checkpoint.

| Original path | Class | Disposition / reason |
| --- | --- | --- |
| `app/focus-presentation.css` | A | Bounded reusable layout/preview capability required by accepted result |
| `components/managed-sites/focus-page.tsx` | A | Bounded reusable layout/preview capability required by accepted result |
| `lib/platform/managed-sites/sections.ts` | A | Bounded reusable layout/preview capability required by accepted result |
| `lib/platform/presentation/fpo.ts` | C | Revert temporary suffix expansion; fresh standard preview gate suffices |
| `lib/platform/presentation/plan.ts` | A | Bounded reusable layout/preview capability required by accepted result |
| `docs/miopages-conversion-story.md` | B | Historical architecture and review provenance; mark historical and repair successor links |
| `docs/miopages-conversion-surfaces.md` | B | Historical architecture and review provenance; mark historical and repair successor links |
| `docs/miopages-editorial-r3.md` | B | Historical architecture and review provenance; mark historical and repair successor links |
| `docs/miopages-home-revamp.md` | B | Historical architecture and review provenance; mark historical and repair successor links |
| `docs/miopages-ia-simplification.md` | B | Historical architecture and review provenance; mark historical and repair successor links |
| `docs/miopages-site-draft.md` | B | Historical architecture and review provenance; mark historical and repair successor links |
| `scripts/customer-previews/miopages-conversion.ts` | C | Sequential mapping/receipt-dependent runner replaced by declarative accepted fixture and fresh-schema runner |
| `scripts/customer-previews/miopages-editorial-r3.json` | B | Human R3 copy authority and FAQ regression fixture |
| `scripts/customer-previews/miopages-editorial-r3.ts` | C | Sequential mapping/receipt-dependent runner replaced by declarative accepted fixture and fresh-schema runner |
| `scripts/customer-previews/miopages-home-fixture.ts` | C | Sequential mapping/receipt-dependent runner replaced by declarative accepted fixture and fresh-schema runner |
| `scripts/customer-previews/miopages-home-revamp.ts` | C | Sequential mapping/receipt-dependent runner replaced by declarative accepted fixture and fresh-schema runner |
| `scripts/customer-previews/miopages-ia.ts` | C | Sequential mapping/receipt-dependent runner replaced by declarative accepted fixture and fresh-schema runner |
| `scripts/customer-previews/miopages-site-draft.ts` | C | Sequential mapping/receipt-dependent runner replaced by declarative accepted fixture and fresh-schema runner |
| `scripts/customer-previews/miopages-surfaces.ts` | C | Sequential mapping/receipt-dependent runner replaced by declarative accepted fixture and fresh-schema runner |
| `scripts/preview-miopages-conversion.ts` | C | Sequential mapping/receipt-dependent runner replaced by declarative accepted fixture and fresh-schema runner |
| `scripts/preview-miopages-editorial-r3.ts` | C | Sequential mapping/receipt-dependent runner replaced by declarative accepted fixture and fresh-schema runner |
| `scripts/preview-miopages-home-revamp.ts` | C | Sequential mapping/receipt-dependent runner replaced by declarative accepted fixture and fresh-schema runner |
| `scripts/preview-miopages-ia.ts` | C | Sequential mapping/receipt-dependent runner replaced by declarative accepted fixture and fresh-schema runner |
| `scripts/preview-miopages-site-draft.ts` | C | Sequential mapping/receipt-dependent runner replaced by declarative accepted fixture and fresh-schema runner |
| `scripts/preview-miopages-surfaces.ts` | C | Sequential mapping/receipt-dependent runner replaced by declarative accepted fixture and fresh-schema runner |
| `tests/integration/miopages-conversion.test.ts` | C | Intermediate assertions replaced by final C0 unit/integration coverage |
| `tests/integration/miopages-editorial-r3.test.ts` | C | Intermediate assertions replaced by final C0 unit/integration coverage |
| `tests/integration/miopages-home-revamp.test.ts` | C | Intermediate assertions replaced by final C0 unit/integration coverage |
| `tests/integration/miopages-ia.test.ts` | C | Intermediate assertions replaced by final C0 unit/integration coverage |
| `tests/integration/miopages-site-draft.test.ts` | C | Intermediate assertions replaced by final C0 unit/integration coverage |
| `tests/integration/miopages-surfaces.test.ts` | C | Intermediate assertions replaced by final C0 unit/integration coverage |
| `tests/miopages-conversion.test.tsx` | C | Intermediate assertions replaced by final C0 unit/integration coverage |
| `tests/miopages-editorial-r3.test.tsx` | C | Intermediate assertions replaced by final C0 unit/integration coverage |
| `tests/miopages-home-revamp.test.tsx` | C | Intermediate assertions replaced by final C0 unit/integration coverage |
| `tests/miopages-ia.test.tsx` | C | Intermediate assertions replaced by final C0 unit/integration coverage |
| `tests/miopages-site-draft.test.tsx` | C | Intermediate assertions replaced by final C0 unit/integration coverage |
| `tests/miopages-surfaces.test.tsx` | C | Intermediate assertions replaced by final C0 unit/integration coverage |

## Final verification before staging

All seven active Pages were inspected at 1440px desktop and 360px mobile. The
exact restored Hero is visible, primary/secondary/support hierarchy is unchanged,
header/footer Navigation is correct and mobile menu keeps Review last. No stale
Development preview labels, obsolete /experience links, horizontal overflow or
text/control clipping were found. Home → Review → Start and Home → Start links
were clicked; Review controls remain disabled. This verifies the already accepted
direction without claiming new human acceptance. Screenshots/metrics stay ignored.

Passed: five focused unit/rendering tests; 212 standard tests (zero skips); final
PostgreSQL fixture test plus existing C0 establishment, promotion and business-focus
isolation regressions (13 checks across four suites); full lint; standalone
type-check; production build; documentation links; strict UTF-8 and whitespace
checks. Thirteen intermediate unit assertions were replaced by five final-focused
tests, explaining the standard count change from 220 to 212. The initial fixture
check caught an approval-attestation mismatch; retaining the accepted payload's
original approval identity corrected it, and the final fixture rerun passed.

Read-only before/after safety: real MioPages, Myomaton, every other customer, nine
live migration rows and five managed Asset objects/bytes remain unchanged. Complete
real customer-state fingerprint:
`4758d79cea7a0ecb9019cc59b4fd8d824c2c8bdb845c37552e1b019c491cb980`.
Current isolated fingerprint:
`ecf603a59749e9f746dbb3e4042e34307510ca19e65a3a70bea55c2c4be84956`.
Running preview: `http://127.0.0.1:62349/` (runner owns only its fresh disposable schema).
No real-customer transition or operational workflow was implemented.

The fetched main and origin/main were synchronized before commit. No unrelated
dirty work or ambiguous files remain. Runtime receipts, logs, media, archives and
exports are excluded. The reviewed source checkpoint contains exactly these
18 files (four modified tracked files and fourteen additions):

- `app/focus-presentation.css`
- `components/managed-sites/focus-page.tsx`
- `docs/miopages-c0-checkpoint.md`
- `docs/miopages-conversion-story.md`
- `docs/miopages-conversion-surfaces.md`
- `docs/miopages-editorial-r3.md`
- `docs/miopages-home-revamp.md`
- `docs/miopages-ia-simplification.md`
- `docs/miopages-site-draft.md`
- `lib/platform/managed-sites/sections.ts`
- `lib/platform/presentation/plan.ts`
- `scripts/customer-previews/miopages-c0-accepted.json`
- `scripts/customer-previews/miopages-c0-fixture.ts`
- `scripts/customer-previews/miopages-c0.ts`
- `scripts/customer-previews/miopages-editorial-r3.json`
- `scripts/preview-miopages-c0.ts`
- `tests/integration/miopages-c0-revamp.test.ts`
- `tests/miopages-c0-revamp.test.tsx`
