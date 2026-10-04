# Reusable Contact Definitions and submissions

Implemented foundation, **not public-production activation**. Migration
`0007_contact-foundation.sql` is additive and must be applied only through a
separately approved deployment. This slice does not configure Myomaton forms,
recipients or business facts. The live development database may remain on seven
migrations until that approval.

## Ownership and reuse

Each `contact_definitions` record belongs to a Web Presence. Multiple definitions
(General Contact, Quote, Campaign Inquiry) can coexist and be reused across
presentations. Each Contact Section has `type = contact`, `variant = default`,
and `content.contact_definition_id` holding the stable definition UUID, alongside
optional plain `heading`/`text`. A Contact Page is an ordinary Page containing
that Section. No overlay/drawer or separate Page form engine is implemented.

The Contact presentation consumes canonical Web Presence business phone/email
through the [same identity resolver](site-globals.md). Missing facts render
nothing. Definitions cannot contain copied business phone/email or arbitrary
recipient destinations. The public DTO omits delivery routing entirely.

## Finite form contract

`configuration` is a validated object, for example:

```json
{
  "fields": [
    { "key": "name", "label": "Name", "required": false },
    { "key": "email", "label": "Email", "required": true },
    { "key": "message", "label": "Message", "required": true }
  ],
  "text": "Tell us how we can help.",
  "privacyText": "Use this field only for your inquiry.",
  "successText": "Your message has been received."
}
```

This is illustrative copy, not customer configuration or a complete privacy notice.
Supported keys are only `name`, `email`, `phone`, `organization`, `message`.
Definitions contain one to five distinct fields, in rendering order, with explicit
boolean required state. Labels are nonblank and at most 100 characters. Optional
explanatory/privacy text is at most 2000 characters each; success text is at most
500. All are escaped plain text, not HTML, executable validation or styling.
Unknown configuration keys invalidate the definition; there is no arbitrary
field builder, file upload, payments, repeaters or conditional logic.

Limits on accepted field values are name 200, email 254, phone 40, organization
200 and message 5000 characters, within a 16 KiB total request limit. Single-line
fields reject control characters, including CR/LF header injection. Message
permits normalized line breaks and tabs. Email/phone share the existing bounded
contact syntax validation. Missing optional values normalize away; an entirely
empty submission is rejected. Unknown/unconfigured fields are rejected.

Definitions have positive `version`, active/inactive status, timestamps, bounded
name, owner FK and an optional delivery route key. Null explicitly disables
delivery. No definition editor/writer is added: a future authorized writer must
increment version and updated timestamp for material accepted-contract changes,
validate configuration and preserve existing submission versions. This is not
revision history. Every request must match the current active definition version;
stale requests fail instead of being silently interpreted under a new contract.

## Submission and ownership validation

`POST /api/contact` uses one processing path. `/api` is reserved from Page routing.
The endpoint currently responds unavailable outside Next development mode; there
is no environment toggle that enables public production using development guards.
Production composition must be reviewed before removing that gate.

Requests contain only Section/definition UUIDs, definition version, supported
fields, an idempotency key and optional empty `website` honeypot. The browser
does not select a tenant, recipient or route key. Exact same-origin JSON is
required; payloads are streamed with a byte cap, not trusted Content-Length alone.

The server resolves the explicitly selected active Web Presence/Managed Site,
requires an unambiguous match, then verifies active Page, Contact Section and
same-presence definition with matching Section reference. Shared row locks protect
that chain through insertion. Unknown/inactive/foreign context fails closed.
This does not implement P9 host routing or P7 management authorization.

`contact_submissions` stores:

- UUID; required Web Presence, Managed Site and Contact Definition identities;
  nullable source Page/Section; positive definition version.
- The normalized accepted fields, independently of later definition changes.
- Server-selected route key; delivery status, nonnegative attempt count,
  attempt/delivery timestamps and bounded sanitized error code.
- Required idempotency key, creation/update timestamps and concrete expiration.

Definition ownership is enforced by a composite FK. Web Presence, Managed Site
and definition deletion is restricted while submissions remain. Page/Section
deletion sets their source reference to null; it never deletes retained messages.
Existing Page-to-Section delete rules still apply. Writer checks supplement FKs
for the complete tenant chain; direct administrative SQL is not a management API.
Indexes cover tenant/date, expiration, pending delivery and unique
`(web_presence_id, contact_definition_id, idempotency_key)`.

