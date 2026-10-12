> Historical checkpoint. Current execution and accepted-state authority: [final C0 checkpoint](miopages-c0-checkpoint.md). Earlier commands, URLs and fingerprints below describe that stage only. Source links now point to retained successor tooling.

# MioPages C0: coherent first site draft

## Status and safe boundary

This continues the directionally accepted [Home preview](miopages-home-revamp.md).
It is a first customer-facing draft for one human editorial pass, not final copy,
visual acceptance, publication or authorization to change real MioPages. All
customer writes go to a newly created disposable schema. No commit/push is included.

The real complete customer-state fingerprint remains
`4758d79cea7a0ecb9019cc59b4fd8d824c2c8bdb845c37552e1b019c491cb980`.
The accepted source graph, Myomaton, all other customers, live migrations and
managed bytes must remain exact. Acquisition/QC history is read-only and no
candidate is generated, approved, ingested or attached.

## Draft inventory and Navigation

| Page | Route | Sections | Purpose and next step |
| --- | --- | --- | --- |
| Home | `/` | 6 | Integrated outcome, audience, model, example and starts; retains accepted progression. |
| What Is MioPages? | `/service` | 4 | Business knowledge becomes one managed presence; leads to What You Get. |
| What You Get | `/what-you-get` | 4 | Launch foundation and concrete continuing value; leads to Getting Started. |
| Getting Started | `/getting-started` | 5 | Review, two intended starts, shared knowledge, checked understanding, direction, launch and continuation. |
| Why MioPages? | `/experience` | 5 | Practical web experience, judgment, repetition, AI and business-focused design; leads to Getting Started. |
| Web Presence Review | `/review` | 5 | Free diagnosis/priorities/fit versus paid direction and delivery; leads to the explanatory journey. |
| Questions & Answers | `/faq` | 5 | Fifteen practical answers grouped into four substantive collections. |

Navigation: What Is MioPages?, What You Get, Getting Started, Why MioPages?, FAQ,
Review. The logo leads Home. Existing Navigation identity and its three item
identities are retained; three items are added. Six informational Actions connect
the draft, retaining the three existing identities and destinations. Existing
Service and Experience routes remain valid. There are no Account, Sign In,
Contact, Case Studies or empty demonstration Pages.

## Reuse and content movement

Every one of the 23 accepted Section identities is reused; eleven Sections are
added, for 34 total. Four existing Page identities are retained; three are added.
The existing Business Knowledge, Offering, components, prices, commercial terms,
Assets and AssetUsages retain their identities. The scoped writer adds one
Knowledge and one Offering revision, as in the Home preview. Their commercial
component fields are unchanged.

| Earlier material | Draft disposition |
| --- | --- |
| Service proposition and integrated stages | What Is MioPages? explains the model progressively; detailed stage terminology is reduced. |
| Service scope and pricing Sections | Reused on What You Get; describes an integrated result and fee structure without unconfirmed figures. |
| Service responsibility matrix | Reused in Getting Started as the customer's practical journey. |
| Service connected systems | Retained as coordinated service explanation; practical domain/email/system questions live in FAQ. |
| Service ownership binding | Section identity moves to FAQ ownership/exit/AI collection; no public copy is generated from backend terminology. |
| Experience judgment and historical-work placeholders | All five identities retained on Why; explanation replaces unsupported historical proof. |
| Review diagnosis, input context, next paths and invitation | All five retained; free/paid boundary and unavailable requests made explicit. |
| Home six-part progression and hypothetical training example | Retained, with small wording changes for consistency. |

The two Why historical-evidence VisualNeeds are retained as `priorVisualNeed`
metadata with a deferral reason. They are not current acquisition instructions for
the rewritten explanatory content. Home/Review visual needs remain unresolved;
production-safe omission continues. No FPO or candidate becomes a production Asset.

## Customer language and truthfulness

Write for a business owner: what the service does, what they receive, what they
need to contribute and what happens next. Outcomes lead; mechanics are explained
only where they help a decision. Human expertise, automation and guided AI have
clear roles without making AI the selling proposition. Decades of practical web
experience is operator-confirmed positioning, not a fabricated project history or
an assertion of measured superiority.

