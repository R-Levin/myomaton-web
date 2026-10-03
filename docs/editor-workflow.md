# Local homepage workflow

> Historical: this describes the superseded local-file/Puck prototype, not the
> active PostgreSQL-backed Managed Site or an implemented customer editor/publisher.
> Its routes, storage and commands below are retained as historical context.
> Current intended workflows are in [onboarding and optimization](onboarding-optimization.md),
> with implementation gates in [deferred architecture](deferred-architecture.md).

Run `npm.cmd run dev` and open `/editor`.

- **Working copy:** Puck page data and the separate SiteTheme in React state.
- **Recovery copy:** localStorage key `myomaton:home:recovery:v1`, captured every
  five seconds while dirty and on page hide/leave. A newer copy requires an
  explicit Restore or Discard choice. It never writes to the server.
- **Saved draft:** written only by Save Draft. Includes page data, SiteTheme,
  and `savedAt`. Changing either data or fonts makes the working copy dirty.
- **Published:** Publish copies the saved draft and records `publishedAt`.
  Publish is disabled for unsaved work. It never receives working-copy data.

Preview writes a separate browser-local snapshot to
`myomaton:home:preview:v1`, then opens `/preview/home` in another tab. That page
reads the snapshot once, with no editor chrome or server mutation. Reopening
Preview captures the latest working copy. Reloading a preview uses the most
recent preview snapshot in that browser.

## Storage

Application code uses `ContentRepository` (`read`, `saveDraft`, `publish`).
`JsonFileContentRepository` stores `runtime-content/homepage.json`, outside the
application source and ignored by Git. `MYOMATON_CONTENT_DIR` can point to an
alternative directory, including a persistent volume for public rendering.

The document has `schemaVersion: 1`, nullable `draft`, and nullable `published`.
Each version contains a `snapshot: { page, theme }` and `savedAt`; published
content also contains `publishedAt`. The file is created by the first Save Draft,
not by reading the editor or public homepage. Public `/` reads only `published`.
With no published version, it stays blank.

Writes are serialized within one Node process and replace the JSON document
using a temporary file and rename. Expected saved timestamps reject stale
save/publish requests with HTTP 409. Malformed content is rejected; a corrupt
file produces an error rather than silently resetting storage.

## Access and limitations

`editorAvailable` / `checkEditorRequest` are the replacement point for future
authentication. `/editor`, `/preview/home`, and `/api/editor/home` are available
only when `NODE_ENV` is `development`; production returns 404. Mutations also
require JSON and a matching Origin/Host. Do not expose the unauthenticated
development server publicly.

This is a single-process, local-file prototype. It is not a distributed store:
multiple server processes need a replacement repository or external locking.
Public production needs access to the published JSON file on a persistent
filesystem. Browser recovery/preview storage is shared between tabs at the same
origin and can be unavailable or cleared. Recovery is not a backup and can miss
the last few seconds before a crash. After a stale-write conflict, reload and
review the recovery choice; there is no merge UI or revision history.

The preview and public site use `PageRenderer`, Puck's normal `Render` API, the
same two-block configuration as the editor, and the snapshot's SiteTheme.

## Site Styles v1

SiteTheme contains heading/body fonts, base text size, heading scale, accent,
background and text colors, content width, and section spacing. Sizes/scales and
layout use small named presets. Colors accept only six-digit hex colors, not CSS.
All values become shared `--site-*` variables at the page root. Hero and
ContentSection use the same tokens in editor, preview, and published rendering.

Standard block width/spacing follows the site default. Block Narrow/Wide widths
use 70%/125% of the global maximum width; Compact/Generous spacing uses 60%/150%
of the global spacing. Hero offers Standard/Wide; ContentSection also offers
Narrow. Both offer Left/Center alignment. These controls never override the
global fonts or palette. Widths shrink to fit mobile viewports.

The dialog warns about low text/background contrast. Button text is automatically
black or white for contrast against the accent. The hero tint derives from the
accent/background rather than introducing another editable color.

Existing two-font themes receive the new defaults on read. The old ContentSection
`normal` width becomes `standard`; missing block alignment/spacing receive
defaults. This applies to saved, published, preview, and recovery data without
rewriting files or changing save/publish timestamps. The storage format remains
compatible; old content takes on the default token-based appearance.

## Verification

```text
node --test tests/content-workflow.test.mjs
npm.cmd run lint
npm.cmd run build
```

The workflow tests cover file persistence, publish isolation, concurrent/stale
writes, recovery and preview separation, development access, and simulated-DOM
editor actions. The simulated canvas drives Puck's onChange callback; these are
not real-browser drag-and-drop tests.
