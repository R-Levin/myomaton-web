# C0 states we can go back to

Recorded Nov 27 at the Principal's request ("record everything into logical containers so we might
go back to one of the old states"). Each state has four containers:
- **Code:** a Git tag.
- **Core's record:** which Version of each Work product was current. Core keeps every Version ever
  made (nothing is overwritten), and the full record is also copied privately in
  `runtime-content/snapshots/2026-11-27-night-c0-record/`, outside Git because it holds Client
  data.
- **WordPress:** what was delivered where.
- **A PDF:** a picture of it.

Times are UTC.

## State A: "inflection point" (Nov 26 evening, unchanged until Nov 27 morning)

The site the Principal judged "might work in production", though still too like the old one.

| Container | What |
|---|---|
| Code | tag `c0-state-a-2026-11-26` (commit f85593c) |
| Core's record | Report v4, Direction v6, Site plan v1; Pages: Home v2, How It Works v1, Managed Web Presence v2, Scope & Fit v2, Free Review v2, Pricing v2, Ownership & Exit v2, Proof v3, Questions v2, Direct Start v2; 34 pictures |
| WordPress | local preview only (it's rebuilt on every restart; it was never on miopages.org) |
| PDF | `runtime-content/ai-runs/c0-milestone-3/site-draft-5/miopages-with-pictures-desktop.pdf` |

## State B: "Nov 27 night" (now)

The site the Principal judged "a bloated, inexplicable deformed clone".

| Container | What |
|---|---|
| Code | tag `c0-state-b-2026-11-27` |
| Core's record | Report v4, Direction v14, Site plan v3 (with footer); Pages: Home v3, How It Works v2, Managed Web Presence v3, Scope & Fit v3, Free Review v3, Pricing v3, Ownership & Exit v3, Proof v4, Questions v3, Direct Start v3; 34 pictures, about 80 FPO frames |
| WordPress | miopages.org draft pages 82–91 (revision 1 of the connection to the new Core); database exported to `~/miopages-private/snapshot-2026-11-27-night-miopages-org.sql.gz` on miopages.org |
| PDF | `runtime-content/ai-runs/c0-milestone-3/site-draft-10/review-draft.pdf` |

In between (Nov 27 afternoon), Direction v7–v13 and drafts 6–9 were way-stations, not states to
return to.

## Older states on miopages.org

- Nov 23 drafts from the old Core (Codex-era engine): pages 53–61, still on miopages.org.
- The old plugin 0.1.4, theme 0.1.2 and connection settings are archived in
  `~/miopages-private/archive-nov27-*` on miopages.org.

## How to go back

- **Code:** check out the tag on a new branch. Never reset the working branch.
- **Core's record:** the earlier Versions are all there. Making one current again needs a small
  "restore this Version" action in the engine; it isn't built yet, and it costs nothing to build.
- **WordPress:** send the restored Versions as a new draft, or restore the database export
  (a hosted change: the Principal's OK first).
