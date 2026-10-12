> Historical checkpoint. Current execution and accepted-state authority: [final C0 checkpoint](miopages-c0-checkpoint.md). Earlier commands, URLs and fingerprints below describe that stage only. Source links now point to retained successor tooling.

# MioPages isolated conversion surfaces

## Authority and boundary

The operator requested visible, reviewable conversion surfaces on the current
[isolated IA draft](miopages-ia-simplification.md). This is a prototype, not
authorization to implement Review submission, intake persistence, commercial
transactions or onboarding. Real customer state remains untouched. The
[pure mapping](../scripts/customer-previews/miopages-c0.ts) is applied by an
[isolated transaction runner](../scripts/preview-miopages-c0.ts) requiring
the exact prior fingerprint and refusing public schemas. Earlier receipts remain
historical; current evidence lives in ignored `runtime-content/miopages-surfaces/`.

## Public content and controls

Home's Hero heading becomes “Help the right people find you online.” The eyebrow
becomes “Managed Web Presence”; the generic development-preview paragraph is
removed. Other Home prose and conversion hierarchy remain intact. Its secondary
“Ready to start now?” Action now targets `/start` instead of `/getting-started`.
Its closing still correctly references How It Works as an explanation.

Review remains `/review`. Its existing concise, cost-free, no-paid-commitment
meaning and assessment items remain. One sentence makes tailoring and initial
direction explicit; goals are added to the prospect information paragraph.
Its generic development-preview disclosure is removed. “Start My Free Review”
appears as a disabled, non-submitting button in the Hero and again near the end,
after the assessment/continuation/commercial distinction. One note near the latter
says: “This preview control is disabled. No information is collected or submitted.”
The native disabled controls also have an explanatory title; there are no forms
or input fields. Neither button initiates navigation, submission or persistence.

The Hero's subordinate link becomes “Ready to get started now?” → `/start`.
The existing “What happens if I continue?” link also moves to `/start`. A separate
lower-priority direct-start Section follows the primary closing, explaining the
optional Review bypass, with “Start Now” → `/start`. No separate assistance
purchase funnel is introduced.

The new isolated **Start MioPages** Page at `/start` has three Sections:

1. Brief readiness introduction and a single truthful availability statement.
2. After-Review and direct-start entry conditions: reuse known information versus
   first establish foundational business information.
3. Eight steps: business information; fit/scope and Launch complexity; Launch cost
   and service terms; deeper intake after commercial commitment; confirmed
   understanding and proposed direction; build/review; launch; Ongoing improvement.

No final prices or terms are invented. No form, submit, payment or onboarding
control exists on Start. It explains the intended entry workflow for review.

How It Works remains the informational `/getting-started` Page. Lower copy is
unchanged. Its Hero now offers primary Free Review and secondary direct start,
using existing Hero treatments, and drops the generic development disclosure.
It explains the process; Start represents where future qualification/onboarding
would occur. Scope/inclusions and all 15 FAQ answers remain unchanged. The FAQ
“See How It Works” link still correctly points to the explanation.

Header/footer retain Why MioPages?, What You Get, How It Works, Questions & Answers,
and the final Get Your Free Review. Start is contextual, never a Navigation item.
Home remains accessible through the logo.

`/experience` uses the existing inactive Page status in the isolated schema and
returns 404. Its record and Sections are retained; no visitor links target it.
The platform reader already filters inactive Pages. This supports retirement,
not a redirect. Eventual production `/experience` → `/service` continuity is
preferred, but no redirect infrastructure or real Page change is made here.

## Progressive information architecture

The C0 work distinguishes three responsibilities:

| Surface | Responsibility |
| --- | --- |
| How It Works | Explanatory content |
| Free Review | Pre-sale conversion workflow |
| Start MioPages | Commitment and paid-onboarding entry workflow |

These are stages of one progressive information model, not separate duplicate
intake systems. The future Free Review path is minimal business information →
Review → prospect elects to continue → reuse known information → collect only
missing scope/qualification details → scope/commercial commitment → deeper paid
onboarding. Direct start establishes foundational information first, then joins
the same fit/scope → commercial commitment → deeper missing information path.

