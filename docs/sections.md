# Editorial Section presentation

Finite [canonical source bindings](canonical-foundation.md#finite-section-sources)
now project confirmed public knowledge and approved Offering/component/pricing values
into existing Section DTOs before normalization. Unbound Sections are unchanged.

Sections remain structured content, not a free-form page builder. `normalizeSection`
is a read-time projection shared by the managed site service and renderer. Unknown
Section types are omitted; malformed fields and unknown configuration keys are
ignored. Stored JSON, identity, version and timestamps are never rewritten.

Hero, Intro and CTA content is plain escaped text: `heading`, `text`, and one optional
UUID `actionId`. Hero also accepts `eyebrow`. Actions resolve in one tenant-scoped batch through the
existing Action service. Unavailable or unsafe Actions are omitted independently
of content. Labels and destinations belong to Action, never Section JSON.

Body text in Hero, Intro, CTA, collection introductions and collection cards uses
the same plain-text paragraph renderer. CRLF/CR line endings normalize to LF;
blank lines (including whitespace-only blank lines) separate semantic `<p>`
elements. Paragraph edges are trimmed and empty/non-string content emits no
paragraphs. Single newlines stay within one paragraph with ordinary HTML whitespace
behavior. React escapes the text; no HTML or Markdown is interpreted, and canonical
stored content is never rewritten. Headings, Hero eyebrow and Action labels retain
their existing semantics.

Hero and CTA use the `default` variant. Intro supports `stack`, `split-text-first`
and `split-image-first`; null, `default`, and unsupported variants fall back to
stack. Images come exclusively from AssetUsage via the existing presentation
service. Absent images render text-only stacked structure. Both split variants
use heading → image → body → Action in source/mobile reading order, without
duplicate content. At the platform's desktop breakpoint (48rem), grid placement
groups heading/body/Action in the text column: left for split-text-first, right
for split-image-first, with media in the opposite column. Stack remains unchanged.
There is no customer-configurable mobile order or breakpoint.

Contact uses `type = contact`, `variant = default` and
`content.contact_definition_id` referencing a reusable Web Presence-owned Contact
Definition. Optional heading/text stay plain Section copy; fields and accepted
contract live in the definition, phone/email in canonical business identity.
See [Contact/forms](contact-forms.md) for validation and activation gates.

Validated `Section.configuration` options:

| Key | Values | Default / meaning |
| --- | --- | --- |
| anchor | Existing safe fragment identifier | Omitted if invalid; same destination grammar as Navigation |
| width | reading, standard, wide | standard; platform inner limits of 42, 64, 80rem |
| spacing | compact, normal, spacious | normal; 0.5, 1, 1.5 times Design System section spacing |
| alignment | left, center | left; copy/headings/action only, never media placement |
| surface | default, subtle, accent, contrast, editorial | default (CTA: subtle); background, surface, accent tokens |
| divider | none, rule, spacing | rule preserves existing separation between adjacent sections; spacing adds token-based separation, none adds no separator |
| mediaFit | natural, contain, cover | Intro only; natural preserves intrinsic ratio without cropping |
| composition | asymmetric-field, editorial-row, statement-break, image-evidence, grouped-field, conversion-band | reference v2; validated by Section type and resolved semantic role; see finite vocabulary below |
| treatment | statement | Intro only; explicit editorial emphasis in reference v2, with readability fallback; absent/invalid stays ordinary Editorial |

Every outer section spans its container; width constrains the inner content.
No separate full-width flag is needed. Explicit contain/cover modes use a single
platform-owned 4:3 frame; contain keeps the complete image, cover may crop.
Rounding comes from the existing radius token. Default documentation imagery
should remain natural (or contain when a frame is wanted).

Surface text and buttons use existing Design System roles. Accent surfaces use
onAccent for text, with reversed accent/onAccent buttons and visible focus rings.
Design System owners remain responsible for choosing contrasting color pairs;
this slice does not introduce color authoring or contrast enforcement.

No schema, migration, seed, content or Asset association changes are required.
The deferred register was reviewed: no new writer, editing, publishing, routing,
Asset lifecycle, usage-metadata override, or Content Engine trigger is reached.
Customer-owned semantic configuration remains separable from platform CSS.

## Collections

`type: "collection"` adds curated, ordered items with one structural variant,
`grid`. Missing or unsupported variants normalize to `grid`. It inherits anchor,
width, spacing, alignment, surface and divider choices above. `configuration.columns`
accepts numeric `2` or `3`, defaulting to `2`; strings and other values fall back
to `2`. Media configuration has no effect on collections.

Collection content has optional plain-text `heading` and `text`, plus a required
`itemSource` discriminant and ordered `items`:

```json
{
  "heading": "Benefits",
  "itemSource": "inline",
  "items": [
    { "id": "easy-start", "heading": "Easy to start", "text": "A clear first step." }
  ]
}
```

- `inline`: each item has a stable `id`, a nonblank `heading`, optional plain-text
  `text`, and optional UUID `actionId`.
- `subjects`: each item has a stable `id`, a UUID `subjectId`, and optional UUID
  `actionId`. Names and descriptions always come from the canonical Subject, never
  overrides or copies in Section content. Subject status/type/identity stay owned
  by Subject; this is not a new entity domain or a detail-page binding.

Item IDs are Section-local, case-sensitive strings of 1–100 ASCII letters, digits,
underscores or hyphens, starting with a letter or digit (UUIDs also fit). They are
not generated from headings or array positions. Preserve them when reordering.
The first valid occurrence of an ID wins; later duplicates are omitted. Malformed
items, missing/invalid IDs, blank inline headings and invalid Subject UUIDs are
omitted. Invalid Action UUIDs remove only the Action reference. Missing/non-array
items become an empty list. An invalid `itemSource` omits the Section rather than
guessing a mode. Unknown fields, HTML controls, Asset references, URLs and embedded
Action labels/destinations are discarded. Plain text is escaped by React.

The managed site service batches explicit Subject IDs in the same Web Presence,
requiring active Subjects and an active Web Presence. Missing, inactive, foreign,
or malformed Subjects are omitted. Subject Type is not a collection filter or
publication gate. Active eligibility uses the existing public presentation model;
no new publishing state is implied. Resolution produces small presentation DTOs,
then walks the Section item array to preserve order regardless of database order.
Subject-derived copy lives only in those transient DTOs, never stored Section JSON.

All item Action references join the same batch as Hero/Intro/CTA references through
the existing first-class Action service. Missing, inactive, foreign, malformed or
unsafe Actions are omitted while valid items remain. There is at most one Action
per item and no collection-level Action. No destination is inferred from a Subject.

Cards form a semantic list in source/keyboard order, with h3 headings under the
Section h2 when supplied. Cards use existing Design System surface/text/border,
spacing, typography and radius tokens, and the shared Section Action presentation.
Cards retain their own surface and matching text/Action roles even when the outer
Section uses an accent surface. Center alignment applies to both introductory
copy and cards. Empty resolved lists produce no empty grid.

Responsive behavior is platform-owned and based on inner container width: one
column below 36rem, two from 36rem, and three from 60rem only when `columns: 3`.
Thus reading-width sections remain at most two columns. Columns use equal,
shrinkable tracks; no source-order changes or per-item spans are supported.

This foundation adds no content, seed writes, card images, Subject hierarchy,
automatic selection/query UI, taxonomy, page routing, nested collections, custom
CSS or free-form grid controls. No schema/migration or new deferred-register
trigger is required; Asset write/integrity behavior is unchanged.


### Explicit Editorial statement treatment

`configuration.treatment: "statement"` is an explicit finite presentation value.
It is validated only for `intro` and consumed by reference v2. There is no new
Section type, schema or migration. Missing/invalid treatment, v1/legacy direction,
associated image, absent/blank heading, heading over 120 characters or 18 words,
support over 360 characters or over two nonempty paragraphs all retain ordinary
Intro/image-led presentation. No content is removed, truncated, inferred or rewritten.
The bounds permit a compact support block rather than requiring copy changes.
The explicit `composition: "statement-break"` additionally permits support up to
900 characters / five paragraphs, rendered separately at reading scale. Above
those bounds, the complete copy remains ordinary Intro. Composition alone never
selects statement meaning.

Eligible statements retain h2 and plain escaped paragraphs, use a bounded larger
scale/shorter measure, spacious default, and an optional secondary-accent wash.
Explicit width/spacing/alignment/surface/divider choices remain authoritative;
even an invalid explicitly present surface suppresses the automatic wash. Trusted
decoration policy disables the wash. Selection is explicit, never based on text,
position or data source. One per Page is an authoring recommendation, not an
ordering-dependent renderer cutoff. Image-backed Intros preserve their existing
layout/alt/source-order contract.

### Versioned visual expression

[Reference v2](visual-direction.md#reference-v2-expression-contract) strengthens
Hero typography/composition, role-led rhythm and CTA emphasis. Hero is neutral by
default, collections subtle, explanations neutral and CTA accent; spacing is
spacious for airy arrival/statement/CTA and normal for explanation/groups/images.
Explicit Section choices
remain authoritative. Hero eyebrow uses the existing content field; no decorative
text is generated. Desktop split variants and mobile heading/image/body/Action
source order remain unchanged. Framed images have no outline; v2 keeps the normal image presentation clean
without a forced frame or shadow. Explicit elevated treatment is still available. Explicit bordered remains distinct.
Asset/AssetUsage identity and alt semantics do not change.

Hero/CTA Actions expose the bounded `primary` role, other Section/card Actions
`supporting`; labels/destinations remain first-class Action data. Hero emits named
eyebrow/heading/support/action parts only when present; no automatic ornament.
See the [staged Hero contract](visual-direction.md#staged-hero-and-page-motion-contract).

### Finite composition vocabulary

Reference v2 additionally consumes validated type-specific composition choices:
Hero asymmetric-field; Intro editorial-row, statement-break or image-evidence;
Collection grouped-field; CTA conversion-band. There are no arbitrary columns,
spans, pixels, breakpoints, HTML or CSS. Incompatible role/alignment/width choices
fall back safely. Contrast and editorial are finite Design System-derived surfaces.
See the [composition contract](visual-direction.md#finite-semantic-compositions).


## Commercial structured content

Contract-version-2 presentation uses normalized content and a resolved presentation
plan; legacy compositions retain their rendering. See [Visual Direction](visual-direction.md#commercial-presentation-contract-version-2).
Hero `valuePoints` contains two to four stable-key `{id, heading, text}` entries,
without HTML. These are approved content, never generated by the renderer.

`relationship` is a Section type with content `contractVersion: 1`, `kind`, optional heading
and text. Kinds are finite:

- `stages`: two to eight ordered `{id, heading, text, actionId?}` items. Content order
  is authoritative. Supported complexity is not a mandatory lifecycle stage.
- `scope`: two to eight such items, each categorized `included`, `boundary` or
  `extension`.
- `responsibilities`: two to three keyed named `parties`, and one to ten keyed
  `rows` with label and exactly one `{partyId, text}` cell per party. Cells resolve
  in declared party order, presenting an aligned relationship rather than cards.

Stable keys are unique and bounded; text is plain and length-bounded. Arbitrary HTML,
unknown fields, malformed versions, unmatched parties and excessive counts refuse
preparation. Item Action references resolve through the same owner-scoped Action
lookup as existing Sections.

The finite `offering-relationship` canonical binding accepts an Offering ID, kind
`stages` or `scope`, and one to six component keys. Public eligibility and ownership
remain authoritative. Stages reject supported-complexity components; scope condenses
approved inclusions/boundaries and selected complexity. No price fields are copied.
Responsibilities remain Page-owned approved editorial content. Projection never
parses arbitrary prose into a structured relationship at rendering time.

Contract-v2 CTA presentation chooses integrated invitation, focused next step or
closing emphasis. These use existing authoritative Action references; no form or
workflow is created. Explicit finite choices override recipe/grammar defaults.

## Connected service and preview artifacts

Relationship content version 2 extends ordered `stages` with an optional bounded
`extensions` list (one to three), each containing stable `id`, existing `stageId`,
plain `heading` and `text`. Extensions attach to a named stage; they never become
mandatory lifecycle items. Version 1 semantics remain unchanged. Scope and named-party
responsibilities retain version 1. Writers refuse unknown keys, markup, duplicate
keys, unknown stage targets and incompatible kinds. No prose is parsed into structure.

Service-led v2 connects stages across desktop/tablet and preserves the same ordered
relationship vertically on mobile. Expanded Launch attaches to Launch in the preview.
No dates, durations or invented canonical facts are added. Presentation may explicitly
select `relationship: connected-service` only for compatible stages.

Preview-only `previewMedia` supports service illustration, process relationship,
Review/report artifact, evidence/project position and explanatory visual roles.
Every slot is visibly FPO, preview-only and permission-unresolved. Intended aspect,
importance, purpose and likely production source support later asset resolution.
Normal deployment eligibility always refuses FPO; configuration alone cannot enable
it. Explanatory artifacts are illustrative labeled outlines, not assessment data.
General image galleries, approved evidence collections and technical tables remain
separate deferred contracts.
