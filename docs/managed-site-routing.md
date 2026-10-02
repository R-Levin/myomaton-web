# Managed Site Page routing

The public application serves active Pages through `app/[[...path]]/page.tsx`.
Root and secondary Pages use the same lookup, metadata and structured
Managed Site/Page/Section rendering. This adds no customer Pages or Navigation items.

The terminology/schema transition is documented in the
[Managed Site rename deployment note](managed-site-rename.md).

## Explicit deployment selection

`lib/platform/managed-sites/deployment.ts` selects the current deployment by exact
Web Presence primary domain and Managed Site name. It currently selects Customer #1:
`myomaton.com` / `Myomaton`. The domain is configuration, never the request Host.
Exactly one active pair must match before any Page is loaded; missing or duplicate
matches fail closed. Renaming that Managed Site requires updating the explicit
deployment selection. Managed media uses the same configured Web Presence domain.

Page queries then use the resolved Managed Site UUID, exact slug and `active` status.
The existing model has no separate published state; this does not implement a
draft/publishing workflow. Production host/domain selection remains deferred at
P9 in [the architecture register](deferred-architecture.md). Replace the selection
boundary when that trigger is reached, retaining shared Page rendering.

## Paths and destinations

The existing `pages.slug` field stores a root-relative path:

- `/` selects the root Page, regardless of its display name.
- `/about` selects that exact secondary Page.
- `/teams/northeast` is a supported nested path in the same field; no parent Page
  or new storage hierarchy is required.

Canonical stored paths start with one `/`, are case-sensitive, and have no trailing
slash except at root. Segments use URL-unreserved ASCII letters, digits, `-`, `.`,
`_` and `~`, excluding the complete segments `.` and `..`. Paths are bounded to
2048 characters. Empty segments, encoded values, whitespace, controls, backslashes,
query/fragment syntax and absolute URLs are rejected. No case folding, fuzzy lookup,
heading inference or URL-parser dot-segment rewriting occurs.

Lookup accepts a single trailing slash and normalizes it; Next.js also performs
its normal trailing-slash redirect. Catch-all params are already decoded by Next
and are validated without another decoding pass. A decoded slash within a single
param is rejected. Noncanonical stored slugs are not aliases and are not served.
Canonical path equality retains the database's `(managed_site_id, slug)` uniqueness
guarantee; an unexpected multiple-result lookup returns not-found.

Navigation Page and Section targets use this same canonical path contract. URLs
remain root-relative. Section targets on the current Page remain `#anchor`; targets
on another Page use `/path#anchor` (or `/#anchor`). Bare Action/link anchors retain
their existing document-local meaning; routing does not retarget Actions.

`/media` and its descendants are reserved for managed media; `/_next`, `/_not-found`
and `/_global-error` and their descendants are reserved for framework infrastructure
and the generated error entries found in the production route manifest. Content lookup and
entity-backed Navigation reject these paths. The existing static media route
continues to take precedence over the catch-all. Add real application namespaces
to this small shared policy when introducing routes that need them; there is no
speculative reserved-word catalog.

## Metadata and not-found behavior

Document title comes from canonical `Page.title`, falling back to `Page.name`, then
the selected Managed Site's name if the preceding fields are blank. Home retains its
current title. The untyped metadata JSON does not currently define a validated SEO
description contract, so this slice does not infer descriptions from Section copy
or blindly spread that JSON into Next metadata. The metadata contract and public
canonical-URL rules are deferred under P10, before SEO authoring or production
indexing/launch. Sitemap and related production work remain on the capability
catalog's production-readiness track.

Unknown, inactive, malformed, reserved, ambiguous and foreign-Managed Site paths
invoke Next.js `notFound()`; they never fall back or redirect to Home. Database
availability errors remain errors rather than being disguised as missing Pages.

## Verification

`tests/managed-site-routing.test.tsx` exercises real service query generation with
an isolated in-memory driver, the catch-all component, metadata, shared rendering
and Next's not-found exception. Existing Navigation, collection, image and Home v1
tests cover their preserved behavior. No fixture mutates customer PostgreSQL state.