**Never ask the customer to provide information the system already has unless it
needs confirmation because it may have changed.** Review-to-Start continuity,
known/missing information tracking and confirmation of changed facts are future
platform requirements. Entry-state detection and actual information reuse are
not implemented by this prototype. `/start` explains both states; clicking a link
does not claim that a Review occurred or that information is already stored.

## Bounded presentation capability

The Section normalizer accepts a bounded `previewControlLabel` for Hero/CTA;
the Focus renderer emits a native disabled `type="button"` only behind the
existing explicit disposable-preview gate. Production-safe rendering omits it.
The gate now also recognizes the established `_home_revamp` disposable schema
suffix, still requiring an exact matching read-only database search path and
operator preview environment variable. Public schemas, ordinary deployments and
write-enabled connections remain refused. Existing FPO controls share that gate;
the current draft has no previewMedia slots, so no visuals are newly exposed.
No new Action type, submission endpoint, database migration or CSS is introduced.

The accepted Visual Direction, typography, palette, compositions and spacing
remain. Review uses existing primary button styling, secondary Hero links and
lower-page direct-start placement. This does not imply human visual acceptance.

## Validation

[Focused tests](../tests/miopages-c0-revamp.test.tsx) cover preservation,
contextual start routes, non-mutating mapping, disabled controls and refusal
outside the preview gate. The [PostgreSQL test](../tests/integration/miopages-c0-revamp.test.ts)
checks stale-state rollback, exact rendered structured copy, disabled buttons,
all seven active routes, retired-route 404, unchanged Navigation, unavailable
submission and quarantined media, and real customer/managed-Asset preservation.

Final running URL, fingerprints, rendered review findings and validation results
are recorded below after verification. No commit, push or real-customer application.

## Completed review checkpoint

Current rebuilt preview: `http://127.0.0.1:55459/`, with `/review`, `/start`,
`/getting-started` and the other active Pages. It reuses the same isolated draft
schema; the new server explicitly opts into the read-only preview gate. The old
62298 server is not the review target because it predates the prototype controls.
The original schema-owner process remains alive; this server does not own or
delete the draft schema. Preview server owner: runner session 27698.

Home, Review, Start, How It Works and the informational Why MioPages Page were
inspected at 1440px desktop and 360px mobile. No horizontal overflow or clipped
copy/control labels was found. The primary Free Review remains prominent, while
direct start stays a contextual secondary choice. Review now visibly invites
conversion; the two primary buttons are natively disabled and do not submit.
The lower direct-start Section follows the repeated primary control. Start
explains reuse and qualification without adding another marketing pitch. The
eight-step mobile outline is readable; desktop uses the existing two-column
collection. Some journey wording overlaps How It Works intentionally to explain
the entry context; no repeated data-entry forms exist. These are agent findings,
not human acceptance.

Clicked successfully: Home → Review → Start, Home → Start, Why MioPages → Review
→ Start, and mobile Navigation → Review → contextual Start. Mobile Navigation
retains the exact five destinations and excludes Start. Disabled-control
availability was also checked in the browser. All seven active Page responses,
structured content and links are attested; `/experience` returns 404.

Validation passed: 220 standard tests (zero skips), two focused tests (also rerun
after a test-only DOM type annotation correction), one affected PostgreSQL check,
targeted lint, standalone type-check, production build, 28 documentation links
and whitespace checks. The initial sandboxed build hit Windows path-access
denial; the permitted rerun built successfully. A subsequent build type check
identified the test-only annotation, which was corrected before the final
successful build. No runtime fix was needed for either environment/type issue.

Final read-only verification confirms real MioPages, Myomaton, all other
customers, all nine migration rows and all five managed Asset objects/bytes are
unchanged. Complete real customer-state fingerprint:
`4758d79cea7a0ecb9019cc59b4fd8d824c2c8bdb845c37552e1b019c491cb980`.
Current isolated fingerprint:
`c1c23c2e5814e28c30a5aaf468841cab4d45a5089268b5d4663e96b672048b6e`.

The three existing source files changed by this task are the Focus renderer,
Section normalizer and disposable preview gate. All 339 other pre-existing file
hashes remain exact. Five source/test/document files are added by this task.
Git status contains five tracked modifications (including prior CSS/plan work)
and 32 untracked source files, 37 paths total. Zero staged files; generated
receipts and screenshots remain ignored. No commit or push.
