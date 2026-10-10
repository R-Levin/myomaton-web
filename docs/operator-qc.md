# Local operator QC and visual resolution

**Automation classifies and prepares. Operator QC decides whether the result is
customer-ready.** The operator resolves ambiguity and selects supported strategies;
this is not a design editor or bespoke design service.

## Dual review and service boundary

Operator QC precedes customer review. It checks visual needs, semantic fit,
canonical consistency, content, conversion paths, rendering and readiness.
Customers review outcomes, accuracy, voice, emphasis and appropriateness—not
implementation details. Interpret presentation feedback through the underlying
visitor/business goal and the bounded design system. Pixel adjustments, arbitrary
fonts/layouts and endless concepts are outside the service envelope. Necessary
factual corrections must not be refused because discretionary revision limits
were reached. Final operator QC, asset eligibility and publish authorization
remain separate gates.

**YOU CONTROL THE TRUTH. WE CONTROL THE SYSTEM THAT TURNS IT INTO AN EFFECTIVE WEB
PRESENCE.** MioPages is not a page builder or unlimited design service. The customer
owns facts, offer, priorities and voice; the service owns structure, presentation,
conversion architecture, technical implementation and supported optimization.

Evaluate accuracy, relevance, clarity, trust and conversion effectiveness—not
novelty or arbitrary preference. Every finding records the visitor problem and
the improvement that can be reviewed. **Outcome before activity:** further runs
need evidence of progress. Bounded automation stops at work limits; overrides
must be scoped, attributable, reasoned and auditable. No universal dollar limits
are established by QC, and this harness cannot dispatch or escalate work.

## Implemented first slice

The [CLI](../scripts/operator-qc.ts) prepares a local packet from the actual selected
canonical customer/site and optionally reads an explicitly supplied private pilot
schema. Database reads use repeatable-read, read-only transactions. The renderer
uses loopback `next start` with a read-only public-schema database connection and
explicit Web Presence/Managed Site selection. No customer write, media decision,
ingestion, generation, provider call or publication path is implemented.

Packet version 1 binds exact owner/site identities, complete customer-state hash,
owned graph hash, acquisition snapshot hash, presentation/design configuration and
production build identity. Every subsequent command rereads that context; a stale
or altered basis refuses rather than silently refreshing approvals. Technical
evidence records actual route markup digests and a collected-render identity.

Reports, screenshots, findings and proposed strategies live only under ignored
`runtime-content/operator-qc/<packet-id>/`. They are **not durable canonical
authority, customer acceptance or a customer-preview access gate**. No QC schema
is added. Reusable source lives under lib/scripts/tests.

## CLI workflow

Build before collecting rendering evidence. Prepare the current MioPages packet:

```powershell
node --import tsx --env-file=.env.local scripts/operator-qc.ts prepare --miopages --render --acquisition-receipt runtime-content/acquisition/canonical_test_d4f17dcfacb644aca5624f38c1a40744_acquisition.json
```

Preparation prints the packet UUID and report location. For another owned site,
replace `--miopages` with explicit `--organization`, `--web-presence` and
`--managed-site` UUIDs. The receipt is optional; unavailable history is disclosed,
not treated as zero activity. Browser evidence reuses the locally available
Playwright tooling and Chrome. If tooling is absent, evidence remains failed/
incomplete and readiness is refused. `QC_BROWSER_EXECUTABLE` can select another
supported local browser executable. No operator profile is attached.

Subsequent commands take `--packet UUID`. Findings, closure, resolution and brief
commands ask bounded questions; operators do not edit JSON.

```powershell
node --import tsx --env-file=.env.local scripts/operator-qc.ts show --packet UUID
node --import tsx --env-file=.env.local scripts/operator-qc.ts check --packet UUID --check proofreading --status pass --actor operator-id --note "Reviewed all visible copy"
node --import tsx --env-file=.env.local scripts/operator-qc.ts finding --packet UUID
node --import tsx --env-file=.env.local scripts/operator-qc.ts close --packet UUID
node --import tsx --env-file=.env.local scripts/operator-qc.ts resolve --packet UUID
node --import tsx --env-file=.env.local scripts/operator-qc.ts brief --packet UUID
node --import tsx --env-file=.env.local scripts/operator-qc.ts readiness --packet UUID
```

