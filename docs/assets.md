# Assets and the first managed site image

Assets are customer-owned canonical Web Presence state. Their UUID is logical
identity, independent of storage location, source key, filename, and delivery URL.
Names and sources are not unique. Types/statuses remain open text; version is a
current-record revision, not a history table. Future updates must increment version
and update `updatedAt`. Nullable dimensions allow unknown/inapplicable sizes;
null alt text is unspecified, while an empty string can intentionally be decorative.
The operator photograph command requires approved descriptive alt text.

## Managed source contract

- `source_type = "managed"` identifies a managed-object resolver, not a provider.
- `source_reference` is a durable relative object key, scoped by `web_presence_id`.
  The only accepted form is `objects/<64 lowercase SHA-256 hex digits>`.
  The hash identifies immutable stored bytes, **not** the Asset UUID.
- No absolute paths, credentials, source URLs, signed URLs, or CDN delivery URLs
  belong in this reference or canonical metadata. Object keys are not browser URLs.
- Local bytes live at `<root>/<web-presence-uuid>/<source-reference>`.
  `MYOMATON_ASSET_ROOT` configures the root; the development default is the ignored
  `runtime-assets/` directory. Real photograph bytes are never committed.
- Roots, buckets, credentials, provider selection and CDN configuration are
  deployment configuration. A later object-store adapter can preserve logical keys;
  moving locations or changing a source reference does not change Asset identity.
- The browser receives a generated `/media/assets/<asset-uuid>` URL, dimensions,
  alt text and Asset identity only. It does not receive source keys or filesystem paths.

Generic local storage is media-neutral: it accepts validated bytes, enforces the
current 20 MiB object/read limit, verifies SHA-256, and creates immutable objects
without overwriting existing files. Keys have no extension. Storage neither decodes
images nor infers MIME. Invalid paths, traversal, encoded alternatives, absolute
paths, backslashes, symlinks/junctions at the root or below, and escapes are rejected.
An interrupted write may leave an incomplete object; digest verification rejects it.
Filesystem provisioning is not a PostgreSQL transaction.

Separate ingestion derives format from bytes, never the filename:

- JPEG/JPG, PNG and WebP use Sharp 0.35.4. They are fully decoded, oriented, stripped
  of embedded metadata, and re-encoded in the accepted format (JPEG/WebP quality 90;
  PNG lossless). PNG/WebP alpha is preserved. Dimensions describe the prepared output.
  The pixel limit is 40 million. Animated/multipage inputs are rejected, including
  APNG animation-control chunks and JPEG MPO directories that decoders may flatten.
- SVG uses strict XML parsing with jsdom and DOMPurify's SVG/filter profile. DTDs,
  malformed XML and non-SVG roots are rejected. Scripts, event handlers, style/CSS,
  foreign content, animation, embedded images, links/use and external references
  are removed. Paint-server URLs may reference local IDs only. Sanitized output is
  parsed again as SVG and stored as `image/svg+xml`; it is never rasterized. Numeric
  dimensions or viewBox provide presentation dimensions when available; otherwise
  canonical dimensions are null. This is a focused static-SVG policy, not an editor.
- PDF uses PDF.js to parse the catalog/page tree after checking the PDF header and
  EOF envelope; unreadable, encrypted (no password supplied), empty and malformed
  documents fail. Accepted bytes are preserved as `application/pdf`, type `document`,
  with null dimensions. No rendering, text extraction or optimization occurs.
  Validation is structural, not malware scanning or removal of PDF active content;
  PDFs are delivered as downloads with restrictive security headers.

Raster/SVG records have type `image`. SHA-256 always covers the exact stored
representation, including sanitized SVG. Delivery rechecks MIME/content outside
storage and rejects SVG that is no longer the canonical sanitized representation.
Keep originals separately if needed; ingestion does not archive them.

Managed video ingestion is disabled. The neutral source contract can accommodate
future media after the required large-media policy decision (A7).

The store is operator-controlled and must not be writable by untrusted processes.
Filesystem checks are not an OS sandbox against a privileged process concurrently
swapping directories. Local storage requires a persistent writable volume; it is
not durable storage for an ephemeral/serverless deployment. No provider framework,
upload UI, automatic storage migration, or image-rendition pipeline is introduced.

The validator dependencies are DOMPurify 3.4.16, jsdom 30.1.1 and PDF.js
(`pdfjs-dist`) 6.3.289; jsdom types are development-only. Use a supported Node
runtime satisfying their engine requirements (validated here on Node 24.18.0).
PDF.js's in-process parser worker is explicitly imported so production bundling
includes it. The production integration mode exercises all five MIME types through
the built route with disposable records and synthetic files outside the project.

## Association and write integrity

AssetUsage is the sole canonical Section-to-Asset association. The first renderer
uses `entity_type = "section"`, the real Section UUID, and `role = "image"` on
`intro` sections. Section JSON contains neither an Asset ID nor a delivery URL.
The database permits multiple Assets per role generally; this writer enforces one
image by locking the Section and its ownership chain before checking associations.
PDF attachments use `role = "attachment"` with the same singular-role locking protocol.
All future writers of either singular role must use that protocol. No schema or
format-specific AssetUsage fields are introduced; the intro renderer still shows images only.