Home edits are deliberately limited: “bounded structure and presentation” becomes
“takes care of the website”; “tailored synthesis” becomes a summary to check;
“routine business evolution” becomes regular business updates; “search/discovery
foundation” becomes a foundation for search. The live Knowledge posture projection
uses ordinary language about people, repetition, responsibility and approval.
The page progression, Hero proposition and six Sections are retained. No detailed
line-by-line Home polish was attempted.

Detailed inclusions belong on What You Get, the journey on Getting Started,
model differentiation on Why, free/paid diagnosis boundaries on Review and
practical constraints on FAQ. Short connective summaries intentionally recur;
long mechanics, exclusion lists and invented proof do not.

Ongoing is more than maintenance: useful content, core-page changes, enquiry-path
improvements, stronger proof, regular business updates, reporting and refinement.
Exceptional focused campaigns may require separate scope. There are no publishing
quotas or guaranteed results. Claims and publication require customer approval.
The preview states that reporting and ongoing delivery are not active here.

Both starts are concepts with functioning informational navigation only. The
planned primary route is digital; assistance may lead to a conversation/callback.
Phone is not the primary channel and no personal/founder contact identity is shown.
There is no working form, booking, request submission or instant onboarding.

The fifteen FAQ topics cover changes, post-launch work, content marketing, future
major revamp, existing websites, domain, email, connected systems, management,
design control, agencies, builders, ownership, exit and AI. No new legal or
commercial terms are silently enacted: specific arrangements need agreement.

See It in Action remains the clearly labeled hypothetical example on Home. There
is insufficient verified material for a standalone demonstration or results Page.
No sample value report, synthesis or customer result is invented.

## Candidate content-editor capability — record only

After the human editorial pass, evaluate whether a bounded content editor would
help operators/customers edit approved copy, facts, service descriptions, FAQs,
articles and selected labels. It must preserve scope, ownership, version history
and authority boundaries appropriate to each role. It should not expose arbitrary
HTML/CSS, layout, fonts, spacing, breakpoints or unrestricted component assembly.

This is a candidate capability/gap, not an approved implementation requirement.
Existing structured storage and canonical writers are foundations; they do not
constitute a customer-facing content editor. Do not build it before actual editing
needs are reviewed. The CLI saves exact canonical-before and generated-draft JSON
as ignored local evidence. Human edits have not been received; a later comparison
can identify repeated editorial needs without guessing them now.

## Visual approach, tooling and validation

Source Sans 3, managed wordmarks, purple/violet/lavender, warm paper and peach,
restrained fields and motion-off remain. All draft Pages opt into the existing
overview recipe from the Home slice. Tonal and brand Heroes help distinguish page
purposes; two/three-column collections organize real content and stack on mobile.
No new renderer, styling controls or visual language is introduced by this slice.

The [shared fixture](../scripts/customer-previews/miopages-c0-fixture.ts) retains
its default Home-only mode and adds an explicit site-draft mode. It accepts no
public-write mode or caller-supplied schema, refuses source drift, copies the
owned graph and immutable managed bytes, and replays migrations only in its own
random schema. Renderer and source connections are read-only. Shutdown removes
only that self-created schema and verifies public preservation.

Build, then run the [draft CLI](../scripts/preview-miopages-c0.ts):

```powershell
node --import tsx --env-file=.env.local scripts/preview-miopages-site-draft.ts
```

Receipt, editorial baseline, logs and inspection evidence are ignored under
`runtime-content/miopages-site-draft/`. Reusable source stays in scripts/tests.
Check seven-route serving, every link/Action, one H1 per Page, complete Section
projection, preview disclosures, free/paid boundaries, all 15 FAQ entries,
backend-language leakage, absent forms/workflows, foreign/proposed media refusal,
unchanged Assets/bytes and public-state preservation. Run focused and standard
tests, lint, explicit type-check, build, whitespace/documentation checks and
disposable PostgreSQL tests. Inspect all Pages at desktop and narrow mobile, with
tablet checks for Navigation and dense collections.