Concurrent normalized exact retries create one record. A different field payload,
definition version or source context with the same key fails with conflict.
No request fingerprint is stored. Retrying an accepted request does not update
timestamps/expiration, emit another accepted event or automatically redeliver.
Current active-context/version checks still apply to retries. After an uncertain
network response, retry unchanged; a conflicting replay requires review rather
than silently creating another lead.

## Delivery and measurement boundaries

`ContactDeliveryProvider.deliverSubmission()` receives stable submission identity,
trusted route key and normalized plain fields. Provider routing maps keys such as
`general` or `sales` to trusted destinations; browser data never supplies headers
or recipients. A future SMTP/API adapter must use safe header construction,
timeouts and provider idempotency where available. No production adapter or
recipient map is installed. Tests use fixture providers only.

Persist acceptance before attempting delivery. Null route means `disabled` with
zero attempts. An enabled route with no provider records `failed` /
`provider_unavailable`; a provider error records `delivery_failed`, never the raw
exception/response. Successful delivery records `delivered`. The accepted data
survives either outcome. Provider calls and database updates are not atomic: a
crash or delivery-state write failure can leave `pending`/uncertain delivery and
needs explicit reconciliation. This slice adds no retry worker, delivery history,
exactly-once email guarantee or promise that an accepted message was emailed.

An optional provider-neutral `ContactEvents.accepted` hook emits `form_submit`
only after durable new acceptance, with IDs and no visitor field values. It is
best-effort, not durable analytics; callback failure cannot invalidate a lead.
`contact_open`, `form_start`, `phone_click` and `email_click` remain future event
semantics. No analytics tables, GA4 dependency or CRM functionality are added.

## Abuse, retention and privacy

The injected `ContactAbuseGuard` is mandatory in the writer. The supplied
development guard is a bounded-memory fixed-window per-deployment limit (10/minute),
with no IP/fingerprint storage. Empty honeypot and input/byte limits complement
it; none is a claim of production spam protection. Before public activation,
select/test distributed rate limiting, trusted client-address handling if used,
spam/bot controls, time/resource bounds and operational alerts under P14/P18.

`contactRetentionDays` extends the existing [Platform Policy foundation](site-globals.md#bounded-platform-policy):
platform default **30 days** → valid service value → explicitly permitted presence
override → explicitly permitted site override. Valid values are integer 1–365;
these are initial operational bounds, not database semantics or a final retention
promise. Invalid values retain the previous valid level. Override permissions
come only from trusted service policy. Before real collection, confirm an
appropriate customer/service privacy and retention policy.

Acceptance persists `expires_at`; later policy changes never rewrite old expiry.
Expiration is not automatic deletion: a reviewed tenant-safe purge/export workflow
and backup-retention handling are still required before production collection.
Delivered email copies have their own recipient/provider retention and deletion
considerations. Submissions are customer-owned visitor data; collect only fields
needed for the inquiry. No raw IP, unrestricted fingerprint, arbitrary attribution,
provider response or message-content logging is added. No hidden training use.
Exportability and authorized deletion remain P4/P5/P7 obligations.

## Presentation, accessibility and deployment

One small Client Component submits the shared server-rendered definition. Labels
associate with controls; required fields have explicit semantics; server errors
attach through `aria-invalid`/`aria-describedby`; visible textual errors do not
depend on color. Status feedback is live-announced and receives focus after a
response. Keyboard operation, visible focus and bounded controls use existing
Design System tokens. JavaScript is required for submission; a noscript message
points to available canonical contact methods without inventing any.

The [Visual Direction contract](visual-direction.md#links-and-text-decoration)
defines shared link/decoration and form-state semantics. Opt-in profiles now derive
shared label/help/error, readable surface/focus and non-color error/success roles
from Design System primitives. Sites without a direction retain existing styling.
No arbitrary styling or special link colors are accepted. Privacy text remains plain text,
not a new link/rich-text contract.

The additive migration creates only the two Contact tables, constraints and
indexes; no customer definitions, Sections, Actions or facts are inserted. Existing
sites without Contact Sections do not query these tables, so the existing four
Myomaton Pages can render while migration application awaits approval. Rehearsals
copy existing customer data into disposable schemas, verify unchanged values and
timestamps on upgrade, compare full fresh replay, and exercise writer/delete/
retention behavior. Historical migration SQL/snapshots remain immutable.

Remaining gates: production abuse/delivery routing, privacy/export/purge and
delivery reconciliation, management authorization, production operations and
recovery. Overlay, full analytics and general editing/publishing remain deferred.