The composite FK enforces usage-to-asset Web Presence ownership and prevents
referenced Asset deletion. Polymorphic target existence/ownership is enforced by
the narrow writer through Section -> Page -> Managed Site -> Web Presence. Incorrectly
scoped or ambiguous target associations are rejected, not silently replaced.

Asset creation and usage creation run transactionally. Bootstrap target lookup is
also locked in the transaction. An exact existing Asset-ID association is a no-op,
including when canonical Asset metadata/status differs from the command arguments.
Otherwise an occupied image role is a conflict. An existing Asset may
be reused only when ownership, active state, type, MIME, source and dimensions agree;
its metadata is preserved. No Section fields, timestamps, versions, or metadata
are modified, and no bootstrap marker is stored anywhere.

File provisioning occurs only after association conflict checks. File errors roll
back database writes. PostgreSQL cannot roll back filesystem changes: a successful
file write followed by a database failure can leave an unreferenced immutable file.
It remains available for explicit retry/operator inspection; this slice neither
silently deletes it nor treats it as an archive. Automated cleanup and crash recovery
remain part of the existing lifecycle/physical-cleanup deferrals.

## Explicit operator bootstrap

For standalone managed Assets without Section/Page attachment, use:

```powershell
npm.cmd run assets:import -- --web-presence-id "<existing-active-uuid>" --file "C:\Photos\robot.png" --asset-id "<chosen-stable-uuid>" --name "Robot" --alt "<approved description>"
```

Repeat `--file`, `--asset-id`, `--name` and `--alt` once per item; each list is matched
by occurrence order. The batch uses existing supported-format preparation and
configured runtime storage, preserves PNG as PNG, and creates active managed
Assets only. It creates no AssetUsage and never alters existing records. Source
files remain external; prepared immutable objects belong in ignored/runtime
storage. Unattached Assets do not pass the current public delivery eligibility.

All inputs are prepared before writes. An existing UUID (any tenant), or an
existing managed source key in the requested Web Presence (any status), refuses
the whole batch before provisioning. Duplicate prepared bytes/UUIDs within the
batch also refuse. The model still permits nonunique source references: the command
does not invent a global uniqueness constraint, auto-reuse, overwrite, or merge.
It uses a short Asset-table maintenance lock with a 5-second lock timeout to
protect checks against concurrent inserts; the active Web Presence is locked
against reparenting/deletion. PostgreSQL inserts commit together. As with photograph
bootstrap, files cannot roll back with the database and may remain as immutable,
retryable objects after failure; no automatic file cleanup is performed.

The isolated PostgreSQL suite covers this writer's FK-backed creation, no-usage
behavior, PNG bytes/dimensions, duplicate refusal (including inactive Assets),
cross-tenant UUID conflicts, rollback/retry and concurrent duplicate attempts.
No new schema/migration or Asset attachment/lifecycle operation is introduced.
The deferred register's A6 writer gate is covered by these fixture tests; existing
lifecycle, cleanup, authorization, editing and publishing gates remain deferred.

Normal `db:seed` and application startup never create or restore image associations.
After the customer baseline exists (for a new database: `db:seed`, then
`bootstrap:myomaton`; see [bootstrap boundaries](bootstrap.md)), explicitly invoke:

```powershell
npm.cmd run db:bootstrap-photo -- --file "C:\Photos\robot.jpg" --asset-id "<chosen-stable-uuid>" --name "Myomaton robot" --alt "<approved description of this photograph>"
```

Choose and retain the Asset UUID for this photograph; do not derive it from its
path or bytes. The command loads `.env.local` using the same workflow as `db:seed`.
A configured `MYOMATON_ASSET_ROOT` is optional. The command requires exactly one
active Myomaton Web Presence (`myomaton.com`), Myomaton Managed Site, Home page (`/`),
and Introduction (`intro`) Section. Missing/ambiguous targets are errors.

Each invocation evaluates current canonical usages: exact association means no-op;
a different/ambiguous association means refusal; an empty role permits creation.
If a usage is deliberately removed, reads and normal seed do not restore it. Only
another explicit operator invocation may attempt initialization against current
state. The supplied supported image must remain readable even on a no-op invocation because
input validation precedes the database transaction. No real photograph is included
or bootstrapped by installing this code.

## Public presentation and delivery

### Usage-specific image accessibility

Asset defaults describe the reusable thing. `AssetUsage.configuration.image`
describes this particular presentation, with optional `altText` and `decorative`
fields. For example: `{ "image": { "altText": "Detail relevant here" } }` or
`{ "image": { "decorative": true } }`. Usage `metadata` remains unrelated
descriptive metadata; it is not a second source of accessibility overrides.

