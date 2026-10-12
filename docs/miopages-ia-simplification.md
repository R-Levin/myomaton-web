> Historical checkpoint. Current execution and accepted-state authority: [final C0 checkpoint](miopages-c0-checkpoint.md). Earlier commands, URLs and fingerprints below describe that stage only. Source links now point to retained successor tooling.

# MioPages isolated IA and conversion simplification

## Authority and surviving structure

This bounded operator-requested overlay follows the [conversion checkpoint](miopages-conversion-story.md)
and [approved R3 editorial draft](miopages-editorial-r3.md). It changes disposable
customer data only. The [mapping](../scripts/customer-previews/miopages-c0.ts) and
[runner](../scripts/preview-miopages-c0.ts) require the exact prior isolated state;
the transaction refuses public schemas and attests the entire resulting graph.

The surviving explanatory Page is **Why MioPages?**, preserving `/service` and
its Page identity. Six Sections explain the managed service, customer business
knowledge and discovery/conversion, human judgment/automation/guided AI, fewer
handoffs and customer approval, outcome-focused design, and the next step.

Three existing differentiation Sections move from `/experience` with their
identities, items and compositions intact. Its experience paragraph joins the
human/automation/AI introduction. The old `/service` coordination paragraph moves
there too; its approval paragraph joins the coordinated-system explanation.
The redundant service coordination Section becomes inactive. The R3 experience
closing replaces the redundant service closing, retaining the surviving closing
identity and its Free Review destination. All selected R3 body wording is intact.

`/experience` remains technically present with one existing Hero repurposed as:
“Why MioPages?” / “The MioPages explanation is now available in one place.” /
“Why MioPages?” → `/service`. No duplicate explanation remains there. Its former
closing is inactive; its navigation item is inactive. All Actions formerly
targeting that Page now target `/service`, including unused historical Actions.
No Page is deleted. No established preview redirect helper was found, so no
automatic redirect or new redirect infrastructure was introduced.

## Navigation and conversion

Header and footer share the existing Navigation capability and both use:

1. Why MioPages? → `/service`
2. What You Get → `/what-you-get`
3. How It Works → `/getting-started`
4. Questions & Answers → `/faq`
5. Get Your Free Review → `/review`

The header highlights Review using its existing action-target treatment; nothing
follows it. Footer uses the same clear Review label, with its existing plain-link
presentation. Home remains available through the logo. No direct-start navigation
item, extra destination, workflow, form, payment or intake is added.

The only normal visitor CTA destination change is the `/service` Hero:
“See What You Get” → `/what-you-get` becomes
“Get Your Free Web Presence Review” → `/review`. The old mid-service
Why link disappears with its redundant Section. The legacy fallback links to the
surviving explanation instead of its former What You Get Hero link. The old
experience closing Review link is retained on the merged closing. FAQ's Hero
label becomes “See How It Works”; its destination stays `/getting-started`.
No other destination changes. Every rendered anchor was checked against the
structured Page graph; all exposed informational Pages provide a path to Review.

Home keeps its primary filled Free Review and secondary “Ready to start now?”
link to `/getting-started`. Only “Getting Started explains” changes to “How It
Works explains” in the Home closing. Support stays plain, qualified future
assistance prose within the same process, with no competing purchase action.

## How It Works and preserved copy

The public Page name/title changes to **How It Works**; `/getting-started` and
its identity remain. Its opening heading is “From first interest to launch and
Ongoing.” Its opening paragraph is:

> Start with a Free Web Presence Review, or skip it if you are ready to proceed. Either way, we confirm fit, scope and price before commercial commitment and deeper paid onboarding. Getting started should not require a design brief, sitemap or technical plan.

The existing development-preview disclosure follows unchanged. All lower
Sections remain exact: normal Review then decision, direct-start foundational
information, fit/scope/price, commercial commitment before paid onboarding,
confirmation of understanding, proposed direction, build/review/launch and
Ongoing. Those stages explain the process rather than making this Page a required
first step. The only new prose beyond titles/link labels is this opening and the
single legacy-route transition sentence; the retained final opening sentence
already existed.

What You Get and Review Sections are byte-for-byte unchanged. All 15 FAQ answers
remain unchanged. Review remains cost-free, explains prospect inputs and returned
assessment, creates no paid commitment, and explains continuation. Existing
disclosures on Home, Review and How It Works remain exact. Contact submission
returns 503 and quarantined candidate delivery returns 404. No fake live controls.

## Rendered findings and limitations

All six exposed Pages were inspected at 1440px desktop and 360px mobile, including
header/footer and the expanded mobile menu. No horizontal overflow or text clipping
was found. The merged explanation has a coherent service → operating model →
benefits → outcome-focused design → Review progression. Existing typography,
palette, spacing, configuration, Visual Direction and responsive renderer are
unchanged. Home has one obvious primary conversion and a subordinate direct-start
link; its full existing mobile introduction still precedes those actions. FAQ
keeps practical answers and its closing Review CTA; its optional journey Hero
link helps visitors who need process detail rather than requiring that detour.

Mobile menu → Review → continuation → How It Works, logo → Home and Home direct
start → How It Works were clicked successfully. There are no mandatory circular
chains or broken destinations. Review and How It Works intentionally link to each
other for optional entry/continuation context; Review is currently informational
because submissions are unavailable. This is an explicit preview limitation,
not an implemented conversion workflow. Agent review does not imply human visual
acceptance or publication approval.

## Validation and safety

Passed: four focused IA/conversion unit tests; one PostgreSQL integration test
with stale-state rejection, isolated application, exact rendered copy, all seven
technical routes, header/footer ordering/highlight, links and real preservation;
targeted lint; standalone type-check; documentation and whitespace checks. The
existing successful production build is reused: runtime, CSS, dependencies and
build configuration did not change. Broader standard tests/build were not rerun.

All 337 pre-existing source-file hashes are unchanged. Real MioPages, Myomaton,
all other customers, all nine migration rows and managed Asset rows/bytes remain
unchanged. Complete real customer-state fingerprint:
`4758d79cea7a0ecb9019cc59b4fd8d824c2c8bdb845c37552e1b019c491cb980`.
Current isolated preview fingerprint:
`385ea5ea729a07b3398bfb745dea9f5f77e9aec8b4d58dee8e88a70aa12c72c0`.

Preview remains at `http://127.0.0.1:62298/` in its existing disposable schema.
The original schema-owner process must remain alive. Current receipt, screenshots
and responsive metrics are ignored under `runtime-content/miopages-ia/`.
Earlier receipts remain historical evidence, not the current preview fingerprint.

This task adds exactly five source paths: this document, the mapping and runner
linked above, [unit tests](../tests/miopages-c0-revamp.test.tsx), and
[PostgreSQL test](../tests/integration/miopages-c0-revamp.test.ts).
Git has 30 unstaged/untracked paths: three pre-existing modified files and 27
untracked source files (22 pre-existing plus these five additions). Zero staged
files. No real-customer application, commit or push.
