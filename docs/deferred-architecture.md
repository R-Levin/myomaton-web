# Deferred architecture requirements and decisions

This is an active architecture register, not a general TODO list or delivery plan.
Items come from established platform requirements and the [Asset foundation](assets.md).
Content Engine entries are commitments for future implementation, not claims that
those capabilities already exist. A trigger is an implementation gate, not a date.

## Classifications and status

- **REQUIRED**: established requirement; implementation is pending until its trigger. Do not silently omit it when triggered.
- **DECISION**: established, ongoing constraint that future implementation must preserve.
- **OPEN**: unresolved question; decide when its trigger supplies the necessary context.
- **OPTIONAL**: possible enhancement, not a product or architecture commitment.

All REQUIRED items below are pending at their stated gates; DECISION items apply
continuously; OPEN items remain unresolved. No OPTIONAL items are currently recorded.

## Slice workflow

For each coherent implementation slice:

1. Review this register and identify items whose triggers the proposed work reaches.
2. Satisfy or explicitly reconsider triggered REQUIRED items; never silently bypass them. Record the rationale and revised requirement/trigger if reconsidered.
3. Record material new deferrals, with an explicit trigger wherever possible and a reason when useful.
4. Architecture review must distinguish genuine future requirements from speculative enhancements.
5. Remove resolved items from the active list; preserve only a useful minimal decision or reference after resolution, not a growing completion log.

## REQUIRED: Assets

| ID | Deferred requirement | Implementation trigger / reason |
| --- | --- | --- |
| A1 | Validate AssetUsage target existence and Web Presence ownership, following Page/Section ownership through their parents. | Before introducing AssetUsage writers. The composite FK validates the asset side, not the polymorphic target. |
| A2 | Maintain usages transactionally when references are attached, replaced, removed, or their target is deleted. | When those mutations become possible; reference inventory must describe current state. |
| A3 | Establish a durable `source_type` / `source_reference` contract. Keep stable Asset identity independent of location; canonical records must not depend on transient delivery URLs or credentials. | Before physical storage/provider integration. |
| A4 | Track asset lifecycle and unreferenced state explicitly; do not use `updated_at` as the unreferenced timestamp. | Before retention/purge implementation; see O1 and D1. |
| A5 | Define safe physical-file cleanup for replacement/deletion, including displaced source locations and concurrent references. | Before asset replacement/deletion can leave obsolete bytes or delete referenced bytes. A source-reference overwrite alone loses cleanup information. |
| A6 | Add live PostgreSQL integrity coverage for relevant cross-tenant, reference, and delete constraints. | When Asset write operations are introduced; current tests inspect schema/query behavior without exercising database rejection paths. |

Customer-facing Asset authorization is covered by P7. Asset data **and bytes** in
customer export/offboarding are covered by P5; these are REQUIRED, not optional
Asset enhancements.

## REQUIRED: Platform

| ID | Requirement to implement or preserve | Implementation trigger / reason |
| --- | --- | --- |
| P1 | Keep the platform database canonical for the customer's current Web Presence. Customer edits become canonical and must not be silently overwritten by templates, AI, automation, or reseeding. Seeds/source files must not remain a competing authority. | When real customer editing is introduced, and whenever a later writer can update existing customer state. |
| P2 | Introduce bounded revision/provenance mechanics; distinguish editable/draft, published, and rendered/deployed state. | Revisions/provenance: when customer editing is introduced. Concrete state separation: when editing/publishing workflows require it. |
| P3 | Preserve enough origin/definition ancestry to distinguish platform-managed/default, customer-customized, and deliberately detached state. | Before reusable definitions/templates update existing customer instances. |
| P4 | Implement bounded retention for revisions, obsolete assets, logs, and backups. | When each history starts accumulating real customer data; permanent history is not the default. See D1-D3 and O1. |
| P5 | Provide a usable export of current customer-owned Web Presence state and applicable Asset data and bytes, usable without the proprietary platform. | When customer export is introduced, and before supporting real customer offboarding. |
| P6 | Keep customer-owned state distinguishable from platform implementation/IP. | Whenever a new domain or integration stores customer state; use D4 as the architecture check. |
| P7 | Implement authentication and authorization before exposing customer-facing management operations, including Assets. | Before any customer-facing management surface or API is exposed. Tenant-scoped queries alone are not caller authorization. |
| P8 | Preserve structurally multi-page Microsites; any page-count restriction is product policy, not a schema limitation. | Whenever page management, product limits, or Microsite schema changes are introduced. |
| P9 | Implement robust request-host/domain-to-Web-Presence resolution. | Before production multi-presence/tenant routing depends on request domains. |

## REQUIRED: Content Engine

| ID | Requirement to implement or preserve | Implementation trigger / reason |
| --- | --- | --- |
| C1 | Keep ContentEngine a provider boundary. WordPress is the initial provider, not a core platform assumption. | At Content Engine integration and subsequent provider/domain changes. |
| C2 | Maintain canonical platform state for platform-managed articles; WordPress must not be their only authoritative copy. | Before creating or managing articles through the platform. |
| C3 | Let customers preview and approve managed content before publication unless an explicit autonomy policy authorizes automatic publishing. Make publishing autonomy explicit, such as approval-required versus automatic. | Preview/approval: before managed publication. Autonomy policy: before automated publishing. |
| C4 | Support editing managed Content Engine content through the platform rather than requiring WordPress Admin. | When the managed-content editing workflow is introduced. |
| C5 | Detect and reconcile divergence; direct CMS edits must not be silently overwritten. | When two-way/direct CMS editing becomes possible, including integrations where direct editing is already available. |
| C6 | Distinguish platform-managed content from external/unmanaged CMS content. | When integrating existing Content Engine content. |
| C7 | Constrain the initial WordPress/content model to title, one featured image, and one coherent article body; add structured discovery/SEO/social/taxonomy metadata only when publishing/discovery/optimization needs justify it. | At initial content modeling and each field/model expansion. |
| C8 | Do not expand into general remote WordPress administration without a concrete requirement. Drive Content Engine complexity by discovery, publishing, syndication, attribution, or optimization utility. | At every proposed Content Engine capability expansion. |

## OPEN

| ID | Unresolved question | Decision trigger |
| --- | --- | --- |
| O1 | Exact bounded-retention periods, superseded-asset handling, and archive timing. | When real retention behavior is implemented; resolve before enabling it. |
| O2 | Should retired assets be periodically packaged for customer archival before purge? | When defining customer archival/purge policy, before enabling the affected purge behavior. Packaging is not yet a commitment. |

## DECISION: Ongoing architecture constraints

| ID | Decision | Apply when |
| --- | --- | --- |
| D1 | The platform is an operational current-state system, not a permanent historical archive. Canonical does not mean retained forever. | Modeling canonical state, revisions, and asset lifecycle. |
| D2 | Backup is not archive; backup retention must also be bounded. Long-term archival history beyond the stated retention/export policy is not implicitly the platform's responsibility. | Designing backup, archival, retention, and customer-facing service policies. |
| D3 | Lightweight audit/provenance may outlive full historical content. For stored information, architecture must be able to explain why it is retained and when it can be deleted. | Adding stored information or defining its retention policy; this is not a permanent-audit mandate. |
| D4 | Exportability is an architecture check: new domains must keep customer-owned canonical state clearly separable from platform machinery and capable of eventual export where applicable. | Reviewing every new customer-data domain; implementing export is gated by P5. |