- With no image configuration, retain the Asset's existing alt behavior.
- For an informative use, a valid usage `altText` wins; otherwise, when the field
  is absent, fall back to Asset `altText`. Overrides must be nonblank plain strings,
  at most 2000 characters, without control characters; outer whitespace is trimmed.
- `decorative: true` always resolves to empty alt, even if an alt override is also
  present or malformed. It never falls back to the Asset description. The existing
  noninteractive image renderer emits `alt=""`, the semantic decorative treatment.
- Malformed configuration/image objects, nonboolean decorative flags and invalid
  informative overrides omit the image while keeping the Section text. An explicit
  `decorative: false` also rejects an empty default. Legacy empty Asset defaults
  remain supported when informative intent is not explicitly asserted.
- Unknown fields are ignored. All resolved alt text is escaped by React.

Presentation queries carry usage configuration alongside the canonical Asset;
normalization resolves it into `SectionImage.alt` before the renderer receives it.
One Asset can therefore supply default, contextual and decorative presentations
without changing its record or bytes. Invalid presentation metadata does not change
reverse-reference inventory or the existing media-delivery eligibility rules.

The initial accessibility contract satisfies the intentional-reuse metadata gate.
This adds no metadata editing API, caption, crop/focal-point editor, filters,
rendition management or per-usage CSS. Existing writers retain their behavior;
future usage writers must preserve this contract and A1/A2 attachment integrity.

### Eligibility and bytes

The [site-global foundation](site-globals.md#asset-backed-primary-logo) also reads
the singular Web Presence `logo` AssetUsage role and permits its eligible image
through the same media route. It adds no logo writer, storage copy or customer
association. Other Section media eligibility below is unchanged.

Canonical Asset reads still include all statuses. Separate presentation reads batch
resolve images and require active Assets and active Section/Page/Managed Site/Web
Presence ancestors, matching ownership, `intro` section type and the applicable `image` or `attachment` role.
Ambiguous image roles raise an error; unavailable/unsupported Assets are omitted.
The existing intro text always renders when no image resolves.

The read-only Node Route Handler independently applies those eligibility checks in
the explicit `myomaton.com` context, matching the current homepage. It does not trust
request Host for tenant selection. UUID knowledge alone does not expose inactive,
unreferenced or foreign-presence files. Valid responses use the validated stored MIME, `nosniff`, `Cache-Control: no-store`,
and `Content-Security-Policy: default-src 'none'; sandbox`. PDFs use an attachment
disposition with a fixed filename; images use inline disposition. Errors never return source paths. The renderer uses
`next/image` with explicit dimensions, responsive CSS and `unoptimized` to avoid a
second delivery/cache pipeline. Active content is public in the existing managed site
model; this does not invent a draft/published workflow.

## Verification and remaining scope

```powershell
npm.cmd test
# Explicit connection to a development/test DB whose role can CREATE SCHEMA:
$env:ASSET_TEST_DATABASE_URL = "<development-or-test-connection>"
npm.cmd run test:postgres
npm.cmd run lint
npm.cmd run build
# After a production build, also exercise the actual built Route Handler:
$env:ASSET_TEST_PRODUCTION = "1"
npm.cmd run test:postgres
```

The PostgreSQL suite never silently skips. First it compares every installed Drizzle
migration hash/timestamp with the checked-in chain using Drizzle's own migration
reader. It replays those SQL files in a disposable schema (only public schema
qualification is replaced), then compares PostgreSQL catalog columns/defaults,
constraints and indexes for all fixture tables against the installed public schema.
This uses checked-in migrations as the expected specification instead of maintaining
a second schema. An exact installed prefix through 0005 is also accepted while
0006 awaits deployment: pending SQL runs only in the disposable reference schema.
It then clones the fully replayed reference table
structures (including checks, indexes and separately recreated foreign keys) into
a random `myomaton_asset_test_<uuid>` schema. Every fixture query uses that schema;
catalog definitions are compared again and FK target namespaces must all stay inside it. Both schemas are dropped after the suite, including on failure.
No migrations or real Myomaton content records are changed. A crashed test process
can leave a clearly named fixture schema for operator cleanup.

The [Managed Site rename rehearsal](managed-site-rename.md) additionally copies
the current customer graph into isolated schemas, verifies upgrade/fresh fidelity,
and exercises the production routing/media handlers with read-only connections.

Coverage includes ownership, FK/uniqueness/delete rejection, forced transactional
rollback, concurrent singular-role attachment, canonical no-op/conflict behavior,
public eligibility and delivery of all five supported formats. Unit tests cover key/filesystem safety,
DTOs, raster orientation/alpha/animation, SVG sanitization, PDF validation, rendering
and absent-image behavior. A negative fixture-schema test proves drift is detected.

Still deferred: other target writers; replacement/removal/deletion workflows;
customer-facing authentication/authorization and private assets; object-store/CDN
integration; lifecycle timestamps, retention/purge/archival; customer editing and
revision history; export. An empty usage inventory alone never authorizes deletion.
See [the active architecture register](deferred-architecture.md) for triggers.
