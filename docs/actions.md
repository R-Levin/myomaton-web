# First-class Actions

Sections store only `actionId`; collection items and Navigation can also reference
the same canonical Action. Labels and target identity belong to the Action.

## Page targets

A canonical Action with `type: "page"` stores the stable Page UUID in the existing
`destination` text field. It does not store a slug, URL or duplicate target in
configuration. This uses the existing schema without a migration.

At presentation time, `getActionsByIds` requires an explicit `managedSiteId`
context for these Actions. Actions remain Web Presence-owned. The target must
belong to that presence and the selected active Managed Site, and both the Page
and Web Presence must be active. The shared Page-destination query serves both
Actions and Navigation; it uses routing's canonical, root-relative path contract,
including nested paths and reserved application namespaces.

The returned Action DTO contains the resolved URL in `destination`. A canonical
Page UUID is never passed to an anchor as a URL. Missing, inactive, foreign,
malformed, noncanonical or ambiguous targets omit the Action. Missing context
also omits Page Actions. Section text and collection items remain visible.
Database failures remain errors, rather than being disguised as missing targets.

Hero, Intro, CTA, collection-item and Navigation Action references use this same
resolution. Ordinary `link`, `section` and `contact` semantics are unchanged;
bare Section anchors remain document-local. No Page is inferred from its name,
heading, or Navigation label. Changing a Page's canonical slug changes the next
resolved destination without changing its Action's stored UUID.

This is a read/presentation capability, not an Action editor or target-management
API. Future writers must validate stable target identity and ownership. No
Myomaton Page, Action or Navigation record is created by installing this code.