`readiness` reports prerequisites without attesting. A **human operator** can
explicitly record `--decision ready` or `--decision not-ready`, with `--actor`
and `--note`. Ready refuses when prerequisites fail. This local attestation does
not authorize customer acceptance, public access or publishing. Review edits
invalidate prior readiness; historical attestations remain in the local packet.

## Checklist, findings and proofreading

The twelve checks are visual needs, imagery, content, canonical truth,
proofreading, Actions, conversion path, rendering, accessibility, brand,
completeness and readiness. Each begins **not assessed**. Other statuses are
**pass**, **finding**, and **not applicable**. Not applicable is allowed only for
visual needs/imagery with an explicit reason; mandatory checks cannot be skipped.
Readiness is recorded through the explicit attestation command.

Findings bind owned Page/Section/field/candidate references, check, severity,
problem, evidence, effects, visitor problem, reviewable improvement, responsible
party and next bounded action. Severity is blocker, required correction or
non-critical observation. Resolution requires closure evidence; only non-critical
observations can be deferred with a reason. Arbitrary CSS/layout fields are refused.

No intelligence proofreading is added. Proofreading and semantic contradictions
require operator assessment. Valid canonical projections and safe Action
destinations are evidence, not proof that all editorial wording is accurate.
Text is never silently rewritten.

## Visual classification and resolution

| Classification | Preferred strategy |
| --- | --- |
| literal-subject | Permission-cleared real imagery, suitable stock, illustrative scene |
| simple-story | One bounded before/after; generated or deterministic if clearly illustrative |
| structured-relationship | Canonical component or deterministic graphic |
| proof-evidence | Verified, permission-cleared real material only |
| atmosphere-brand | Generated/stock/authored material that reinforces tone |
| no-visual | Omit forced imagery and use supported presentation |

Classification remains unassessed until operator choice; semantic ambiguity must
not become an automatic generation request. A resolution is a **proposed** choice:
customer-owned, existing-site reuse, stock, generated, deterministic, commissioned,
omit or refine-brief. Ownership/access does not itself establish permission.
The operator assesses criticality and whether the existing safe fallback is adequate,
with evidence and customer disclosure. No proposal changes canonical VisualNeed.

Each need shows purpose, role, importance, surrounding projected copy, current
sourcing hint, assets/usages, candidates, immutable identities/provenance, review
events, lineage, attempts, reservations and known/unknown charges. Handling time
is unknown unless recorded; wall-clock elapsed time is not active operator effort.

The Home Hero explicitly presents **atmosphere/brand reinforcement vs deterministic
reinforcement vs no image**. Three candidates inform that choice. Iteration 1 was
rejected as abstract; iteration 2 as overloaded/infographic-like; iteration 3 is
still proposed, with semantic weakness recorded as discussion learning rather
than fabricated rejection history. Its job family has three attempts and $1.50
held reservations against the escalated $1.50 ceiling. Further work requires an
explicit escalation outside QC. No generation is initiated here.

## Structured brief

Briefs bind Section/context fingerprint and classification, semantic goal, optional
subject/scene/setting, visual story, at most five key elements, exclusions,
composition/orientation, style/tone, brand constraints, truth boundary, acceptance
criteria and proposed work policy. Fields are bounded and unknown design-control
fields are refused. Proof/evidence classification requires actual evidence.
Proposed policy contains attempts, retries, budget and stop condition but grants
no authority to execute. Refine-brief requires a locally captured structured brief.

## Evidence and customer-ready assessment

Optional capture checks all active routes at desktop, tablet and mobile widths;
it records route status, actual Page markup identity, overflow, image loading,
missing alt attributes and h1 count, with screenshots. Browser requests are limited
to the loopback inspection server. Keyboard use, contrast, reading order, semantics
and visual/aesthetic quality still require operator review.

Ready requires no open blockers/required corrections; all mandatory checks assessed;
all visual needs assessed, critical needs adequately reassessed; coherent claims,
Sections and conversion path; proofreading reviewed; and complete non-failing
technical evidence. Remaining non-critical limitations require disclosure. Automated
evidence never supplies the operator attestation. Safe omission does not itself
resolve visual intent or revoke accepted Visual Direction.

The immediate next boundary is human completion of the local checklist and the
Hero strategy decision. Durable site-review decisions, customer-facing review,
real asset application and publication authorization remain separate future slices.

See [media acquisition](media-acquisition.md), [content authority](content-authority-and-editing.md),
[service operations](service-operations-model.md) and [canonical promotion](miopages-canonical-promotion.md).
