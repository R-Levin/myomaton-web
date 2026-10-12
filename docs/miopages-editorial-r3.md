> Historical checkpoint. Current execution and accepted-state authority: [final C0 checkpoint](miopages-c0-checkpoint.md). Earlier commands, URLs and fingerprints below describe that stage only. Source links now point to retained successor tooling.

# MioPages R3 editorial application

## Authority and boundary

The human-reviewed `MioPages-R3.docx` is the copy authority, SHA-256
`92da3cda258787eb16353ec44a0b46d48447441f71cb9fd849850b9e9889ac9e`.
The [copy manifest](../scripts/customer-previews/miopages-editorial-r3.json)
contains the exact document text, excluding two explicitly identified development
notes from its public Pages. No tracked insertions, deletions, comments or tables
were present. The DOCX is not modified or committed as generated source.

The [pure mapping](../scripts/customer-previews/miopages-c0.ts) applies
only customer copy to the existing seven-Page draft. The
[scoped runner](../scripts/preview-miopages-c0.ts) requires the exact
saved draft fingerprint and an existing disposable Home-revamp schema, refuses
public-schema writes, and verifies all real customers, migrations and managed
bytes before and after. It does not authorize publication or human visual
acceptance. No commit or push is included.

## Copy and structural mapping

| Page | Route | Active Sections | Accommodation |
| --- | --- | --- | --- |
| Home | `/` | 6 | Replaces Knowledge-projected posture with the approved inline text; two labels need distinct Actions sharing existing destinations. |
| What Is MioPages? | `/service` | 4 | Existing text, headings, collection items and labels. |
| What You Get | `/what-you-get` | 4 | Adds Managed operation as a fourth item in the existing foundation collection. |
| Getting Started | `/getting-started` | 4 | Existing third Section becomes the Review intro; fourth carries the four approved deeper-journey items; redundant former closing remains inactive with its identity/history. |
| Why MioPages? | `/experience` | 5 | Existing fields; removes the former Design Section FAQ Action because R3 has none. |
| Web Presence Review | `/review` | 5 | Moves existing input-context before the benefits collection; former closing becomes the approved Useful whether or not you continue intro; free/paid collection follows it. |
| Questions & Answers | `/faq` | 5 | All fifteen approved questions and answers replace the corresponding existing items. |

All 34 Section identities remain; 33 are active. Page, Navigation and existing
Action identities/destinations, compositions, Section presentation configurations,
typography, palette, spacing, responsive behavior, logos and production Assets
remain unchanged. Three additional Action identities permit exact label variants
for shared informational destinations. No backend business facts, Offering,
commercial fields or Knowledge revisions are changed. The Home posture binding
is removed from that preview Section to prevent older projected wording from
overriding the approved editorial copy.

The Home line “Work with a knowledgeable operator” has Normal style in Word,
but clearly introduces the second parallel start. It maps to the existing item
heading without changing its words. Every approved public paragraph, heading and
CTA is otherwise represented literally, including intentional capitalization,
U.S. spelling and punctuation. No new legal/commercial interpretation is added.

## Development notes and availability

The two paragraphs beginning “Development note:” on Getting Started and Review
are implementation guidance, not public text. Their intent is implemented with
one disclosure in the Hero of Home, Getting Started and Review:

> Development preview: Review requests, operator assistance and onboarding are not yet open.

Home needs this because its approved start buttons sound operational. Getting
Started describes the interview/assisted path; Review describes intake and paid
onboarding. Other former disclaimers and repeated “Development preview” eyebrows
are removed where absent from R3. Home's approved eyebrow remains. Existing
forms, bookings, callbacks and submissions stay unavailable. No generated image,
FPO or acquisition candidate is attached.

The operator corrected Home's informational destinations before human review:
Start the Online Review and Contact an Operator both lead to `/review`.
The correction changes only the label-specific Start the Online Review Action
destination in the existing isolated draft. The disclosure explains their preview-only status.
These links do not initiate a workflow. All other CTA variants keep their
existing destination classes. The shared Navigation, logo and footer copy are
outside the Page editorial text and remain intact.

## Bounded content-editor evidence

Most changes map directly to headings, paragraph strings, inline item headings,
item text and Action labels. No field length limit blocked any approved copy.
The supported collection handles the fourth foundation item and four journey
items without presentation changes. Word paragraph roles are not perfectly
reliable: the operator-start heading needs semantic mapping despite its Normal
style. Review order and the inactive Getting Started closing require explicit
structural decisions rather than blind paragraph replacement.

