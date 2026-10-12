> Historical checkpoint. Current execution and accepted-state authority: [final C0 checkpoint](miopages-c0-checkpoint.md). Earlier commands, URLs and fingerprints below describe that stage only. Source links now point to retained successor tooling.

# MioPages isolated R3 conversion-story refinement

## Authority and scope

The operator's conversion-story brief authorizes this bounded overlay on the
human-reviewed R3 draft, including the corrected Home CTA checkpoint. It does
not replace the [R3 copy authority](miopages-editorial-r3.md) or authorize a broad
rewrite. The [pure mapping](../scripts/customer-previews/miopages-c0.ts)
changes conversion placements and the minimum buying-stage explanation. The
[runner](../scripts/preview-miopages-c0.ts) requires the exact current
isolated fingerprint and refuses public-schema writes. Existing production
runtime and the running preview are reused. No intake, forms, booking, payment,
onboarding, editor, media acquisition or platform behavior is implemented.

## Hierarchy and destinations

Primary: **Get Your Free Web Presence Review** → `/review`.
Secondary: **Ready to start now?** → `/getting-started`.
Support: **Questions or need help? Talk to us.** appears as explanatory text,
with availability explicitly qualified; it is not an equal purchase button.

| Placement | Before | After |
| --- | --- | --- |
| Home Hero primary | Explore the cost-free Review → `/review` | Get Your Free Web Presence Review → `/review` |
| Home Hero secondary | How MioPages Delivers Results → `/service` | Ready to start now? → `/getting-started` |
| Home closing | Start the Online Review and Contact an Operator → `/review` | One primary Free Review → `/review`, with direct-start and assistance explained in prose |
| What Is MioPages? ending | See What You Get → `/what-you-get` | Free Review → `/review` |
| What You Get Hero/ending | See How Getting Started Works → `/getting-started` | Free Review → `/review` |
| Why MioPages? ending | See How Getting Started Works → `/getting-started` | Free Review → `/review` |
| FAQ ending | No closing CTA Section | Standard closing CTA: Free Review → `/review` |
| Review Hero | See How Getting Started Works → `/getting-started` as primary | Already ready to get started? → `/getting-started` as secondary |
| Review usefulness explanation | No Section CTA | What happens if I continue? → `/getting-started` |
| Getting Started Hero | Explore the Web Presence Review → `/review` as primary | Get Your Free Web Presence Review → `/review` as secondary |

What Is MioPages? and Why MioPages? retain their informational Hero links to
What You Get, because scope/inclusions help decide whether the service fits.
The service Page retains its contextual Why MioPages? link. FAQ retains its
Getting Started Hero link because the journey helps answer practical questions.
Shared Navigation/footer and all existing Action records remain unchanged.
Four additional label-specific Actions reference existing Page identities.
Not every Page receives both conversion choices.

## Bounded copy and structure changes

Home Hero prose and all four intervening Sections are unchanged. Its closing
retains the first R3 sentence, removes the two competing assistance-method
cards, explains the normal Review and optional direct start, and gives support
language. The closing retains its Section identity/configuration and uses the
existing CTA Section capability. FAQ gains one standard closing CTA Section;
all fifteen answers and existing Section identities remain intact. No CSS or
layout capability is introduced. The service ending heading changes to “See where MioPages could
help.” to match its new destination. Other service/inclusions/experience/FAQ
body copy and all fifteen FAQ answers are unchanged.

Review retains all five Sections, the input-information paragraph, assessment
items and usefulness explanation. Its Hero explicitly states that the Review
is cost-free and creates no commitment to paid work. Its ending explains fit,
scope and price confirmation before paid onboarding. The direct-start bypass
is subordinate; the continuation link explains what happens after a Review,
without pretending to submit one.

