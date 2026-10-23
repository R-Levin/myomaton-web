# Shared hostname routing

## Launch boundary

A shared runtime for 100+ customers is P0 launch architecture. The initial proof
requires C0 (synthetic MioPages) and C1 (a different synthetic customer) served by
the same Node process. Adding another tenant is registry/content data work, not
another Node deployment. This slice supplies routing and isolation, not production
operator authentication, intake activation, publishing authority or capacity proof.

The current hosting direction is 20i Managed Cloud with Supabase being evaluated
for managed PostgreSQL. Neither provider is permanently selected. Routing uses
standard request headers and PostgreSQL; it calls no hosting, DNS or Supabase API.

## Registry and normalization

[Migration 0015](../lib/platform/db/migrations/0015_managed_site_hostnames.sql)
adds `managed_site_hostnames`: UUID identity, globally unique normalized hostname,
Web Presence, Managed Site, active/inactive status and creation time. A composite
foreign key binds the exact site to its owner, supported by the new site owner/ID
unique constraint. No existing hostname or customer is automatically backfilled.
Inactive names remain reserved; reassignment requires a separately authorized
operator data operation. There is no public registry editor or ownership claim API.

The [resolver](../lib/platform/managed-sites/hostname.ts) accepts ASCII DNS names,
lowercases them and removes one final dot and an optional valid port (1–65535).
It rejects missing/multiple/malformed authorities, whitespace, IP literals, bare
names, invalid labels and IDNs including punycode. IDN support is deferred rather
than silently converted. Registry storage accepts only the normalized form.

An active binding must join an active Organization, Web Presence and exact Managed
Site. Missing, duplicate, inactive or mismatched results refuse without fallback.
The unique hostname index gives an indexed exact lookup; the owner/site index
supports scoped administration. `primary_domain` remains customer information and
is not the routing authority. Multiple explicitly registered aliases can select
the same site; canonical URLs use the normalized requested binding in this slice.

## Host and proxy contract

The authoritative input is `Host` as delivered to Next.js. `Forwarded`,
`X-Forwarded-Host` and browser-supplied tenant IDs grant no tenant selection.
The eventual proxy must preserve the original validated Host, reject unintended
domains, restrict direct backend access, terminate HTTPS and strip untrusted
forwarding headers. A provider that replaces Host must establish a separately
reviewed adapter; simply trusting X-Forwarded-Host is unsupported.

Shared output uses HTTPS canonical/Open Graph URLs from the resolved hostname,
never a forwarding header or `primary_domain`. No sitemap/robots subsystem is
introduced. Unknown hosts return bounded not-found responses. Invalid runtime
configuration fails startup through [instrumentation](../instrumentation.ts).

## Immutable request context and surfaces

[Request context](../lib/platform/managed-sites/context.ts) resolves a frozen value
containing Organization, binding UUID, hostname, Web Presence and Managed Site.
React request-local memoization shares that resolution between metadata and body.
There is no mutable global current tenant or per-request environment switching.
The database pool belongs to the runtime, not a customer; queries receive explicit
UUID scope and do not SET session tenant state.

Pages, metadata, Navigation, Actions, media and shared-mode APIs use that scope.
Contact section/definition ownership is checked against the resolved exact site;
posted tenant IDs are not accepted. Production Contact remains disabled. Existing
intake activation is still the exact development-only MioPages pilot, not an intake
feature available on every customer host. Unavailable intake Pages return not-found;
API requests refuse. Review records and local operator viewers are unchanged.

Public host selection grants no operator capability. Activation, canonical writes,
proposal preview/approval and release/rollback retain their explicit authority and
scope. Their local standalone viewers are not new public Next routes.

## Cache and media isolation

The public Page remains dynamically rendered. React cache identity explicitly
includes Web Presence, Managed Site, hostname and Page path and is request-local;
there is no persistent tenant-resolution/output cache. Binding deactivation is
visible on the next request. Media delivery retains `Cache-Control: no-store` and
checks asset ownership and eligible usage for the resolved site. Storage paths and
content-addressed keys are unchanged. No new global/public shared-asset category
is introduced; existing intentionally reusable same-owner logo rules remain.

Any future CDN must include the validated hostname in its cache identity, preserve
Next's Vary behavior and avoid caching private/API/refusal responses. The local
proof tests application/Next behavior, not an unconfigured provider CDN.

## Operating modes

- `MIOPAGES_ROUTING_MODE=shared-hostnames`: required production mode. Environment
  `WEB_PRESENCE_ID` or `MANAGED_SITE_ID` values are rejected, even on an unknown host.
- `local-single-site`: nonproduction compatibility using both explicit UUIDs;
  also the legacy default outside production. It never supplies a shared fallback.
- `disposable-single-site`: production-build test compatibility only, restricted
  to loopback/private-port PostgreSQL and a recognized random fixture search path.
  It is not valid against shared development or hosted production databases.

Old environment-bound `next start` preview launchers are not production deployment
configurations. Use a nonproduction local preview, the guarded disposable fixture,
or the shared-mode proof. Existing running local servers need not be restarted by
this feature. Build with shared-hostnames mode and the two UUID variables empty;
build-time selection does not create bindings or connect to a tenant.

## Disposable proof and inspection

[Focused tests](../tests/hostname-routing.test.tsx) cover normalization and refusal.
The [HTTP/SQL proof](../tests/integration/hostname-routing.test.ts) uses an owned
private PostgreSQL cluster and synthetic C0/C1 rows. It exercises metadata/body,
Navigation/Actions, owned and foreign media, Contact acceptance/tampering, cache
alternation, concurrent requests, inactive owners and forwarding attacks.
The [migration proof](../tests/integration/hostname-migration.test.ts) checks ordered
15→16 upgrade, unchanged prior rows, fresh replay and a no-op rerun.

With a separately prepared private `ASSET_TEST_DATABASE_URL`, run
`npx tsx scripts/preview-hostname-routing.ts`. The
[fixture](../scripts/hostname-routing/fixture.ts) refuses shared port 5432 and creates
only a random disposable schema. `runtime-content/hostname-routing/viewer.json`
records local links, normalized binding/owner/site diagnostics and the Node PID.
It contains no database credential. Open the `c0.localhost` and `c1.localhost` links
on the same port, then `unknown.localhost` for refusal. Browsers normally resolve
`.localhost` to loopback; no hosts-file edit is required. If unavailable, use
`curl.exe -H "Host: c0.localhost" http://127.0.0.1:PORT/` and its C1/unknown variants.
Node fetch rewrites Host; the test's [HTTP client](../tests/helpers/host-request.ts)
sets the actual wire header. Stop the viewer with Ctrl+C to remove its schema/media.

Runtime output is ignored evidence, never source. **Historical implementation
boundary:** that slice tested 0015 only in disposable PostgreSQL and did not apply
it to shared development. A subsequent authorized checkpoint applied 0015; shared
development now has 16 migrations, zero pending and an empty hostname registry.
No real hostname/DNS binding or provider resource has been created for hosted proof.
See the [current architecture boundary](platform-service-architecture.md#current-implementation-and-next-boundary).

## Capacity limits

No 100-fixture demonstration is claimed. A shared pool scales per process; adding
processes multiplies pool capacity requirements. Registry reads add an indexed
lookup; a future cache requires explicit invalidation/security review. The current
content-release table locks can serialize changes across tenants. Measure realistic
traffic, query latency, connection pressure and provider cache behavior before
claiming capacity or enabling production workflows.