A future content-only editor should expose Page/Section headings and paragraph
groups, ordered collection items/FAQs, per-placement CTA labels, versioned review
diffs, and separately managed preview disclosures. It should identify shared
Action labels before editing them and explain when source-bound content is
projected from Knowledge instead of editable inline copy. Any override should
retain its authority and provenance. Section reorder/retirement and binding
changes need bounded operator controls, not arbitrary HTML/CSS or layout editing.

There is no newly demonstrated renderer gap. Distinct CTA labels are representable
with existing Actions, though creating multiple Actions for label variants is a
content-editor ergonomics concern. No editor or reusable platform behavior is
implemented in this task.

## Verification and review

The [focused tests](../tests/miopages-c0-revamp.test.tsx) check exact public
copy, destinations, identities, untouched configuration/tables and bounded
disclosures. The [PostgreSQL check](../tests/integration/miopages-c0-revamp.test.ts)
checks stale-fingerprint refusal, transactional attestation, production rendering,
workflow/media refusal and real-state preservation. The runner compares every
rendered heading, paragraph and CTA in every Section against the approved copy.

Ignored local evidence belongs under `runtime-content/miopages-editorial-r3/`.
The existing pre-editorial baseline and Word/Markdown export remain intact for
comparison. The rebuilt runner uses the same disposable schema/asset root and a
fresh localhost production-server port; the original preview remains available.
Its original owner process must remain alive because it owns schema cleanup.

Real complete customer-state fingerprint:
`4758d79cea7a0ecb9019cc59b4fd8d824c2c8bdb845c37552e1b019c491cb980`.
Validation and agent responsive inspection outcomes are recorded at the end of
this checkpoint when complete. Human visual acceptance is still pending.

### Completed checks

All 214 standard tests, seven focused R3/prior-preview tests and all three affected
PostgreSQL integration checks passed without skips. Full lint, standalone
TypeScript checking and the production build passed. Documentation checking
passed (20 paths and 12 links), and `git diff --check` passed.

Agent visual inspection covered all seven Pages at 1440px desktop and 360px
mobile, with useful 768px tablet checks on What You Get and FAQ. Expanded tablet
and mobile navigation was checked. No horizontal overflow or clipped customer
text was found. Longer headings wrap coherently, CTA hierarchy remains clear,
and all fifteen FAQs remain readable. The fourth foundation item wraps within
the existing collection; longer FAQ answers increase page length without hiding
copy. The inactive Getting Started closing is deliberately absent. No styling
adjustment was made. This is agent inspection, not human visual acceptance.

The rebuilt preview is running at `http://127.0.0.1:62298/`; the original
`http://127.0.0.1:55807/` uses the same updated isolated schema. The scoped R3
fingerprint is
`dcafa210bd09ac3ea9163a1b730de7cc19d6acc0ebaaefa35d5cb9a43bb9fa5f`.
The ignored checkpoint, final verification and Home screenshot are local review
evidence. Real canonical promotion and customer data remain untouched.

This task adds exactly the six source files linked in this document: copy
manifest, pure mapping, scoped runner, focused test, integration test and this
checkpoint. The fourteen pre-existing working-tree paths are retained unchanged.
Nothing is staged, committed or pushed.

Final read-only verification confirmed both preview URLs render R3, all real
customer/migration state still has the fingerprint above, all five real managed
objects match their original content-addressed bytes, the authority DOCX hash is
unchanged, and all 326 pre-existing source-file hashes are unchanged. Final Git
status is three pre-existing modified files plus seventeen untracked source
files (eleven pre-existing and these six additions), with zero staged files.


### Home CTA correction before human review

Both Home start CTAs now route to the informational `/review` Page. The existing
isolated draft was reused without rebuilding unchanged runtime code. A scoped
transaction changed only Start the Online Review's destination; a full-state
comparison proved all other fields and destinations unchanged. Copy, Section
identities, visual configuration and the availability disclosure are intact.
Both links were clicked through in the browser. The two focused tests, single
R3 PostgreSQL integration check, targeted lint and documentation/whitespace
checks passed. Real customer fingerprint and all managed bytes remain unchanged.
No staging, commit or push occurred.