Classification: A content/positioning rewrite; B three substantive Pages,
Navigation and content reassignment; C reuse/refinement of the accepted direction.
D records the candidate editor only. No editor or new customer workflow is built.
Live Review, prospect persistence/synthesis, Contact activation, onboarding,
accounts, durable approvals, billing, reporting/measurement ingestion, opportunity,
Campaign and Revamp runtime remain unimplemented by this task.

## Rendered checkpoint, 2026-10-10

The running draft receipt identifies `http://127.0.0.1:55807` and disposable schema
`canonical_test_a4acd288909a486fb63de31b1d57e465_home_revamp`. The scoped fingerprint
is `11becfcd15be418811f7b632337b6baa006fcdd2d02bb6f109d21e7495cf0243`.
The port/schema are local evidence, not stable deployed destinations.

Agent browser inspection covered every Page at 1440px desktop and 360px mobile:

| Page | Desktop height | Narrow mobile height |
| --- | --- | --- |
| Home | 3196px | 5260px |
| What Is MioPages? | 2251px | 3163px |
| What You Get | 2426px | 3659px |
| Getting Started | 2678px | 3863px |
| Why MioPages? | 2562px | 3643px |
| Web Presence Review | 2586px | 3660px |
| Questions & Answers | 3005px | 5508px |

No horizontal overflow was observed; each Page has one H1. Tablet checks at 768px
covered the three-column scope content, FAQ and expanded Navigation. At 1100px the
existing header wraps Navigation below the wordmark cleanly; narrow screens use
the existing menu. The menu expands, its six destinations fit and its Getting
Started link was followed successfully. Desktop Navigation/active states and
existing logos remain usable. All informational links resolve in the HTTP checks.

Page roles are distinct and substantive. Purple/tonal Heroes and connected fields
keep the accepted language, with two/three-column summaries stacking on mobile.
Remaining editorial review points: Home and FAQ are long on a phone; preview
disclosures add repeated text; the shared footer keeps the earlier Launch/care
signoff. The scope summaries recur deliberately, while detailed journey, free/paid
boundary and practical answers have dedicated destinations. No human visual or
editorial acceptance is asserted.

Validation: 212 standard tests pass, including five Home/site focused tests.
Ten distinct relevant PostgreSQL checks pass across the completed regression run
and affected rerun (Home/site, promotion, business-focus and Myomaton v2).
Production build, explicit type-check, lint, whitespace and documentation checks
pass. Initial disposable-writer attestation mismatch was corrected; its affected
tests were rerun successfully. Standard tests initially hit a Windows sandbox
temporary-path error and passed outside that sandbox. Full lint had two unused
variable warnings; the variables/Action use were corrected and focused lint is
clean. No product behavior was weakened to make validation pass.

Final read-only verification confirmed the real fingerprint above, unchanged
accepted MioPages, Myomaton and all other customers, all nine live migrations,
managed bytes and the existing acquisition pilot fingerprint
`d53b46adeca3c487ec5544d27e90a8abbec70b704628fadf8bde8a9f27f5169a`.
The scoped draft fingerprint also remained exact after browser inspection.

## Source inventory and stop state

This continuation adds five files and extends the existing disposable fixture:

- `docs/miopages-site-draft.md`
- `scripts/customer-previews/miopages-site-draft.ts`
- `scripts/preview-miopages-site-draft.ts`
- `tests/miopages-site-draft.test.tsx`
- `tests/integration/miopages-site-draft.test.ts`
- `scripts/customer-previews/miopages-home-fixture.ts` (extended; Home-only default retained)

Including the preceding Home slice, the full working-tree inventory is fourteen
paths: those six plus:

- `app/focus-presentation.css`
- `components/managed-sites/focus-page.tsx`
- `lib/platform/presentation/plan.ts`
- `docs/miopages-home-revamp.md`
- `scripts/customer-previews/miopages-home-revamp.ts`
- `scripts/preview-miopages-home-revamp.ts`
- `tests/miopages-home-revamp.test.tsx`
- `tests/integration/miopages-home-revamp.test.ts`

All are unstaged: three tracked modifications and eleven untracked source files.
Runtime output remains ignored. No real customer application, commit or push.
The full draft is left running for the human editorial pass.
