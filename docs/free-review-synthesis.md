# Free Review synthesis and operator review

## Current bounded implementation

Development/manual synthesis, validated structured Review content, evidence mapping,
immutable local revisions and exact operator approval are implemented. The substantive
original-human MioPages Review remains **NEEDS_OPERATOR_REVIEW**. Only synthetic
artifacts exercise approval automatically. No email, prospect delivery, paid work,
customer promotion, public operator surface or live text-provider dispatch exists.

Human-inspected Draft D revision 3 is the current Review-quality target and remains
unapproved. The experiment/checkpoint notes below describe their historical stages;
human revisions now use the same immutable workflow without rewriting earlier work.

The [progressive onboarding contract](progressive-onboarding-and-launch-readiness.md#concise-review-approval-and-delivery)
owns the Review-to-launch workflow. [Conversion Architecture](conversion-architecture.md),
[customer journey](customer-journey-and-change-management.md), [onboarding trust](onboarding-optimization.md),
[service scope](service-operations-model.md), [capabilities](platform-capabilities.md),
[intake](free-review-intake.md), [security](security-operations.md) and
[existing gates](deferred-architecture.md) retain their authority.

## Evidence and synthesis contract

[Model](../lib/platform/reviews/model.ts): `ReviewEvidencePacket` →
`ReviewSynthesisRequest` → validated `ReviewDraft`. The exact immutable submission
retains answers, provenance, timestamps, identity and its existing intake digest.
Evidence packet version/digest also bind owner/site, explicitly captured evidence
and coverage. Copying for synthesis never changes the source. Both the manifest-selected
first human snapshot and a durable submitted row pass through the same
[adapter](../scripts/reviews/source.ts). There is no second questionnaire, canonical
Knowledge/Offering reader or prospect-to-Customer writer.

Each material claim references existing `intake:<answer>` or captured evidence IDs:

| Classification | Meaning and enforcement |
| --- | --- |
| FACT | Exact text supported by captured evidence; intake alone cannot establish it. A visible statement is not proof the underlying business promise is true. |
| PROSPECT_SUPPLIED_UNCONFIRMED | Attributed to the prospect; source provenance must remain unconfirmed. |
| OBSERVATION | Interpretation of evidence; intake-only observations retain attribution/uncertainty. |
| RECOMMENDATION | Direction/judgment, not a verified result or commercial commitment. |
| UNKNOWN | Coverage is insufficient; do not fill gaps with plausible claims. |

Bounded public evidence is operator-controlled, not an application URL-fetching
service. Only URLs in the original submission are eligible. The original test uses
homepage text from `https://miopages.com`, with retrieval time and the web tool's
cached-crawl limitation recorded locally. No account login, portal functionality,
forms, analytics, search position or other pages were tested. No canonical MioPages
business state fills gaps. Submitted portal concerns and performance/cost claims
remain unconfirmed. The UX-only submission is not the substantive test case.

### Separate development-presence comparison

Draft A retains its original legacy-homepage evidence, exact files, packet, revision
and decisions. Draft B is a separate identity/history using the same first-human
submission digest and an explicit `development-presence/1` coverage inventory.
Both substantive drafts remain NEEDS_OPERATOR_REVIEW. Creating a variant never
edits or approves an earlier Review.

Intake supplies stated intent; rendered website text is assessed against it, not
treated as equal business truth. Optional `presence` metadata identifies a specific
operator-selected loopback target, discovered routes/titles, reviewed routes with
purpose/time/limitations/evidence ID/raw-capture SHA-256, and omitted routes with
reasons. Every discovered route must be accounted for, with at least two reviewed
Pages. Evidence must map exactly to those reviewed local URLs and capture times;
mixed legacy/public evidence, duplicate or invented routes and unexplained omissions
are refused. This adds no URL-fetching service or permission to read internal business
records. Older packets without this metadata retain their exact bytes and digest.

The bounded Draft B sample covers Home, Why MioPages?, What You Get, Review, Start
and the linked intake destination. How It Works and FAQ are recorded as discovered
but not reviewed; the selected Pages suffice for this positioning/scope/handoff
comparison, not an exhaustive site audit. The intake destination showed confirmation
for the existing browser test session: this is explicitly not a fresh-visitor
submission/completion or delivery test. No forms, prospect records or site content
were changed; production capability is not inferred from development behavior.

The operator view shows coverage separately from customer copy. An operator-only
comparison records differences in all Review sections and distinguishes changed
site evidence, broader coverage, intake interpretation, evidence limitations and
synthesis variability. An opportunity may strengthen an already sound direction;
three opportunities do not imply three defects. No Home concept or screenshot is
generated for this comparison.

## Customer-facing contract and quality

### Full-service consultative experiment

The governing synthesis relationship is **prospect goals/needs + current Web
presence + service model + capability readiness → useful recommendations**.
The website is evidence, not the whole problem domain. Understand the business
need first, recommend the useful improvement, then explain relevant service fit.
Do not turn this into a problem-to-feature checklist or recommend every capability.
Our customer is the business using MioPages; their customers/prospects are the people
it wants to reach. Internal solution context never supplies hidden prospect facts.

The [working service description](miopages-service-description.md) preserves the
approved commercial/service meaning while referencing the existing authorities.
The focused [context loader](../scripts/reviews/context.ts) snapshots that document's
exact UTF-8 bytes, hashes of nine source documents and eight bounded readiness
summaries. It does not duplicate the platform registry or load canonical customer
records, Review history, Draft A/B prose or recovered editorial revisions. Update
the reviewed summaries when authoritative readiness changes; hashes identify the
sources, they do not automatically infer implementation status. This is a dated
snapshot, not a live capability-management framework.

The [internal context contract](../lib/platform/reviews/synthesis-context.ts) uses
AVAILABLE_PROVEN, DEFINED_EVOLVING, PLANNED_DEFERRED and EXTERNAL_INTEGRATION,
with an explicit operational scope and boundary for each entry. AVAILABLE_PROVEN
in local development does **not** mean available in production. Packet digests bind
`solutionContext` separately from `submission` and `evidence`. Service sources cannot
be used as prospect evidence IDs. Reusable need-first guidance is passed separately
to the development/manual provider; live dispatch still refuses.

Optional claim `serviceUses` records internal capability use as business direction
or a current-operation claim, separately from its intake/Page evidence. The latter
refuses unless status is AVAILABLE_PROVEN **and** scope is production. Direction
can recommend a valid need before implementation, using honest conditional wording.
These annotations and text checks do not prove semantic honesty or detect all
unannotated promises: operator judgment and explicit approval remain essential.
No feature inventory, status vocabulary or internal metadata reaches customer copy.

`consultative/1` is opt-in and requires solution context. It presents situation,
meaningful strengths, three useful opportunities (what/why/direction with a practical
picture of better), a first priority and contact follow-up, optional justified ongoing
improvement, concise service fit, and the existing concept-not-generated status.
Legacy structure and Draft A/B customer HTML/Markdown are unchanged. Optional
`ongoing` participates in immutable revision validation, digest and claim identity.
No final copy, sitemap, calendar or implementation package is supplied.

Draft C — Full Service Context is a separate revision-1 identity in
NEEDS_OPERATOR_REVIEW, created by the existing development/manual adapter, not a
paid/live provider. It uses the original first-human submission and the exact six
Draft B Page captures, limitations and coverage; only the variant label changes.
The old public URL remains solely as an unchanged historical intake answer, never
new Page evidence. Fresh prose is written from these inputs; Draft B comparison is
produced only afterward and kept operator-only. No Home mockup, approval or delivery
is authorized. At that experiment checkpoint, the recovered human Revision 2 was not yet persisted.

```powershell
node --import tsx scripts/review-synthesis.ts prepare-original --full-service-context --draft <fresh-draft.json> --evidence <accepted-capture.json> --actor <author>
```

This option retains the explicit preserved-bundle requirement documented below.
A separate operator Q&A export is available through `interviewMarkdown`; it never
enters the customer Markdown. Semantic `followUpTo` metadata associates applicable
conditional answers with their triggering choice within the same question, including
goals/goalOther and responses/responseOther. Earlier snapshots without it remain
readable; historical packets are not upgraded. New contexts validate that the parent
precedes the follow-up and its triggering answer is present. This is a small grouping
correction, not an expansion of the provenance UI.

The [full-service tests](../tests/review-service-context.test.tsx) exercise source
separation, exact document hashes, immutable snapshots, provider input boundaries,
capability honesty/refusal, clean customer output, conditional Q&A grouping and
synthetic local persistence. Actual Draft A/B preservation and Draft C source
equivalence are also verified read-only as local experiment evidence.

### Plain-language refinement and Draft D

Human feedback on Draft C refines writing quality without abandoning the need-first,
whole-Web-Presence reasoning model. The reusable guidance now asks for ordinary
business language, concrete visitor understanding/actions, meaningful priorities and
practical examples of better. Include a detail only when it materially improves the
advice; intake presence alone does not justify making it a priority. Lead with value,
keep rigorous evidence behind the scenes, and avoid repeated technical, process or
commercial qualification. Factual discipline and the free/paid boundary still apply.
The intended length is roughly 650–800 body words, subordinate to usefulness.

The initial refined contexts embed `writingGuidance` version `review-writing/2`,
its exact instruction text and SHA-256. Packet digests bind the instructions alongside
the separate service context; the provider receives the **bound** instruction text,
not today's mutable default. Older contexts without it remain valid and unchanged.
This preserves which general writing rules informed a future Review without storing
earlier Review prose as an exemplar. No live/paid text dispatch is enabled.

The opt-in `consultative/2` format requires that snapshot. It retains the successful
flow and permits justified initial and ongoing recommendations, but omits the unused
Home concept from customer HTML/Markdown. The internal not-generated status remains
validated and digest-bound in diagnostics. This slice supplies no concept or concept
recommendation. A future optional section needs actual customer value and an explicit
presentation contract; schema support alone is insufficient. Earlier legacy and
`consultative/1` rendering is unchanged, preserving Draft A/B/C customer output as
well as their immutable artifacts. Existing operator evidence simply follows the
visible paragraphs; its UI is not expanded.

Representative internal-term checks apply to the new customer copy and headings;
they are bounded safeguards, not proof of good writing or semantic honesty. Human
judgment still determines whether a recommendation is useful, tangible, supported
and fairly presented. Existing capability-use checks continue refusing current-operation
claims for local-only, deferred and unproven external capabilities. Service fit should
explain the burden a managed relationship could remove and the business owner's
knowledge/judgment/approval role, without reciting a feature list.

Draft D — Refined Full Service Review is generated fresh through the existing
development/manual adapter from the original first-human submission, the exact six
accepted development Page captures, the unchanged service/readiness basis and the
revised general guidance. No Draft A/B/C or recovered human Revision 2 prose is an
input. It is a separate revision-1 identity in NEEDS_OPERATOR_REVIEW, with only create
and request-review events. The result is not manually edited afterward. Read the
customer Review first, then its separate readable Q&A; conditional answers remain
under their triggering choices. C-versus-D comparison is produced only afterward
and remains operator-only. Human acceptance, approval and delivery are separate.

For this checkpoint the documented production build path is:

```powershell
npm run build -- --webpack
```

The known Turbopack CSS-worker launch failure is outside this writing task. This
uses Next's supported CLI option without changing build configuration. Run focused
and Review/operator/intake tests, the standard suite, lint, type-check, this build,
documentation/UTF-8/whitespace checks and read-only preservation/isolation proof.

Required output: what we understand; what appears to be working (or a new-business
starting point); exactly three opportunities, each with what/why/direction; first
direction; conversion observation; fit; and optional concept status. Fit supports
strong, conditional, insufficient-information and not-a-good-fit outcomes. The Home
concept is not generated or promised. Text is plain and bounded to roughly 1–2 pages.

Closed schemas reject arbitrary HTML, extra provider/reasoning fields, missing sections,
unknown evidence references, excessive length and known implementation-detail patterns.
No final copy, sitemap, keyword spreadsheet, content calendar, wireframes or complete
implementation plan belongs in a Free Review. These structural checks are defense in
depth: they do not prove factual entailment or detect every way prose could cross
the boundary. Approval also requires explicit operator attestation of all ten checks:
faithful understanding, supporting evidence, reasonable priorities, useful direction,
free/paid boundary, credible fit, concise/plain copy, supported claims, honest
uncertainty and absence of internal terminology.

## Persistence, scope and approval

### Human editorial workflow

The normal operator experience is now **clean Review → readable Prospect Q&A →
human revision guidance**, with diagnostic evidence clearly secondary. `/operator`
does not interleave sources through the normal Review. A closed Diagnostic evidence
section and `/diagnostics` retain all structured sources, classifications, capture
limitations, coverage and technical history. `/comparison` is operator-only; with
only revision 1 it says that no later revision exists. Customer HTML/Markdown remain
unchanged and never contain notes, provenance, comparison or QA metadata.

Draft D is the human-accepted machine baseline, still revision 1 / NEEDS_OPERATOR_REVIEW.
Acceptance as a baseline is not approval or prospect delivery. This preparation does
not edit its copy, create revision 2, rewrite exports or change Draft A/B/C.

[Clean editing](../scripts/reviews/editing.ts) creates a separate ignored workspace:

```powershell
$env:NODE_ENV='development'
$env:MIOPAGES_REVIEW_SYNTHESIS='local-operator'
node --import tsx scripts/review-synthesis.ts begin-edit --id <review-id>
```

Open the returned `review.md` and edit the customer text there. Keep the section order
and fixed headings; opportunity titles may change while retaining their numbers.
Single-slot sections can now contain one to five flat paragraph units, as described
below. Sections with several semantic roles (such as what/why/direction) retain their
existing paragraph counts unless structured editing supplies an explicit mapping.
This refuses ambiguous redistribution rather than moving evidence silently. Use the
existing structured `edit` command for outline, evidence or classification decisions.
No automatic truth validation or semantic lineage is implied.

`edit-notes.json` contains a revision-level `summary` and optional `entries`, each with
a `location` or `claimId` and a `note`. Record meaningful terminology, clarity,
recommendation/meaning or content changes. Trivial spelling, punctuation and grammar
edits may leave the summary empty and entries empty; no per-change annotation is
required. Notes are operator-only, validated and bound into the new revision digest.
Historical digests without notes retain their original calculation.

`editorial-context.md` separately preserves **pending, unapplied** human feedback:
avoid enquiry/inquiry as a generic default and choose context-appropriate everyday
wording; reconsider the awkward phrase “the worked example.” These are editorial
prompts, not replacement rules, completed edit notes or changes to Draft D.

After the human has edited and reviewed the workspace, the explicit save action is:

```powershell
node --import tsx scripts/review-synthesis.ts save-edit --id <review-id> --workspace <returned-directory> --actor <human-operator> --note <short-save-reason>
```

Saving appends a new immutable **DRAFT** revision with the same bound packet and
questionnaire context; revision 1 and its events remain unchanged. It never approves
or delivers. The workspace binds the exact source revision/digests and rendered
baseline; foreign, stale, redirected, unchanged or structurally ambiguous inputs
refuse. A successful save prints the new exact binding. `binding --id <review-id>`
also reads the current binding without overwriting any old exports. Copy that JSON
unchanged into a local UTF-8 binding file for the existing request-review command.
Do not reuse the workspace's revision-1 binding after saving.

```powershell
node --import tsx scripts/review-synthesis.ts compare --id <review-id> --from 1 --to 2
node --import tsx scripts/review-synthesis.ts request-review --id <review-id> --binding <new-binding.json> --actor <human-operator> --note <review-request-reason>
```

The [comparison](../lib/platform/reviews/revision-context.ts) shows changed claim
locations/titles, old/new text, old/new references and edit notes. Stable IDs identify
fixed locations, not semantic equivalence. A meaning change may invalidate old
support even when references are retained. Inspect diagnostic evidence before approval;
update references/classification through structured editing when needed. New facts
outside the immutable packet require separately authorized evidence work, not invention.

Future approval of a newly edited revision requires all existing QC attestations plus
`retainedEvidenceReviewed: true`, bound to that exact revision. An edit always returns
to DRAFT and must be requested for review before approval. Historical revisions without
the new notes metadata remain readable without rewriting their events. The low-level
`edit` command also accepts `--edit-notes <notes.json>` and applies the same safeguard.
An empty note permits trivial edits; it does not waive evidence inspection or honest
operator assessment of meaningful changes. This is a trusted local development
workflow, not a browser editor, production authorization or tracked-changes system.

[Focused workflow tests](../tests/review-editing.test.tsx) use synthetic fixtures only:
clean reading order, conditional Q&A, secondary diagnostics, immutable exports/events,
append-only saves, trivial/meaningful notes, digest/approval binding, comparison,
stale/foreign/ambiguous refusal and production startup refusal. Real Revision 2 remains
deliberately uncreated during this checkpoint.

### Bounded multi-paragraph claims and read-only import

The existing `Claim` retains its first paragraph and can optionally carry up to four
`additionalParagraphs`. These are flat paragraph claims with their own text, kind,
identity and references; they cannot contain another continuation list. This is an
additive extension of the same Review model, not another document/block representation.
Each paragraph retains the **550-character** limit. The 1000-word concise Review cap
counts prose and opportunity titles, not the extra reference-review metadata.

`reviewClaims` exposes the first paragraph at its original location and continuations
at fixed locations such as `ongoing.paragraphs.1`. The original ID is retained; new
units receive distinct Review/location-scoped IDs on binding. Existing unit IDs remain
stable at those positions. This does not infer semantic identity after reordering.
Historical claims without continuations retain their exact serialized shape, digest,
rendering and approval rules; no packet or event is rewritten.

HTML renders each paragraph as a separate paragraph; Markdown uses a blank line
between units. The importer preserves paragraph order and visible text, including
internal spaces/hard wraps. Its existing normalization is limited to Markdown section
separators, CRLF-to-LF input parsing and outer whitespace trimming; it never rewrites
the source file. A single semantic slot can expand/shrink its paragraph list. If an
expanded section contains several roles, changing its total count still refuses
until an explicit structured mapping is provided. Headings keep their established
meaning and opportunities retain numbering.

Exact unchanged text retains its prior references and classification. Changed/new
paragraphs instead carry **no asserted `evidence` references** and a separate
`referenceReview` candidate set, naming the bound prior paragraph/location and ID.
Candidates are suggestions to inspect, not proof or a blind assignment of one old
array to all new meanings. Changed facts/observations become UNKNOWN pending human
classification/support review; attributed prospect claims retain their attribution
rules, and recommendations remain judgments. Existing FACT and confirmed-reference
validation is not relaxed. Candidate references must exist in the immutable packet
and originate from the named prior paragraph; new evidence cannot be invented.

Diagnostics label candidate sources explicitly. Comparison shows the section,
added/removed/changed unit, old/new text, claim ID, edit notes, actual references and
candidate-review state. Normal Review/Q&A reading and customer rendering remain
clean. A candidate-bearing revision may be saved as an unapproved DRAFT in a later
authorized task, but approval refuses even with `retainedEvidenceReviewed: true` until
the operator explicitly selects appropriate actual references/classifications and
removes the pending candidate metadata through structured editing. Human QC and the
existing exact-revision evidence attestation still apply afterward.

The CLI now supports an explicitly read-only preflight:

```powershell
node --import tsx scripts/review-synthesis.ts dry-run-edit --id <review-id> --workspace <absolute-workspace> --input <absolute-human-markdown-file>
```

It applies the same owner/binding/staleness, source-path, paragraph, length, identity,
candidate-origin and notes validation as saving, but reports counts/IDs/review state
with `persisted: false`. It never calls the append/save path. The input must be a
Markdown file inside that exact workspace; omission selects `review.md`.

The actual human `review-revised.md` dry run represents eight sections and seventeen
visible paragraphs, including three ongoing paragraphs of 379, 310 and 119 characters.
No human paragraph exceeds 550 characters (maximum 507). This structural checkpoint
does **not** copy the human file into `review.md`, populate edit notes, save Revision 2,
approve, deliver or generate another Review. Synthesis responsibility/conversion
lessons and the primary/secondary intake refinement remain pending in ignored local
recovery context. No synthesis instructions or intake questions change here.

[Paragraph tests](../tests/review-paragraphs.test.tsx) cover flat/bounded units,
ordering/spacing, legacy persistence, customer rendering, one-to-many comparison,
stable IDs, candidate origins and approval refusal, stale workspaces and read-only
preflight. Mutation tests use synthetic fixtures only.

[Local store](../lib/platform/reviews/store.ts) persists an immutable packet and
numbered append-only events under ignored `runtime-content/review-synthesis/<uuid>`.
Events contain immutable revisions or decisions and a verifiable hash chain. A
single-writer exclusive lock, exclusive file creation and flushed writes refuse
overwrites/concurrent or partial history; interrupted/corrupt history fails closed.
Local trusted filesystem access remains the authority boundary, not tamper-proof
storage against a privileged user. Directory redirects and foreign owner/site reads
are refused. Local limits are 32 revisions / 128 events. Evidence is sensitive
development/test material: restrict access to the operator and necessary system
administrators, retain only for this authorized review, and explicitly dispose of or
preserve it after the checkpoint under P4. Normal backup exclusions are unchanged.

States: DRAFT → NEEDS_OPERATOR_REVIEW → APPROVED. An edit appends a new revision and
returns to DRAFT, including edits after approval. Old revisions/decisions remain.
Approval binds exact revision number/content digest, source submission digest,
evidence packet/version digest, operator identity, timestamp, note and all QC checks.
Stale/superseded approval is refused. Approval is not delivery or publication authority.

No migration 0011 is created: this slice's persistence is deliberately the local
disposable evidence store, not shared durable Review tables. It recovers through
reopening the same validated store. A future shared/production adapter requires a
separately reviewed additive migration, tenant/authorization/retention and isolated
migration tests. Shared migrations remain exactly eleven; acquisition tables are
neither reused nor activated. This does not claim production Review persistence.

## Provider and operator tools

The existing acquisition adapter is image-specific. No approved text adapter was
found. `ReviewSynthesisProvider` is provider-neutral; only the explicit development/manual
adapter can execute now, with one authorized attempt. Live mode refuses before dispatch.
No provider credentials, hidden reasoning or paid API usage are stored. Live model
integration still needs operation-scoped authorization, minimization, budgets,
usage attribution, validation, retries/failure policy and production gate review.

[Trusted CLI](../scripts/review-synthesis.ts) requires both `NODE_ENV=development`
and `MIOPAGES_REVIEW_SYNTHESIS=local-operator`; the pilot binds the exact MioPages
service-owner/site. Local shell/filesystem access is required, not a production
authentication scheme. It never opens a database writer. The read-only HTTP preview
binds 127.0.0.1, accepts its exact Host and GET paths only, sends no-store/CSP headers,
and refuses production startup. `/` contains customer-facing copy; `/operator` shows
source/evidence, classifications, revision/state and decision history separately.
There is no HTTP approval endpoint or prospect access/delivery implementation.

### Readable operator context and durable question wording

The normal operator view presents identity/state/revision first, followed by clean
Review text, full Q&A and human revision guidance. Secondary diagnostic evidence
retains a **Why this says this** expansion beside every referenced paragraph.
Each diagnostic expansion identifies the claim classification and resolves every source:
intake references show question/field wording, exact stored answers and
prospect-supplied/unconfirmed provenance; Page sources show the route/source,
observed text, capture time and relevant limitations. Citations expose the basis
for judgment; they do not prove an interpretation is logically correct.

The full **Prospect Q&A** presents the interview in questionnaire order, with
grouped fields, multi-select lists and unchanged stored text. Unanswered optional
fields are omitted from the transcript. A deliberately cited empty field is
identified as unanswered in that claim's diagnostic expansion. Coverage and
revision/QC/raw JSON remain in secondary diagnostics. These are operator-only
presentations: customer HTML/Markdown still show only the Review product, without
the full interview, evidence IDs, claim IDs, provenance controls or diagnostics.
Sending a prospect their answer receipt is a separate future intake/delivery concern.

[Questionnaire context](../lib/platform/reviews/questionnaire.ts) embeds semantic
wording into new packets: version identity, pinned definition commit/hash, ordered
questions/groups, applicable answer keys, displayed wording, answer kind and optional
status. Conditional wording is resolved when the packet is made; no executable
logic, layout or arbitrary UI details enter the snapshot. The packet digest binds
this context. Every future written revision also embeds a wording context, with
its revision digest covering both content and context; approval already binds that
revision digest. This supports future edits of legacy packets without rewriting
their original packet or earlier revision.

Existing Draft A/B have no embedded wording snapshot. Their operator display uses
the explicitly labeled **legacy-pinned** fallback from the frozen
[foundational-intake/1 definition](../lib/platform/reviews/questionnaires/foundational-intake-1.json),
extracted as semantic data from accepted Git commit `e4d48e5`. It does not read
today's mutable questionnaire copy or rewrite old evidence. New questionnaire
versions must register their own semantic definition before packet creation;
unknown versions fail closed when no embedded context exists. Embedded contexts
can be read independently of the current definition registry. Display/resolution
code reads only the bound submission, its evidence and semantic wording data,
never canonical customer Knowledge/Offering records.

### Bounded claim identity

Newly written revisions assign unique `claim_...` identifiers scoped to Review
identity and fixed schema location. A normal edit at that location retains its ID
and references; attempts to move a foreign ID into that location are refused.
This is not semantic matching, arbitrary opportunity reordering or generalized
lineage. Historical claims without IDs remain unchanged and display an explicit
legacy schema-location label. On a future authorized edit, the new revision gains
IDs and a wording context; its prior revision remains byte-identical. These fields
remain absent from customer presentation.

At the earlier operator-context checkpoint, the recovered human Revision 2 was
deliberately unpersisted. Subsequent authorized human edits use the bound revision
workflow and evidence review described below. Draft A/B stay revision 1 /
NEEDS_OPERATOR_REVIEW. Synthetic fixtures exercise mutation/approval mechanics;
substantive human revisions remain unapproved. No shared migration, customer/prospect
mutation or delivery is required.

```powershell
$env:NODE_ENV='development'
$env:MIOPAGES_REVIEW_SYNTHESIS='local-operator'
# Required only for prepare-original: the explicitly selected, intact preserved bundle.
$env:MIOPAGES_REVIEW_PRESERVATION_BUNDLE='<absolute-preservation-bundle-directory>'
# Original first-human case only; inputs are reviewed local JSON, not provider prose.
node --import tsx scripts/review-synthesis.ts prepare-original --draft <draft.json> --evidence <capture.json> --actor <author>
node --import tsx scripts/review-synthesis.ts inspect --id <review-uuid>
node --import tsx scripts/review-synthesis.ts preview --id <review-uuid>
```

`prepare-original` requires `MIOPAGES_REVIEW_PRESERVATION_BUNDLE` to name an
absolute directory. Missing/invalid configuration or an unavailable/changed bundle
fails closed; there is no default directory, machine search or canonical-data fallback.
The pinned manifest SHA-256, file checksums, accepted Git blobs and original-human
identity/record checks still apply regardless of location. Reading existing Reviews
through `inspect` or `preview` does not require this variable or the source bundle.

`inspect` exports `review.md`, `editable-review.json` and `binding.json` beside the
immutable history. Edit only the exported content, then run `edit --id <uuid>
--draft <edited.json> --binding <binding.json> --actor <operator> --note <reason>`.
Export the new binding with `inspect`, then `request-review` with that binding,
actor and note. Approval uses `approve` with that same exact current binding,
actor/note and `--checks <checks.json>` containing all ten named booleans in
`qualityChecks`. Never attest mechanically on the substantive draft. Regeneration
means a separately supplied manual-model proposal followed by an explicit new
revision; there is no automatic retry, unattended generation or silent edit.

An intentionally stale binding must fail. Export inspection before editing; rerunning
`inspect` overwrites only editable exports, so save operator edits first. Never edit
packet/history JSON directly or use manual database edits. Production CLI refusal,
synthetic approval, revision immutability, evidence/claim rules, owner isolation and
manual/live refusal are covered by [focused tests](../tests/review-synthesis.test.tsx).

Delivery/email, private prospect access, live provider dispatch, shared Review
persistence and paid onboarding remain deferred. Original preserved evidence,
shared synthetic intake, canonical customer state and managed objects are unchanged.

### Human Revision 2 evidence review and reusable writing lessons

Future contexts snapshot `review-writing/3` and a bounded `synthesisPolicy`:
managed-service responsibilities are separate from customer contributions, and
multi-select response options are unranked signals. Primary conversion intent
requires full business context. Older version-2 snapshots remain readable and
unchanged; editing a historical Review retains its original packet and questionnaire
context. A human edit does not rerun synthesis or retroactively replace its guidance.

Write conversational, business-appropriate, friendly and forthright advice in ordinary
language. Respect business knowledge without assuming Web expertise. Avoid generic
enquiry/inquiry, ambiguous customer references, assumed coordination problems and
process-oriented endings. State useful outcomes directly without a fixed template.
Within supported service scope, monitoring, analysis, measurement, optimization,
content improvement and coordination belong to the managed service. The customer
contributes knowledge, outcome context, confirmation, judgment and approvals. This
responsibility split does not bypass capability-readiness boundaries.

Quote/appointment choices alone do not establish priority or commercial model.
A contractor may legitimately prioritize estimates; another business may prioritize
appointments, calls, purchases or visits. MioPages-specific Review-first intent and
standardized service direction belong in its scoped business context, never as
universal defaults. Provider instructions and structural context help interpretation;
they do not automatically prove semantic quality or replace human judgment.

Operator edit notes may persist `retainedEvidenceReviewed: true` only after inspecting
all paragraph references. It is a revision-bound assessment, not approval. Existing
explicit approval checks still require their own evidence attestation and all QC
checks; unresolved candidate sets still refuse approval. Store reviewed structured
content through the existing bound `edit` workflow so resolution and human notes
are included in the single immutable human revision. Comparison and diagnostics
remain operator-only.

#### Intake follow-up — documented, not implemented

Review the desired-prospect-response question to distinguish the PRIMARY desired
next step from SECONDARY acceptable engagement/contact actions. Inspect other
multi-select questions for accidental equal-priority interpretation. Choose the
smallest generalizable refinement that helps synthesis without unnecessarily
lengthening intake. No questionnaire change is authorized in this checkpoint.

### Optional ongoing inputs and deferred interview learning

Future contexts snapshot `review-writing/4` and optional, bounded policy fields:
`ongoingInput` separates optional changes/ideas after onboarding from managed-service
responsibilities and leaves the exact input interface deferred; `interviewLearning`
explicitly records no cross-prospect reuse. Version-2/3 snapshots remain valid and
unchanged. The existing 550-character paragraph limit is unchanged.

After setup, core knowledge is already captured. Customer input concerns meaningful
changes, additions, corrections, ideas, topic suggestions, outcome context and
approvals when useful, not ongoing basic-knowledge homework. Within scope, MioPages
identifies opportunities, performs managed work and proposes important changes for
approval. No specific customer portal, chat, form or email-like UI is promised.
A managed relationship may replace, simplify, consolidate or complement existing
activity rather than merely add another marketing system.

Content direction should use real audience questions/problems and decisions where
supported. Authorized search, visitor/conversion signals, outcomes and business
changes may inform improvement. An individual MioPages Review may manually suggest
a clearer explanation or topic; this does not generalize to every business and
is not automatic interview learning. Cross-prospect aggregation, theme mining,
embeddings/corpus creation, automatic content from accumulated answers and hidden
reuse across prospects are not implemented or authorized. Systematic use requires
separate privacy, retention, permission, aggregation and product design.

The desired-response PRIMARY versus SECONDARY intake refinement above remains a
documented follow-up only. No questionnaire or shared schema changes are involved.
The operator comparison defaults to the immediately preceding revision versus
the current one; explicit CLI `--from` and `--to` can select another ordered pair.

### Foundational intake v2 interpretation and wording snapshots

`foundational-intake/2` separates explicit `primaryResponse` intent from optional
`secondaryResponses`; separate Other text belongs to each role. Future guidance
`review-writing/5` gives primary intent materially greater interpretive weight.
Secondary actions are acceptable alternatives, not equal-priority goals. Consider
the full business context and surface conflicts rather than silently replacing
the explicit primary or treating it alone as the business model. The questionnaire
contains no MioPages-specific Review-first default. V1 `responses` and Q3 goals
remain unranked; array order never supplies missing historical intent.

The new semantic definition is [foundational-intake-2.json](../lib/platform/reviews/questionnaires/foundational-intake-2.json).
It preserves twelve ordered groups, role-specific labels/types and applicable
follow-ups. A single booking-context field binds to the first applicable parent
(primary first, otherwise secondary). Its `definitionBasis: semantic-json` identifies
a SHA-256 of the version/groups semantic JSON. `definitionCommit` identifies the
implementation base checkpoint, not a claim that v2 existed in that Git object.
The semantic hash is checked on capture; packet digests bind the resulting context.
Existing v1 Git-pinned definitions, embedded contexts, legacy rendering and all
historical Review events remain unchanged. No new Review synthesis or revision is
required by this intake version transition.
