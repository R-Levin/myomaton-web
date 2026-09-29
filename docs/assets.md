# Asset foundation

Assets are customer-owned canonical Web Presence state. Each has a stable UUID,
an owning Web Presence, name, open-ended type (default `image`), MIME type,
nullable positive pixel width/height, nullable alt text, status (default `active`),
configuration, metadata, version and timestamps. Names and source references
are not unique: neither is identity. Null alt text means unspecified; an empty
string can intentionally describe a decorative image. Dimensions may be unknown
or inapplicable. Version is a current-record revision, not a history table;
future writers must increment it and update `updatedAt` as existing seeds do.

`sourceType` identifies a resolver kind and `sourceReference` holds its opaque
locator. For example, `url` with an externally hosted HTTPS URL can represent
an existing photograph. These fields can change without changing the Asset ID.
No provider enum, credentials, binary payload, data URL, signed URL generation,
or resolver is introduced. Do not place bytes or credentials in either field or
JSON metadata. Future source writers/resolvers must validate each supported
kind and enforce safe delivery; a stored locator is not a renderable URL.

AssetUsage records a current association `(Web Presence, entity type, entity
UUID, role, Asset UUID)`. Exact duplicates are prohibited; multiple assets can
share a role, and one asset can serve multiple entities/roles. Types such as
`page`, `section`, `subject`, or `web_presence` identify owners; `hero`, `gallery`,
or `social` describe semantic roles rather than separate target types.
No ordering or singular-role policy is imposed yet.

The composite foreign key enforces that usage and asset belong to the same Web
Presence. Its default NO ACTION deletion behavior prevents deleting a referenced
asset. Ownership of the usage's Web Presence is inherited through this key.
Polymorphic entity IDs cannot have a conventional foreign key: future write
services must validate target existence and derive/check its Web Presence
(Pages through Microsites, Sections through Pages). They must remove usages
transactionally when a reference is replaced or a target deleted. Direct SQL
can currently create dangling or incorrectly scoped target references; no write
API is exposed in this slice. This follows the existing polymorphic Navigation
target approach without adding an entity registry or speculative triggers.

Every usage row counts as a reference, including references from inactive
entities. There is deliberately no usage status or soft-delete/history state.
Removing an association removes its row. Once references are removed, no schema
rule requires retaining the asset forever. Later bounded retention/purge must
coordinate concurrent reference writes; reading an empty inventory alone is
not a safe deletion workflow.

The server-only service supplies tenant-scoped canonical reads by Asset IDs,
entity, and reverse usage inventory. It includes inactive Assets and does not
perform caller authorization, target resolution, availability filtering, or
URL delivery. Callers must supply an authorized Web Presence. Invalid query
identifiers throw rather than reporting a misleading empty reference inventory.

Deferred: writes/editor endpoints, uploads, storage adapters, source validation
and rendering, microsite/seed integration, target lifecycle integration,
retirement, garbage collection, retention scheduling, archival and export.
The stable IDs, source separation and explicit usages allow a future export to
carry canonical records and remap physical asset locations independently.
