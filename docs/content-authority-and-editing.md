# Content authority and bounded text drafts

## Implemented boundary

The runtime text descriptor and local operator draft service are implemented without
a schema migration. They derive fields from existing Section content and canonical
projections. They grant text editing only; CSS, layout, fonts, palette, spacing,
breakpoints, Section composition and Visual Grammar are outside the contract.
This is a trusted local development harness, not a customer HTTP editor or an
authorization/publishing system. Future customer exposure requires caller authority.

| Source | Owner and behavior |
| --- | --- |
| Canonical business truth | Identity, Offering, relationships, commercial structure, ownership and reusable knowledge belong to their existing canonical records. Projected fields refuse Page-local overrides. A future change must propose or update the canonical source with its review/version contract. |
| Page editorial | Headlines, introductions, explanations and transitions belong to a Page/Section. A validated text change updates only a local working draft and remains pending review and canonical assessment. |
| Derived/system | Projection labels and generated commercial explanations belong to the projection contract. They refuse direct override. Component names still belong to the Offering. |

`describeTextFields` provides stable Section/path identity, current value, owning
authority, source type, direct edit permission, reconciliation requirement, bounded
plain-text constraints, Section version, complete source-context fingerprint and
provenance. No duplicate database content model or editable layout configuration
is introduced. Modeled business facts use canonical bindings; surrounding editorial
framing remains explicit. Other rendering surfaces such as identity, navigation
and Action labels retain their existing owners and are outside this Section harness.

## Draft service and harness

`loadSectionContext` reads an explicit Web Presence/Managed Site/Section scope in
a read-only repeatable transaction. It checks active owned ancestors, canonical
source ownership and projection eligibility. It retains canonical payload/version
context locally for later assessment; private canonical values do not become public
rendered copy or descriptor values.

`createEditorialDraft` / `editEditorialDraft` retain previous/new text, owner,
actor, reason, timestamp, sequence, source provenance and revision context. They
reject stale context, foreign scope, invalid/overlong/markup/control text, altered
configuration and unjournaled content. A replayed journal verifies the working copy.
Existing typed Section/relationship validation is reused. No database update or
automatic publication occurs. Source content/configuration remain unchanged.

List fields with `node --import tsx --env-file=.env.local scripts/edit-text-draft.ts`
and explicit `--web-presence UUID --managed-site UUID --section UUID`. Add
`--field FIELD_ID --text-file PATH --actor ID --reason TEXT` to create/update an
ignored local draft under `runtime-content/editorial-drafts/`. This single-operator
harness demonstrates the contract; collaborative draft persistence/conflict
coordination and customer UI are subsequent work. Draft files are operator-private,
not portable published artifacts. A malformed or stale draft fails rather than resets.

## Reconciliation and proofreading hooks

Every editorial edit preserves the original complete Section and relevant canonical
sources, configuration, metadata and versions. Its journal records
`reconciliation: pending-assessment`. A later intelligence service can compare
wording-only change, clarification, possible business change, contradiction or new
knowledge and propose a canonical review. No keyword heuristic decides meaning.
No OpenAI API integration or semantic assessment is implemented here.

`proofreading: not-run` is a distinct hook. Later spelling/grammar service should
flag likely errors and suggest corrections while preserving voice and meaning.
It must never silently rewrite customer text; proofreading and substantive rewriting
remain separate. Current validation checks plain-text safety and bounds only.

Draft, review and publication are separate boundaries. This slice has local drafts
and reviewed canonical promotion; it implements no published snapshot or publish
writer. See [the promotion](miopages-canonical-promotion.md) and
[the next architecture boundary](deferred-architecture.md#media-acquisition-and-external-intelligence-pipeline).
