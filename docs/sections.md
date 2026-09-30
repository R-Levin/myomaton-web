# Editorial Section presentation

Sections remain structured content, not a free-form page builder. `normalizeSection`
is a read-time projection shared by the microsite service and renderer. Unknown
Section types are omitted; malformed fields and unknown configuration keys are
ignored. Stored JSON, identity, version and timestamps are never rewritten.

Hero, Intro and CTA content is plain escaped text: `heading`, `text`, and one optional
UUID `actionId`. Hero also accepts `eyebrow`. Actions resolve in one tenant-scoped batch through the
existing Action service. Unavailable or unsafe Actions are omitted independently
of content. Labels and destinations belong to Action, never Section JSON.

Hero and CTA use the `default` variant. Intro supports `stack`, `split-text-first`
and `split-image-first`; null, `default`, and unsupported variants fall back to
stack. Images come exclusively from AssetUsage via the existing presentation
service. Absent images render text-only stacked structure. Text and Action lead
in DOM/mobile reading order; the image-first variant moves the image left only
at the platform's desktop breakpoint (48rem).

Validated `Section.configuration` options:

| Key | Values | Default / meaning |
| --- | --- | --- |
| anchor | Existing safe fragment identifier | Omitted if invalid; same destination grammar as Navigation |
| width | reading, standard, wide | standard; platform inner limits of 42, 64, 80rem |
| spacing | compact, normal, spacious | normal; 0.5, 1, 1.5 times Design System section spacing |
| alignment | left, center | left; copy/headings/action only, never media placement |
| surface | default, subtle, accent | default (CTA: subtle); background, surface, accent tokens |
| divider | none, rule, spacing | rule preserves existing separation between adjacent sections; spacing adds token-based separation, none adds no separator |
| mediaFit | natural, contain, cover | Intro only; natural preserves intrinsic ratio without cropping |

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

The microsite service batches explicit Subject IDs in the same Web Presence,
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
