# Curated font resources

The immutable Source Editorial v1 and Source Sans v1 systems select these resources. No remote
font service, customer uploads, per-element selectors or font editor is supported.
Self-hosted WOFF2 has no visitor request to Adobe or GitHub. CSS declarations do not
load fonts by themselves; service-led v2 preloads all three faces, while service-led
v3 selects/preloads only Source Sans regular and semibold. The
unchanged legacy root still declares its existing Geist resources for legacy paths.

| Resource | Official release | Selected face |
| --- | --- | --- |
| Source Serif 4 | [Adobe 4.005R](https://github.com/adobe-fonts/source-serif/releases/tag/4.005R) | upright semibold, TTF-flavored WOFF2 |
| Source Sans 3 | [Adobe 3.052R](https://github.com/adobe-fonts/source-sans/releases/tag/3.052R) | upright regular and semibold, TTF-flavored WOFF2 |

Files are unmodified official release builds. Each directory preserves the release's
SIL Open Font License and copyright metadata (license trailing whitespace normalized).
Registry SHA-256 values are verified
by tests. Total selected font bytes: 299,264 before transport compression. No italic
face is selected. Missing-resource diagnostics use named resource IDs, never local
paths; Georgia and Arial provide deterministic family fallbacks. Browser rendering
checks verify actual loaded Source families. Additional curated resources require a
reviewed release, license, performance budget and coordinated grammar system.
