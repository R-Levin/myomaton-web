# Canonical Business Knowledge and Offering foundation

## Scope

Phase 1 implements customer-owned knowledge/Offerings, local operator services,
bounded revisions and read-time projections. It creates no customer records and
does not implement onboarding, Review, AI, analytics, billing or production management.
See the [C0 handoff](miopages-c0-implementation-plan.md) and [gates](deferred-architecture.md).

The [MioPages customer slice](miopages-c0-canonical-state.md) separately exercises
these generic contracts through a guarded operator initializer. Its provisional
customer choices are not platform defaults; no publication workflow is implied.

The later [reviewed canonical promotion](miopages-canonical-promotion.md) adds
Offering continuity and commercial-structure projections while preserving business
truth and its revisions. [Bounded text drafts](content-authority-and-editing.md)
classify canonical, editorial and system text, retain reconciliation/proofreading
context and refuse local factual overrides. They grant no presentation or publish control.

## Knowledge and identity

One `business_knowledge` current record per Web Presence accepts a closed version-1
payload: entries, identityEvidence and approval. Entry kinds are audience, goal,
service-area, differentiator, constraint and preference. Stable keys and bounded
plain values carry source/reference, confirmed/provisional status and internal/public
visibility. Confirmation requires responsible identity/time. Unknown stays omitted.
No arbitrary fact paths, HTML, interview state or AI confidence scores.

`WebPresence.configuration.business` remains the current identity authority.
Identity evidence stores field/digest/evidence, not duplicate values. `identityConfirmed`
checks the live digest; changed identity invalidates stale evidence without rewriting
history. The identity update/authorization workflow remains separately gated.

## Offering and commercial terms

Offering columns own ID, presence, local key, service/product type, name, active/inactive
status and version. Strict payload owns summary/detail, audiences/outcomes,
inclusions/exclusions, Action UUIDs, third-party cost notes, components, evidence and
approval. Subject is unchanged. Assets are associated through AssetUsage.

Embedded component kinds are establishment, ongoing and supported-complexity; names
are customer data. Components include stable key, summary, inclusions, boundaries,
optional timing guidance, commercial relationship, complexity notes and optional pricing.
There are no package or Price tables.

Price modes: fixed, included, scope-confirmed, not-published. Only fixed accepts an
integer nonnegative minor-unit amount. USD/EUR/GBP use two minor-unit digits. Basis is
one-time or recurring (month/year). Applicability is component or named complexity
increment. Approved public prices use one formatter; provisional hypotheses remain
labeled provisional. Missing is not zero; scope-confirmed has no amount. Third-party
cost notes remain separate. No checkout, tax, discounts, billing or scheduled activation.

## Scoped writes and bounded history

`inspectCanonical` returns current state/fingerprint. `writeCanonical` requires
explicit owner/record IDs, expected version/fingerprint, local attestation and reason.
It locks active owner/current record, checks references and commits current state plus
complete revision atomically. No public management API or authentication is claimed.
Changed versions require fresh approval; changed pricing requires fresh price approval.

Current record must match its revision. Partial/customized state refuses. Exact semantic
reruns create no writes, timestamp changes or history. Initial exact retries and guarded
predecessor retries are recognized. Conflicts and forced failures roll back. Unrelated
presence configuration stays untouched.

Knowledge/Offering revision tables enforce same-owner parent FKs and unique parent/version.
Triggers refuse normal UPDATE/DELETE. Writers stop at 100 revisions per record instead of
silently pruning approval evidence. This capacity guard is not a completed retention
service: privileged reviewed retention/offboarding needs later policy/implementation.
No unlimited transcripts or permanent archive is introduced.

## Finite Section sources

| Role | Reference | Existing Section |
| --- | --- | --- |
| knowledge | knowledgeId and selected keys | Intro / Collection |
| offering-overview | offeringId | Hero / Intro |
| offering-component | offeringId and componentKey | Intro |
| offering-pricing | offeringId | Collection |

Content uses `source` and optional contextual heading/text. Canonical overview/component
headings cannot be overridden. Unknown/duplicate fields or expression paths fail closed.
Reads batch within selected presence and require public approval plus confirmed/public
evidence. Missing/foreign/ineligible sources omit the Section without stale inline fallback.
Existing DTOs/compositions render projected values; no generated copy is persisted.
Unbound Sections retain behavior.

Offering image usages target `offering`, role `image`, with singular attachment,
same-owner checks and existing `configuration.image` accessibility metadata.
Offering image changes use the same expected-state writer and approval; the complete
revision includes related AssetUsage snapshots, so association drift also refuses.
Only a valid approved Offering-overview Intro binding on active selected-site content exposes that image.
Ownership alone does not expose bytes; existing Section/logo presentation remains.

## Deployment and remaining boundaries

Both `WEB_PRESENCE_ID` and `MANAGED_SITE_ID` are required explicit UUIDs selecting an
active ownership relationship. No runtime name search, first-record or Myomaton default.
Pages, Contact and media use the same scope. Historical services retain explicit domain/name
entry points; these are not runtime fallbacks. `MANAGED_ASSET_ROOT` wins over the temporary
`MYOMATON_ASSET_ROOT` alias. Root metadata is neutral; Page metadata comes from selected state.

Shared host routing, production Contact and management authentication remain deferred.
Disposable tests are the mutation boundary. Migration has no backfill. C0 dataset creation,
publication and final Visual Direction need separate authorization.
