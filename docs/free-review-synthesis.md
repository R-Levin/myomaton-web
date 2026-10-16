# Free Review synthesis and operator review

## Current bounded implementation

Development/manual synthesis, validated structured Review content, evidence mapping,
immutable local revisions and exact operator approval are implemented. The substantive
original-human MioPages Review remains **NEEDS_OPERATOR_REVIEW**. Only synthetic
artifacts exercise approval automatically. No email, prospect delivery, paid work,
customer promotion, public operator surface or live text-provider dispatch exists.

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
