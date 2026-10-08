# Managed Site global foundation

Phase 1 adds [canonical knowledge evidence](canonical-foundation.md#knowledge-and-identity)
without duplicating `configuration.business` as another identity authority. Explicit
UUID deployment selection now scopes shared consumers; public production gates remain open.

This is a bounded read/presentation capability, not a Header/Footer builder or
customer editing surface. Existing JSON configuration and AssetUsage fields are
sufficient; no migration or customer-state update is required.

## Ownership and canonical identity

Organization remains the owning customer entity. The Web Presence owns the public
brand/business identity shared by its Managed Sites, through a validated
`configuration.business` contract:

```json
{
  "business": {
    "displayName": "Example business",
    "phone": "+1 (212) 555-0100",
    "email": "hello@example.com",
    "socials": { "youtube": "https://www.youtube.com/@example" }
  }
}
```

These are examples, not Myomaton data. Name resolves from `business.displayName`,
then Web Presence name, then Managed Site name; a malformed empty chain uses
“Site”. Phone/email/socials have no presentation-level or Organization fallback.
They are canonical facts, not independent Header/Footer values. Metadata JSON
is not an alternate source. No addresses or Locations are modeled here.

Phone is a bounded display string of digits, an optional leading plus and ordinary
separators; `tel:` strips separators and requires 7–15 digits. Email accepts a
bounded plain mailbox and emits an encoded `mailto:` without header/query input.
These are syntax guards, not verification of reachability or business truth.
Missing/invalid facts render nothing. Future Contact Page/Section/overlay and
forms must consume this same identity, not introduce copies.

## Asset-backed primary logo

The only logo Asset reference is an AssetUsage with `entity_type = web_presence`,
`entity_id = <Web Presence UUID>`, `role = logo`. There is no duplicate logo UUID
in JSON. It refers to an existing reusable managed image owned by that presence.
The read query requires one unambiguous association, active presence, at least
one active Managed Site, valid image/usage metadata and dimensions, and matching
Asset/usage ownership. Missing, invalid, inactive or foreign associations fall
back to the name; multiple candidates also fail closed.

The shared media route recognizes eligible logos as well as existing Section
images/attachments. Storage, Asset UUIDs and URL shape are unchanged. The Header
logo links Home and names that destination; the unlinked Footer logo uses the
resolved business name as its accessible name. Logo placement never depends on
an arbitrary photograph description to name the brand. No logo is decorative as
the sole visible brand identifier. All other image usages retain their existing
alt/decorative contract.

No logo attachment writer is implemented. A future writer must lock/validate the
Web Presence target, enforce singular logo-role occupancy and same-presence Asset
ownership transactionally, preserve other usages, and pass A1/A2/A6 before use.
Do not provision a logo by copying files or hiding a source URL in configuration.

## Controlled Header and Footer

Managed Site `configuration.globals` contains presentation choices only:

```json
{
  "globals": {
    "header": { "showPhone": true, "contactActionId": "<Action UUID>" },
    "footer": {
      "showPhone": true,
      "showEmail": true,
      "showSocials": true,
      "showUtilityNavigation": true
    }
  }
}
```

Absent flags default false. Unknown fields, layout instructions, HTML/CSS and
copied business facts are ignored. There is one platform-owned responsive layout,
using Design System colors, typography, spacing and shape. Header and Footer are
semantic landmarks; Navigation is a `nav`, not a nested Header. Below the
platform-owned 64rem breakpoint, Primary Navigation collapses behind a closed-by-
default Menu button with a hamburger icon, expanded state and a controlled panel.
A narrow Client Component owns disclosure state; the Header and single navigation
tree remain server-rendered. Enter/Space activate the button, Escape closes and
returns focus, and selecting a link closes the menu. Child links remain nested
lists. At desktop widths the links are visible and the control is hidden.
Utility Navigation remains an ordinary list. No breakpoint setting is exposed.

Header shows the logo/name Home link, existing Primary Navigation, an optional
canonical phone and optional first-class Action. The Action is resolved in the
current Web Presence/Managed Site context and omitted if unavailable. Page-target
Actions are preferred for a Contact Page. Existing `contact` Actions still resolve
an internal Page/path or anchor; they are not phone/email storage or a form system.
Direct phone/email links are projections of business facts, not copied Action
destinations. Existing Section/Action/Navigation behavior is otherwise unchanged.

Footer shows logo/name, selected available contact facts/socials, optionally the
separate Web Presence-owned Navigation named `Utility Navigation`, and current UTC
year plus resolved business name. It does not copy Primary Navigation or invent
legal/contact Pages. Utility uses the same active, tenant-scoped destination
resolution as Primary. No copyright text override or layout variants are added.

Social profiles are accessible text links, no icons/dependencies or vendor widgets.
Initial vocabulary: YouTube, LinkedIn, Facebook, Instagram, X and GitHub. HTTPS,
exact known service host, non-root profile path, no credentials/nonstandard port,
and the existing safe URL checks are required. Unknown platforms and unsafe or
malformed destinations disappear. This validates a destination, not account ownership.

## Bounded Platform Policy

The initial representative capability flag is `socialLinksEnabled`, default true.
It permits social presentation; the site must still opt into Footer socials and
canonical destinations must exist. It is not consent, authorization or CSS.

Trusted operator/service configuration is the server-only deployment environment
variable `WEB_PRESENCE_SERVICE_POLICY`, a JSON object such as:

```json
{
  "socialLinksEnabled": {
    "value": false,
    "allowPresenceOverride": true,
    "allowSiteOverride": false
  }
}
```

Resolution is platform default → valid service value → permitted Web Presence
`configuration.policy.socialLinksEnabled` → permitted Managed Site field of the
same name. Both override permissions default false and can be granted only by
trusted service configuration, never customer JSON. Site overrides have final
precedence only when explicitly allowed. Invalid values retain the previous valid
level. Invalid service JSON behaves as absent policy (platform defaults, no customer
override permissions). Unknown fields are ignored. No UI or policy writer exists.

This proves a narrow typed contract and precedence, not a giant settings registry.
Gallery recommendations/soft maxima, upload limits, Navigation depth, video,
retention, Search, Flex access and automation policy are not implemented here.
Their later contracts must distinguish recommendations from enforced constraints;
this non-security boolean must not be reused as a security/approval policy default.

## Myomaton and remaining gates

Myomaton's existing empty configurations render the name, current Primary
Navigation and generated copyright on all four Pages. There is no stored formal
logo, phone, email, social profile or Utility Navigation, so none is invented.
No customer-state writer or configuration update is needed for this initial proof.

The [Contact foundation](contact-forms.md) reuses this identity in Contact Sections
and adds one bounded `contactRetentionDays` policy resolver with the same trusted
scope permissions. It does not duplicate contact facts, configure Myomaton, add
an overlay or complete production Contact activation.

P15's initial typed precedence is covered; generalized policy UI/authorization and
additional settings remain gated. P14 now includes the bounded Contact foundation;
public-production activation, delivery/SMTP, distributed spam/rate limiting,
privacy and retention operations remain deferred. P11 onboarding, P12 first-party analytics, P13 intelligence,
Search, native publishing, and P9/P10 remain deferred. Utility rendering does not
complete legal content, authoring or publishing workflows.

Unit tests cover facts, omission, safe links, semantics, policy and service context.
Disposable PostgreSQL tests cover logo ownership/eligibility and actual production
rendering/media bytes. The real database is inspected read-only before/after;
automated mutation fixtures never target real customer tables.


### Mobile Primary Navigation refinement

Below the platform-owned 64rem breakpoint, the disclosure uses a padded, elevated
panel with 48px link targets, stronger top-level type, nested child grouping and
current-Page treatment. Menu changes to Close with safe local SVG paths. Escape
returns focus to the button; Arrow Down opens and focuses the first link; selection
or outside pointer interaction closes it. This is a non-modal disclosure with
ordinary Tab order, not a focus-trapping drawer. Desktop Navigation and the
server-rendered hierarchy remain unchanged. No new configurable variant is exposed.


## Contract-v2 global presentation

The [service-led grammar](visual-direction.md#commercial-presentation-contract-version-2)
selects compact-inline or brand-prominent headers, quiet or commercial Navigation
and compact-utility or service-led footers. These are resolved treatments, not a
Header builder. Commercial emphasis follows the primary Action destination, not
link position. Assessment uses the compact ending; arrival uses prominent branding.

The new renderer has its own scoped styles and preserves shared functional
keyboard disclosure behavior. Wordmark aspect ratio, intrinsic fitting, media
eligibility, safe links, shallow hierarchy and Home identity remain invariant.
Legacy reference-v2 and restrained-editorial global rendering remain pinned.

## Acquisition presentation and contextual branding

Service-led v2 uses the existing owned Header `contactActionId` as its acquisition
navigation destination. It emphasizes the matching existing Navigation item, rather
than duplicating a button or confusing current-page state with acquisition emphasis.
`aria-current` continues to report location independently. No Header builder exists.

An optional `logo-light` Web Presence AssetUsage provides an approved light lockup
for contrast surfaces. It uses the same managed media, singular association, active
presence/site and ownership eligibility as `logo`. The legacy Header/logo path is
unchanged; new grammar opts into the contextual variant. Source files are unchanged,
and preview copies are ingested solely in disposable state.
