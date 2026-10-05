# Myomaton Visual Direction v1

Customer #1 transition **historically applied to the real development database**.
Its reference-v1 result is the frozen pre-v2 baseline, with eight migrations, four
Pages and 29 Sections. The real development customer now uses reference v2 after
the [applied and verified v2 transition](myomaton-visual-direction-v2.md).
PostgreSQL remains canonical; this document preserves the historical v1 contract.
This is an application of the [existing runtime](visual-direction.md#runtime-contract),
not a template, seed/bootstrap change or Myomaton-specific platform profile.

## Frozen pre-transition baseline and applied intent

Web Presence `1b72cd7d-92b9-4f55-aba6-825d69d493af`, Managed Site
`7fd60824-a933-401d-8099-7b64f24cc408`, with empty site configuration, eight
migrations and Home/About/Projects/Principles (9/6/7/7 Sections). The frozen UTC
baseline includes current customer rows, timestamps and migration journal. Three
Assets and three usages include the original Home image, Projects TaBot reuse and
A-Bot angle; A-Bot close-up remains unattached. No Contact definition exists.

The applied database change added this Managed Site configuration key:

```json
{
  "visualDirection": {
    "profileId": "reference",
    "profileVersion": 1,
    "preferences": {
      "hero": "graphic",
      "density": "airy",
      "motion": "light"
    }
  }
}
```

The generic versioned profile supplies confident type, alternating surfaces,
framed images, subtle elevation, opaque Header and functional icon intent.
Only the three permitted preferences are recorded; primitive colors, fonts and
resolved CSS are not duplicated. No logo/contact/social facts are invented.

This is the closest current bounded expression of **technical curiosity / serious
fun**: stronger text-led Heroes, clearer hierarchy and grouping, more deliberate
photograph framing and restrained surfaces rather than futuristic effects.

## Expected presentation

All four Heroes become graphic, with a display maximum derived as 1.25 times the
existing heading size (67.5px for the current 18px × 3 Design System). Section
heading scale becomes 1.85 times body size. No font or copy changes. Airy section
spacing uses the existing spacious semantic value; all current Sections lack an
explicit spacing or divider, so they become spacious with no divider rules.

Surface sequences in Section order (`base` = default, `alternate` = subtle):

| Page | Sequence |
| --- | --- |
| Home | base, alternate, base, alternate, base, alternate, base, alternate, alternate |
| About | base, alternate, base, alternate, base, alternate |
| Projects | base, alternate, base, alternate, base, alternate, alternate |
| Principles | base, alternate, base, alternate, base, alternate, alternate |

Closing CTAs retain the runtime's subtle default. Explicit variants, grid columns,
anchors and natural image fit remain authoritative. Projects keeps TaBot text-first
and A-Bot image-first on desktop; mobile heading/image/body/Action order is unchanged.
The three existing image presentations gain frames without changing Asset or usage
identity, alt text, files or routes. Header/Footer structure is unchanged; Header
gets airy density/subtle elevation, Footer the shared readable surface/link roles.
Inline links remain underlined, Navigation/Actions distinct, and Contact styling
is ready without creating any form or Contact state.

Stored motion intent is Light, not permission to bypass policy. With the current
absent service policy override, runtime defaults cap it at **Minimal: one Hero
consumer per Page**. If trusted service policy later permits Light, each current
Page has only two eligible consumers (Hero and closing CTA), below the ceiling of
three. Effects are serialized 180ms/3px settles, never hidden content, disabled by
reduced-motion. This updater does not change service policy or deployment settings.

The stored accent remains green `#214e43`; no secondary accent is stored for this
customer. The reusable optional secondary-accent contract and v2 compositions are
now implemented, but are outside this historical v1 transition. Expanded icons
(P23), split-media Hero, sticky Header and bespoke composition remain outside it. P9/P10 remain deferred. No capability
catalog status changes follow from applying one customer's configuration.

## Operator guard and lifecycle

The historical explicit operator command is
`npm run update:myomaton-visual-direction-v1`. Do not run it as seed/bootstrap.
Its application contract is 0 inserts, 1 update, 0 deletes; exact rerun writes
nothing. This checkpoint does not execute the updater. Future v2 changes need a
new separately authorized guard; do not revise or repurpose the frozen v1 writer.

The operator uses a transaction with bounded lock/statement timeouts and maintenance
locks on the reviewed customer tables. It compares all baseline rows and migration
entries, then accepts only the exact original state or exact intended state. Wrong
identity, existing customized/partial direction, extra/changed configuration,
customer content drift or migration drift refuses. There is no force/reset mode.
This intentionally conservative frozen development baseline also refuses unrelated
new records; it does not infer approval for evolving customer state.

The parameterized update adds only `configuration.visualDirection` via `jsonb_set`.
Other configuration keys are preserved by the operation, but unreviewed keys cause
preflight refusal. Existing version, timestamps, metadata and all other records
remain unchanged: this bounded transition writes only the specified configuration
key. A postcondition read verifies the exact intended state before commit; any
failure rolls back. Exact rerun performs no UPDATE, including timestamp changes.

After application, PostgreSQL owns the result. Future changes need a later guarded
customer-state operation or authorized editing mechanism, not edits to this frozen
definition followed by rerunning it. Older Home/secondary-page transition guards
remain unchanged and may correctly refuse the evolved site state.

## Review and verification

Isolated tests cover baseline application, exact rerun, preserved records,
configuration merge/refusal, wrong ownership, partial/malformed/conflicting state
and rollback. A disposable PostgreSQL fixture exercises the actual SQL, rollback
and no-op. Production preview serves the copied four-Page state with the intended v1
configuration; live public tables are read-only and managed files are only read.
No real updater execution is part of this checkpoint or disposable preview.

The v1 transition review concerned Hero proportions, its surface cadence, framed photographs,
Header/Footer and grouping at phone/tablet/desktop widths. The richer v2 preview has since received human
visual acceptance for checkpoint purposes only; its customer transition remains separate.
Check keyboard focus, navigation/Action destinations, both split variants and
reduced motion. HTML/data-attribute verification demonstrates the selected contract;
it does not substitute for customer approval of the visual result. This transition
does not silently adjust any Page structure or copy to improve a preview.