Getting Started is the principal buying-stage copy change: its Hero explains
proceeding after a Review or skipping it, with fit/scope/price confirmation
before commitment. Its former self-service/operator cards become the two
starting stages, with foundational information → fit/scope → commercial
commitment → paid onboarding explicit for direct start. The old mandatory-Review
intro becomes support within the same process. Its final Section introduces
paid onboarding and preserves all four R3 deeper-journey items verbatim:
understanding → approved direction → build/review/launch → Ongoing.

All Page identities/routes, existing Section identities/order/status, Navigation, Visual
Direction, configuration, typography, spacing, palette, logos, Assets, Knowledge
and Offering remain unchanged. No other destinations are changed. Existing
obsolete label Actions remain as history and are not rendered.

## Truthful preview

Home, Review and Getting Started retain exactly:

> Development preview: Review requests, operator assistance and onboarding are not yet open.

Home's approved development-preview eyebrow remains. Assistance prose says
“When requests open” and does not advertise a live contact channel. Conversion
links lead to informational Pages. Getting Started describes future fit/scope
and commercial commitment without payment or intake controls. Contact submission
remains refused; acquisition-candidate delivery remains refused.

## Verification and review

[Focused tests](../tests/miopages-c0-revamp.test.tsx) cover preservation,
destinations, disclosures, direct-start safeguards and unchanged R3 substance.
The [PostgreSQL check](../tests/integration/miopages-c0-revamp.test.ts) verifies
stale-baseline refusal, transactional attestation, all seven production-rendered
Pages, exact structured copy/links and real-customer preservation. Local
checkpoint and browser evidence are ignored under `runtime-content/miopages-conversion/`.

Human visual acceptance and publication remain unauthorized. No commit or push.
The existing collection reader does not resolve Section-level Actions. The FAQ
closing uses a standard CTA Section and Review's continuation uses its existing
intro Section. This is an existing content-placement limitation, not a need for
new styling or a reason to change the reusable renderer in this task.
Completed validation, responsive review and real-state fingerprints follow below.

## Completed checkpoint

All seven Pages were inspected at 1440px desktop and 360px narrow mobile. The
primary filled Review button and secondary direct-start text link are clearly
distinct. Home repeats only its primary conversion near the end; help is plain
support text. The long primary label fits mobile. Home's existing full Hero
introduction still precedes its actions on mobile; the Review is available in
that Hero without requiring the remaining Page. No overflow or text clipping was
found. FAQ remains readable and its closing CTA is separate from the answers.
Normal Home → Review → Getting Started, direct Home → Getting Started, and FAQ
closing → Review were clicked successfully. Other CTA links were checked against
all seven rendered Pages. These are agent findings, not human visual acceptance.

Validation passed: 216 standard tests (zero skips), four focused conversion/R3
tests, one focused PostgreSQL integration check, standalone type-check, targeted
lint, documentation checking (25 working-tree paths, 17 links), and whitespace
checking. Initial standard runs hit sandbox `realpath` permission failures in
four existing managed-storage tests; the unrestricted rerun passed all 216.
The existing successful production build/server was reused because no runtime,
renderer, stylesheet, dependency or build configuration changed.

Real MioPages, Myomaton, every other customer, all nine migration rows and managed
Asset rows/bytes remain unchanged. Complete real customer-state fingerprint:
`4758d79cea7a0ecb9019cc59b4fd8d824c2c8bdb845c37552e1b019c491cb980`.
Scoped preview fingerprint:
`cae40c204a82532950e3021fcec28fc6c1cbb3ee7e492338bf761452007597be`.
Preview remains running at `http://127.0.0.1:62298/` in the same disposable schema.
The pre-conversion R3 receipt remains historical evidence; the current overlay
receipt is `runtime-content/miopages-conversion/checkpoint.json` (ignored).
The original schema-owner process must remain alive to retain the draft.

Exactly five source additions belong to this task: this document and the four
source/test files linked above. All 332 pre-existing source-file hashes are
unchanged. Git status is 25 unstaged paths: three pre-existing modified files and
22 untracked source files, including these five additions. Zero staged files;
no commit or push. Generated checkpoint, logs, screenshots and test temporary
objects remain ignored local evidence.
