# MioPages development control and continuity

Status: **active Git continuity checkpoint**. Originally recorded 2026-11-01; updated after hosted synthetic C0 verification on 2026-11-01.
This file is the first-read **navigation and operational handoff** when merged to `main`. It does not supersede source code, immutable database state, approved product contracts or live provider evidence. Do not claim current runtime/database state from Git alone.

## Mandatory start-of-chat protocol

1. Read this document **from GitHub's current `main`**, not a remembered excerpt or a stale local copy. If it is absent, inaccessible or conflicts with another source, **stop before hosted writes** and explicitly report the gap.
2. Check current `main` SHA and compare to the last recorded checkpoint below. Check the relevant 20i/local checkout separately before running commands; a local `origin/main` can be stale without `git fetch`. Do not presume a clean checkout, running process, successful credential setup, or current database contents.
3. Read the linked operator/architecture contracts and any more recent committed evidence. Classify every operational fact as **live verified**, **reported historical proof**, **planned**, or **unknown**. Current database truth requires authorized direct read-only verification.
4. State the **exact next bounded operation**, prerequisites, scope, expected success, failure/unknown-outcome stop rules and whether it mutates live state. Never replay a previous bootstrap, role provision, migration or initializer to recover context.
5. Read the Commercial V1 roadmap below **at every phase exit**. Completing infrastructure never implies that MioPages commercial V1 is complete.
6. After each material operation, checkpoint a sanitized evidence record in Git (or explicitly report why not possible). The handoff is incomplete until the record is retrievable through GitHub. Do not place credentials, tokens, database URLs, private business/customer details, raw query results or sensitive logs into Git.
7. At a new-chat boundary: **fetch this file afresh, verify SHA and cite the next action**. If the file cannot be retrieved, say so immediately rather than relying on chat memory. This process is a verifiable retrieval requirement, not an assertion that ChatGPT automatically opens files.

## Current source and hosted boundary (2026-11-01)

- Repository: `R-Levin/myomaton-web`; branch `main`.
- Source checkpoint: `b3722dd37045e8e200ba0aff8ceff2e201a5e228` — **Add fresh hosted C0 initialization and hostname binding**. At time of recording GitHub `main` pointed to this SHA. User-provided 20i shell output showed `HEAD` at this SHA, synchronized `main...origin/main` and a clean tracked tree after a fast-forward pull. **Future sessions must recheck.**
- 20i hostname: `runtime.miopages.com`. User reported Node 22.23.2 and installed dependencies. Earlier recovery says 20i Application Manager supervises the runtime on port 8080 with `shared-hostnames` routing. The last known-host 404 was the expected unbound tenant state, **not** an application failure.
- Provider/database historical proof (from the uploaded latest `runtime-content/chat-recovery.md`, 2026-11-01): Supabase PostgreSQL 17 (previously 17.11), session pooler 5432, verified TLS `sslmode=verify-full`, ICU identity validated, 16 migrations applied/zero pending, valid PG17 compatibility receipt. Three permanent dedicated roles `miopages_runtime`, `miopages_migration`, `miopages_backup` were **already created and independently verified**. These are reported earlier hosted results, **not fresh database inspection in this documentation task**.
- The latest recovery note reports hosted customer/operational application inventory empty, including **zero** Organization, Web Presence, Managed Site, Page, Section and hostname-binding rows. The historical nine-migration C0 initializer refused safely; **do not use it or try repair/reset**.
- The new protected fresh-hosted operator and separate generic hostname operator are committed and locally tested. Native local PG17 integrations were partially skipped owing to missing binaries; do not count skipped tests as passing. No fresh hosted C0 create or hostname bind has occurred in the current chat.
- In the current conversation, three nonsecret role environment variables were set in an interactive 20i shell. `DATABASE_URL` and `MIOPAGES_DATABASE_NAME` were **unset at that moment**. A separate ignored 20i note `runtime-content/hosted-provisioning-recovery.md` was created; it is supplementary, not a source-of-truth replacement. No hosted writes were made. The operator connection has **not** been established.
- **Current operational decision: PAUSED for continuity repair.** This proposed documentation change does not authorize hosted database writes. Resume only after a deliberate review of current source, connection procedure and live prerequisites.


## Hosted synthetic C0 proof — 2026-11-01 (reported live SSH output)

**Source of evidence:** operator-returned terminal outputs in the development conversation on 2026-11-01; recorded here without credentials, endpoints or private query results. GitHub documentation commit is not proof of additional hosted writes.

- 20i checkout: fast-forwarded to `77487cdbc178982c871671ddfd570ade9126d5d0`; `main...origin/main`, clean at that time. Later documentation updates require a fresh pull before executing future source-dependent commands.
- Protected operator connection: direct `miopages_migration` login verified against database `postgres`; read-only transaction, PostgreSQL-reported TLS v1.3 active, connection configured with `sslmode=verify-full`. An independent hostname/certificate validation beyond the client's TLS setting was not separately observed. Persistent application runtime config not modified.
- Fresh-hosted preflight: 16 applied migrations, PG17 bootstrap receipt present, 32 inventoried application tables inspected, all empty (zero application rows). The quick receipt-presence check did not independently validate full receipt contents; the guarded initializer subsequently ran its stricter checks.
- Guarded create (one-time): `MIOPAGES_DATABASE_OPERATION=fresh-hosted-c0`, `MIOPAGES_C0_ACTION=create node --import tsx scripts/initialize-fresh-hosted-miopages-c0.ts` returned `verified:true`, 38 inserted, **2 updated** (actual CLI output), 0 deleted. Organization `152aebd3-00b3-4296-a64e-e281522e64f0`, Web Presence `926cb772-7507-4542-8acd-e7e57ce71324`, Managed Site `312b8081-4582-47fa-bedb-a551fd6e2b36`. Actual 2 updates differ from older contract's narrative of one; investigate only if needed, **do not replay create as a diagnostic**.
- Independently executed `MIOPAGES_C0_ACTION=verify node --import tsx scripts/initialize-fresh-hosted-miopages-c0.ts`: `verified:true`, 0 inserted, 0 updated, 0 deleted; same three identifiers. **Hosted synthetic C0 establishment is complete.** Initial graph is 4 Pages / 19 Sections (not later canonical 4/23); synthetic, not commercial customer publication approval.
- Runtime config anomaly discovered during connection setup: protected runtime `DATABASE_URL` parsed with database path `/postgres\\` instead of `/postgres` even though the raw value did not end in backslash. The temporary migration connection corrected its path **only in memory**. Persistent runtime file remains unchanged. Root cause not proven. **Controlled, backed-up permanent configuration correction and runtime validation are outstanding before accepting hosted provisioning.** Do not commit or display raw URL.
- **Next bounded operation:** after reviewing the managed-hostname contract, perform a separate `runtime.miopages.com` synthetic hostname bind with the IDs above using the dedicated operator, then independent read-only bind verification, known Host 200 / unknown Host 404 and public HTTPS checks. A hostname bind is a hosted database **write and changes public routing**; technical exposure is not commercial launch authorization. Stop on any refusal or uncertain commit outcome, do not retry blindly. Operator secret remains temporary in the user's SSH session; clear it after operator operations.
- Hosted C1 isolation, backup, restart, deployment, recovery and monitoring are not yet proven by this milestone.


## Hosted C0 hostname and HTTP proof — 2026-11-01 (reported live SSH output)

- Separate managed-hostname `bind`: `verified:true`, hostname `runtime.miopages.com`, binding ID `bfd0daa1-3a9d-429d-8b60-b2d9851f9603`, inserted 1, updated/deleted 0.
- Independently executed `verify`: same hostname and binding ID, `verified:true`, inserted/updated/deleted 0 (read-only).
- HTTP proof from 20i shell: `Host: runtime.miopages.com` on 127.0.0.1:8080 returned 200; deliberately unknown `Host: unknown-test.invalid` returned 404; public `https://runtime.miopages.com/` returned 200, curl `ssl_verify_result=0`. User independently saw page in browser.
- **Known content mismatch:** hosted output is the initial reviewed **4-page/19-section** manifest, not the later accepted service-led v3 **4-page/23-section** canonical state. The latter has a historically verified development-only promotion described in `docs/miopages-canonical-promotion.md`; its frozen precondition includes a nine-migration development baseline and must **not** be directly replayed or forced against the hosted 16-migration state. A separate reviewed, tested hosted promotion path is needed. No further hosted content mutation authorized or executed in this proof.
- **Current next bounded task:** plan and implement protected, fail-closed promotion from hosted synthetic initialized 19-section state to the reviewed v3 canonical graph, preserving tenant isolation, nonsecret evidence, asset eligibility and independent read-only verification. Use Codex for implementation/testing as appropriate. Also separately correct the protected runtime URL backslash anomaly with backup and process validation; do not expose secrets or silently change runtime config.
- After those, continue hosted foundation (C1 isolation, supervision/restart, deployment/rollback, durable media and independent backup/recovery, monitoring and capacity); follow Commercial V1 canonical roadmap, not an invented backlog. Technical C0 access is not commercial publication approval.

## Additional hostname routing proof — November 1, 2026

**Evidence classification:** user-reported live 20i SSH commands and results, not a fresh independent provider audit.

- Added `domain-test.miopages.com` to the existing Cloud hosting package for `runtime.miopages.com`; no additional package or Node process.
- Initial DNS pointed to shared hosting IP `185.146.167.193` and returned Apache 403. 20i Support identified the Cloud IP as `185.146.167.103`. The corrected A record resolved at the default resolver and 1.1.1.1. HTTPS to the Cloud IP with the intended Host returned expected unbound Next.js 404.
- Guarded hostname bind returned `verified:true`, binding ID `46bbd56e-9f28-4006-8bc0-df70c955cda3`, 1 insert and zero updates/deletes; it selects the existing synthetic C0 Web Presence and Managed Site.
- Independently executed `MIOPAGES_HOSTNAME_ACTION=verify node --import tsx scripts/manage-hostname-binding.ts`: `verified:true`, same hostname and binding ID, zero inserts/updates/deletes.
- After binding, both public HTTPS hostnames (`runtime.miopages.com` and `domain-test.miopages.com`) returned HTTP/2 200 through nginx 1.30.5 / Next.js. This proves shared delivery and HTTPS for two hostnames; certificate wildcard type, issuance and renewal automation are **not** yet proven.
- **Next infrastructure experiments:** a spare second-level domain with split Reseller/Cloud domain, mail, DNS and website services; then a customer domain retaining external authoritative DNS and requiring independent certificate coverage. Inspect 20i API capabilities after manual procedures are proven. No domain changes to customer services without DNS/mail inventory and authorization.
- **Still open:** protected runtime connection-string path anomaly (permanent controlled correction), hosted synthetic C1 isolation, deployment/restart/recovery, durable assets, independent backup and capacity/monitoring proofs. Optional newer C0 visual/content promotion is not a prerequisite for these domain tests.

## Guarded next hosted sequence (historical sequence; consult latest proof above)

Authoritative procedure: [C0 canonical state / fresh-hosted synthetic establishment](miopages-c0-canonical-state.md#fresh-hosted-synthetic-establishment).

1. Confirm clean/current 20i checkout and read the exact operator contract.
2. Establish protected `miopages_migration` operator credentials **separately** from persistent `miopages_runtime` app credentials. Obtain actual endpoint and certificate paths from protected existing configuration, never guessed values; require verified TLS and expected database/role identity. Do not overwrite persistent runtime configuration.
3. Run protected fresh-hosted C0 `create` **once**, stop on unexpected failure; a disconnect around COMMIT is an unknown outcome requiring independent read-only verification before any deliberate retry.
4. Independently run fresh-hosted C0 `verify` (read-only). Only then bind `runtime.miopages.com` to reviewed Web Presence `926cb772-7507-4542-8acd-e7e57ce71324` and Managed Site `312b8081-4582-47fa-bedb-a551fd6e2b36` via the dedicated managed-hostname operator. Independently verify.
5. Clear temporary migration/operator credentials. Verify bound Host responds with the expected rendered Managed Site (200); unknown Host still refuses (404); validate public HTTPS separately. The existing normal runtime renderer supplies the HTML—**a stub page is neither needed nor equivalent to a tenant-routing proof**.
6. Do not equate technical routing with commercial publication or customer approval. Follow with separately scoped hosted C1 isolation, restart, deployment/rollback, persistent assets, independent recovery/off-provider backup, monitoring and capacity proofs. Do not rerun fresh C0 initialization after binding: the initializer deliberately refuses later operational inventory.

**Explicit prohibitions:** no bootstrap/migration/role-provision replay; no historical initializer; no broadening runtime permissions; no `postgres` as production application runtime; no arbitrary SQL repair, credential disclosure, silent retry, live-customer data or commercial launch inference.

**Synthetic meaning:** hosted C0 is a controlled synthetic tenant **using the reviewed MioPages C0 manifest and fixed IDs**. It is not a real paying customer. Its initial hosted graph is recorded as **4 Pages / 19 Sections**. The later reviewed canonical visual/content direction describes **4 Pages / 23 Sections**; these are distinct stages and must not be conflated. Public access after hostname binding is a separate exposure decision.

## Proof/evidence ledger (nonsecret)

| Boundary | Current classification | Evidence or qualification |
| --- | --- | --- |
| Source/operator implementation | GitHub verified at checkpoint | Commit `b3722dd`; [C0 operator procedure](miopages-c0-canonical-state.md) |
| 20i Git checkout | User live shell output, 2026-11-01 | Clean `main...origin/main`, HEAD `b3722dd` after `git pull --ff-only` |
| Hosted 20i runtime | Historical reported proof | Application Manager, port 8080, expected unknown Host 404 |
| Hosted PG17 TLS/migrations/roles | Historical reported proof | 16/0, verified TLS, permanent three roles; fresh read-only check pending |
| Hosted customer rows before next write | Historical reported empty | No fresh inspection in this continuity task |
| Protected migration operator connection | Not established | All five operator variables initially unset; only three nonsecret roles set |
| Fresh hosted C0 create/verify | Not attempted | Requires separate scoped execution |
| Hostname bind/verify | Not attempted | Requires verified C0 |
| Bound public HTTPS known-host 200 | Not verified | Known-host 404 before binding is expected |
| Hosted C1 isolation / backup / restart / deploy / monitoring / scale | Not proven | Must remain explicit hosted gate |

Never promote historical evidence to live without an actual check. Add new evidence here or in a reviewed linked committed ledger after each operational boundary, with date, SHA, environment, action, sanitized outcome and any unknowns.


## WordPress delivery feasibility decision — 2026-11-02

**Operator-approved evaluation, not commercial deployment approval.** The operator reviewed and accepted WordPress Delivery Feasibility Specification v0.1, then clarified that normal customers should not need WordPress credentials; managed Gutenberg content must be protected beyond editor locking; and the publishing transport should work with other WordPress hosting providers. A standardized 20i Reseller WordPress installation per customer is the leading candidate for an initial delivery adapter; agency/connected-site deployment is a later opportunity. Existing Next.js shared renderer and Supabase canonical database remain intact.

- Read [WordPress delivery feasibility and implementation gap analysis](wordpress-delivery-feasibility.md) for transport, ownership, operational risks and explicit proof gates.
- **Priority shift:** pause speculative expansion of the shared Next.js runtime's additional-domain/SSL infrastructure while validating the WordPress approach. Preserve hosted C0 and all earlier proofs. The previous 'WordPress post-V1' language in the platform architecture is now an **open architecture revision**, not automatically changed; reconcile roadmap only after proof and approval.
- **Exact next bounded operation (read-only):** inspect existing Pages/Sections/Actions/Assets schemas, release/approval and renderer source; document module-level reuse and produce a synthetic, versioned sample release manifest for a WordPress adapter. No hosted writes, reinitialization, migrations, customer DNS/SSL changes, plugin deployment or secrets.
- The future proof will require explicit authorization for one isolated 20i WordPress test site and later one separate-host test; test signed, tenant-scoped pull/notify transport, invalid-release refusal, atomic publication, local last-good serving, rollback, drift detection, restore and fleet operations.

## WordPress C0 v3 source fixture checkpoint — 2026-11-02

- Source-derived **read-only** exporter: `scripts/export-wordpress-c0-v3-fixture.mjs`; checked-in nonpublishable `docs/wordpress-c0-v3-structural-fixture.json`; first mapping `docs/wordpress-c0-v3-mapping.md`.
- Based on frozen, human-accepted `scripts/customer-updates/miopages-focus-reviewed.json`: 4 pages, 23 sections (5/8/5/5), page recipes arrival/service/evidence/assessment; 5 bound Sections left as explicitly unresolved canonical projections.
- The exported record is deliberately **not** an approved distributable release: no media bytes or unapproved FPO, no pretense of enabled Review workflows, no exposure of private price amounts, and no central DB/hosted changes.
- **Next bounded step:** validate exporter reproducibility and resolve public content through authorized existing canonical projections in a **local, read-only** fixture path; then specify signed release format and build WordPress page/section proof. Source module inventory is preliminary, not proof of code reuse.
- Existing hosted 20i synthetic C0 and its DNS/SSL experiment remain untouched.
- Added `scripts/project-wordpress-c0-v3.ts`: read-only local C0 v3 public canonical projection exporter using existing `normalizeBinding` / `projectContent`; correct action destination/navigation target mappings in earlier structural exporter and fixture. **New TS script not yet executed or reproducibility-validated** in this session. Next run it locally twice, audit data, then explicitly generate and review nonpublishable JSON; no hosted DB access.


## WordPress operator-editor inbound proposal track — 2026-11-03

Operator requested evaluation of Gutenberg/WordPress Posts, Pages and CPTs as an editing interface for content-form business knowledge instead of building a rich-text editor from scratch. Added to [WordPress delivery feasibility](wordpress-delivery-feasibility.md#operator-gutenberg-editing-as-an-inbound-knowledge-proposal-channel-2026-11-03) as a separate **inbound editorial adapter**. Edits create authenticated tenant-scoped **pending proposals** with actor, base version, source revision and provenance; approval and public release stay in core MioPages. Do not conflate with the **outbound** WordPress delivery release, hosted WordPress page locks or the 20i service adapter. Begin with a single restricted article/CPT editorial proof; do not establish 100 per-customer editing workflows or a central editorial WP hub without subsequent evidence. This decision adds design/proof scope, not a completed feature or authorization for live writes.

## Active development handoff — WordPress two-way delivery/editorial + 20i service adapter (2026-11-03)

**Decision status:** Operator approved a bounded dual-track WordPress proof alongside investigation of 20i Reseller API automation. These are **not live features, not production authorization, and not a silent rewrite of the Commercial V1 roadmap**. The WordPress track was historically deferred; this is a deliberate evaluation-priority change pending proof and later roadmap reconciliation. Existing Next.js renderer, hosted synthetic C0 and managed PG17 remain unchanged.

**Three independently replaceable boundaries:**
1. **Core MioPages** owns structured business knowledge, derived editorial artifacts, approvals, versioning, impact assessments, authorized releases and audit/provenance.
2. **Provider-independent WordPress delivery/editorial adapter:** outbound signed, tenant-bound approved release staging/activation with local last-good serving and rollback; *separately* inbound authenticated operator-edit proposal capture from supported WP posts/pages/CPTs. Native Gutenberg is a candidate operator editor, **not** authority over canonical truth or public publication.
3. **20i service delivery adapter:** optional hosting/package inventory and provisioning, WordPress install/environment preparation, DNS/SSL, backups/operations. It does not make content/publication decisions and is **not** a core business/knowledge component. Other WP hosts must remain supported without 20i.

**Editorial governance contract (agreed design direction):** An authorized WP Editorial Operator edits a supported document or structured knowledge-backed record. Plugin captures actor, installation/tenant/record/revision IDs, normalized diff, base canonical version and provenance into an idempotent **pending proposal**. A separately authorized MioPages Reviewing Operator can approve, reject, request changes or suggest alternative wording, including return to the originating operator or customer for factual confirmation. A customer confirmation is evidence/attestation, **not automatically final publication authorization**. Approval updates the appropriate canonical knowledge entity or governed editorial artifact; impact assessment distinguishes direct linked references, possible semantic effects needing review, and unaffected surfaces. Knowledge acceptance, derivative copy approval and per-channel release are separate governed decisions. Do not cascade edits or overpromise cross-channel automatic updates. Preserve versioned discussion, evidence, review assignment, scope, conflicts, audit and loop prevention; design for workflow complexity but implement a narrow first proof. See [detailed contract](wordpress-delivery-feasibility.md#operator-gutenberg-editing-as-an-inbound-knowledge-proposal-channel-2026-11-03).

**Verified committed reference:** `docs/wordpress-c0-v3-public-projection-fixture.json` is available on this branch and deliberately `publishable:false`. It is based on frozen accepted service-led v3, 4 Pages / 23 Sections, five canonical projections, four recipes; digest `f4d7a71c9af0b7c430e9fb24d6416c7fd1764170ed5cd0da39b470ea5a91ccc4`. Asset bytes/rights, five unresolved media roles, review workflow and plugin release transport remain unverified or unimplemented. Do **not** publish this fixture on the public domain as if it were an approved release. Historic hosted Next.js C0 is older, 4/19, and is **not** the fixture source for this proof.

**Operator-reported 20i test environment:** Dedicated 20i Linux Unlimited reseller package for `miopages.org`, SSL active and PHP 8.3. WordPress installation and protected development access are not verified here. 20i provided `20i API Blueprint.apib` after its hosted Apiary documentation viewer returned 404; treat the file as an external reference to preserve privately or sanitize before Git, *not* proof that any API operation is available to the account. Read-only inventory is the first 20i API proof; no API credentials/secrets in Git. WordPress Blueprint/WordPress Platform compatibility and provider-specific limits require verification. No endpoint operations were executed in this checkpoint.

**Next bounded engineering proof sequence (not a broad build authorization):**
1. Re-fetch Git `main` + this active branch, compare source and approval gates; do not trust stale local checkout.
2. Confirm protected/nonpublic dev WordPress at `miopages.org` before loading **nonpublishable** C0 v3 sample content. Build provider-neutral renderer/plugin package and test controlled local preview/fidelity without live publication or hosted PG writes.
3. Implement a single inbound operator **article draft → authenticated pending proposal** path with idempotency, source revision and central actor validation. Then one structured **service or location** CPT path with explicit knowledge mapping; prove reviewer alternative/return for revision and separate approval/release.
4. Demonstrate one dependency/impact report for a changed structured fact; no blanket rewrite. Verify outbound release does not create duplicate inbound proposals and protected WP pages cannot be casually edited.
5. In parallel, create a read-only 20i service-adapter inventory operation for the test package, only after credential storage/IP restriction and account entitlements are checked; keep provisioning writes separate and opt-in.
6. Record test results, remaining unknowns and explicit failed gates in Git after each bounded proof; **do not** assert implementation completion before tested evidence.

**Continuity constraint:** Source of truth for active branch work is [PR #5](https://github.com/R-Levin/myomaton-web/pull/5); ensure `main` has a navigational link until merged. Do not merge or silently change canonical roadmap/production deployment authority as part of this checkpoint. Current development spec and this record reflect agreed direction and research/proof gates, not a delivered WordPress plugin or operational 20i integration.

## First WordPress plugin source checkpoint — 2026-11-03

**GitHub-source verified, execution/deployment unverified:** Added `wordpress/miopages-delivery/miopages-delivery.php`, `includes/class-miopages-fixture-preview.php`, `tests/preview-smoke.php` and README on the active WordPress development branch. The experimental plugin has a *WordPress-administrator-only* Tools preview that accepts pasted **nonpublishable** C0 v3 JSON, verifies the 4-route/23-section schema and allowlisted five section types, renders escaped content and nonclickable action labels. It performs no content or database writes, has no public route, does not transmit to MioPages or 20i, and cannot publish the frozen fixture. This is a structural proof, **not design fidelity, authenticated release delivery, or the promised bidirectional integration**. Its schema gate is not a cryptographic signature/source digest validation.

**Next bounded action:** Run the three PHP syntax checks and `php wordpress/miopages-delivery/tests/preview-smoke.php` on the existing Windows repo (CLI available only if installed); capture exact outcomes. Confirm `miopages.org` WordPress installation and private access protection before **any** staging upload. Do not claim WordPress installed or site protected yet. Then test the administrator-only preview on the isolated dev site. Independently implement the inbound editorial proposal proof and read-only 20i API inventory in later guarded slices; do not conflate those with the current preview.

## WordPress hosted private-preview field result — 2026-11-03

**User-reported interactive result, not an independent content/fidelity audit:** On `miopages.org` (20i Linux Unlimited Reseller, PHP 8.3, WordPress version reported 7.1.4), user installed WordPress and confirmed 20i `public_html` directory password protection works when opening the site in a private browser window. Experimental `MioPages Delivery (Development Proof)` plugin was installed and activated. Under WP Tools → MioPages Preview, user pasted `docs/wordpress-c0-v3-public-projection-fixture.json` and reported the simplified private preview rendered properly. This is **a preliminary successful admin-preview smoke proof**, not verified pixel/design parity, production authorization, actual WP page publishing, central authority, release transport or full automated tests.

**Packaging failure and resolution:** Original Windows `Compress-Archive` ZIP listed plausible entries under `tar -tf` but 20i extraction produced literal filenames with backslash-separated path components in a randomized plugin directory; WP reported “Plugin file does not exist.” Rebuilt using `tar -a -c -f miopages-delivery.zip -C wordpress miopages-delivery`; user reported successful plugin activation. Preserve portable ZIP entry-path guidance in later deployment packaging.

**Independent local tests reported by user:** All three `php -l` checks passed; `php wordpress/miopages-delivery/tests/preview-smoke.php` returned PASS for 4/23 inventory, publication gate, section allowlist and HTML escaping. These are reported user terminal outputs, not new CI proof. No evidence of hosting/central DB/API writes from the preview tool. Nonpublishable fixture remains `publishable:false`.

**Next bounded development step:** Design and implement a provider-neutral, restricted section/theme renderer using the accepted v3 fixture **only in protected development preview**; verify content mapping, styles and responsive fidelity; enforce nonpublishable and unresolved media/publication gates. Use reproducible platform-safe packaging. Keep inbound WordPress→MioPages editorial proposal and read-only 20i API adapter as separate tracks, and do not prematurely publish managed pages or enable public releases.

## WordPress visual-preview v0.0.2 source checkpoint — 2026-11-03

**Source committed, runtime verification pending:** The admin-only WordPress prototype was extended with `wordpress/miopages-delivery/assets/preview.css` and a class-based renderer for all four accepted C0 v3 routes / 23 sections. Includes reviewed surface colors (light, brand, tonal, strong, supporting, contrast), recipe-class page shells, responsive card layouts, stage/relationship items, structured party/responsibility rows, illustrative header/navigation and nonclickable actions. All text is escaped, section type/surface/region class values are allowlisted, and the stylesheet is enqueued only on the administrator's Tools → MioPages Preview screen. Plugin bumped from 0.0.1 to 0.0.2; standalone PHP smoke harness covers new visual structure. **No actual public Managed Site rendering, routes, assets, forms or approval/release transport exist.** This must never be confused with production readiness or approved pixel fidelity.

**Verification required before upload:** User's Windows repo `C:\Users\mplxs\Projects\myomaton-web` must fast-forward branch, run PHP lint for plugin, renderer and smoke script, then run `php wordpress/miopages-delivery/tests/preview-smoke.php`. Observe output; no claim of tests passing for v0.0.2 yet. Package with `tar -a -c -f miopages-delivery.zip -C wordpress miopages-delivery` (not earlier Windows Compress-Archive path format). Replace **only** the experimental plugin on private `miopages.org`; confirm the version, nonpublic status and styled preview by manual inspection at desktop and narrow width. Preserve reported directory password protection and nonpublishable fixture `publishable:false`. If a test or deployment step fails, stop and inspect rather than changing hosted DB or publishing content.

**Next technical boundary after validation:** Compare rendered layouts with accepted service-led v3 reference; address verified design tokens, local font/media ownership and section visual grammar without violating unresolved asset gates; then move to a real provider-neutral release contract and separately scoped inbound operator-proposal/20i read-only API proofs. Continue recording actual versus planned states in Git.

## Visual-preview v0.0.2 local validation report — 2026-11-03

**User-reported Windows PowerShell checks:** All three PHP lint commands for `miopages-delivery.php`, `includes/class-miopages-fixture-preview.php`, and `tests/preview-smoke.php` returned `No syntax errors detected`. The CLI smoke command `php wordpress/miopages-delivery/tests/preview-smoke.php` returned `PASS: C0 private preview smoke tests (structure, visual shells, publication gate, section allowlist, HTML escaping).` This is user-provided local evidence; WordPress v0.0.2 upgrade, styling and visual fidelity are **not yet independently verified**.

**Next:** rebuild with portable `tar -a -c -f miopages-delivery.zip -C wordpress miopages-delivery`, inspect ZIP entries, replace only the development plugin in password-protected WordPress, and verify the styled administrator preview. Do not enable public release, import pages or change the canonical database.

## WordPress v0.0.2 visual preview acceptance observation — 2026-11-03

**User-reported visual outcome:** Following successful local PHP lint and smoke tests, the user reported that the v0.0.2 styled WordPress preview **"looks very good. Pretty much as I remember it."** This is encouraging initial qualitative validation of the password-protected admin-only renderer, but **not** an independently captured screenshot comparison against the accepted service-led v3 reference, responsive/accessibility evaluation, public WordPress page publishing, or production approval. The installed v0.0.2 version and full content inventory were not independently inspected by the assistant in this report. Preserve nonpublishable C0 fixture restrictions, unverified logos/media, unimplemented review form and release transport.

**Next bounded technical operation:** capture reproducible visual-fidelity observations (desktop/mobile screenshots, content mapping/spacing, missing media), then design the versioned provider-neutral outbound release contract and protected staging/activation *without* publishing the nonpublishable fixture. In parallel, plan one restricted WordPress editorial draft-to-pending-proposal path; read-only 20i API inventory remains separate and no credentials should enter Git.

## Signed release contract v0.1 and offline validator — 2026-11-03

**Source committed; tests NOT YET executed:** `docs/wordpress-release-contract-v0.1.md` defines an Ed25519 signed, exact-bytes, SHA-256-checked, installation/tenant-bound release envelope with monotonic sequence + previous release pointer, scoped approval claim, UTC acceptance window and limited synthetic content. Added independent `wordpress/miopages-delivery/includes/class-miopages-release-validator.php` and `tests/release-contract-smoke.php` using fresh in-memory test signing keys. This is a **pure offline eligibility checker** and **not integrated into live WordPress plugin hooks**, HTTP transport, WP storage, page publication, or the 20i API. Existing public projection C0 v3 fixture remains `publishable:false` and incompatible with the release schema; no conversion, signing or publication of it has been authorized.

**Trust caveat:** a signed `approval.state=approved` claim is only meaningful when the central signer is itself subject to MioPages approval and release authority. That central signer/enrollment, revocation, provisioning identity and protected local key pinning do **not** yet exist. Validator receives active release state as a trusted caller input; there is no atomic compare-and-swap or durable staging, so this does not yet prove anti-replay under concurrency or recoverability. Contract is purposely minimal: one or more synthetic text-only pages/sections, no assets, scripts, arbitrary HTML or forms; full v3 grammar is not currently a publishable release payload.

**Next bounded step:** locally run `php -l wordpress/miopages-delivery/includes/class-miopages-release-validator.php`, `php -l wordpress/miopages-delivery/tests/release-contract-smoke.php`, and `php wordpress/miopages-delivery/tests/release-contract-smoke.php`; require `PASS`, not `SKIP`. Investigate failures and review crypto/key pinning and schema before any staging storage implementation. No WordPress ZIP update is needed/authorized for this offline-only slice. After tests, specify an atomic storage plan and enrollment boundary for a protected test installation; do not connect to production or public pages.

## Release-contract offline test blocker — 2026-11-03

**User-reported local Windows results:** `php -l wordpress/miopages-delivery/includes/class-miopages-release-validator.php` and `php -l wordpress/miopages-delivery/tests/release-contract-smoke.php` both returned "No syntax errors detected". Running `php wordpress/miopages-delivery/tests/release-contract-smoke.php` returned **`SKIP: libsodium is unavailable; do not deploy without it.`** This is **not a passing security test** and does not verify signatures/refusals. No workaround should weaken Ed25519 verification or change the release contract until the local PHP extension environment is investigated.

**Next bounded action:** inspect Windows CLI PHP with `php -v`, `php --ini`, and `php -m | findstr /i sodium` to identify the loaded configuration and whether the Sodium extension is available/enabled. Enable supported libsodium in the user's local PHP environment if present, then rerun the offline tests. Do not deploy the validator or connect it to WordPress while the test is skipped. The 20i hosted PHP 8.3 and Windows CLI PHP are separate environments; neither site's sodium availability has been verified.

## Release Contract v0.1 offline security validation PASSED — 2026-11-03

**User-reported direct Windows CLI evidence:** `C:\php\php.ini` is the active PHP 8.3.27 CLI config; `C:\php\ext\php_sodium.dll` exists. After enabling the sodium extension, `php -m | findstr /i sodium` returned `sodium`. Running `php wordpress/miopages-delivery/tests/release-contract-smoke.php` returned **`PASS: offline release-contract smoke tests (signature, targets, approval, replay, time, content gates).`** Both validator and smoke-test PHP syntax lint previously passed. This closes the **local missing-sodium test blocker**; it does **not** prove that the hosted 20i PHP process loads sodium or that signed release staging is operational.

**Scope of proof:** The isolated pure-PHP test accepts a synthetic valid signed envelope and rejects bad signature/hash, wrong tenant/installation, unapproved claim, replay/order error, expired/overlong release, external route, unsupported section and HTML content. It uses ephemeral in-memory test keys and no deployed signing key. The validator is deliberately disconnected from WordPress hooks, persistent storage, API transport and publication. The central signer approval authority, secure enrollment/key rotation, durable atomic stage/activation/rollback, and production tests remain open.

**Next bounded task:** review and design protected staging storage plus race-safe activation/rollback semantics, including immutable staged objects, monotonic revision and compare-and-swap; write a local/offline proof before any WordPress write integration. Keep the existing password-protected WP visual preview operational and C0 v3 fixture nonpublishable. No 20i API or hosted DB operations authorized by this evidence.

## Offline release staging and activation first slice — 2026-11-03

**Committed source, NOT YET runtime tested:** `docs/wordpress-release-staging-v0.1.md` sets the private immutable-object and guarded active-marker design. Added `wordpress/miopages-delivery/includes/class-miopages-release-store.php` and `tests/release-staging-smoke.php`. This is an **offline, PHP-only** store: requires an existing caller-supplied private directory, stages exact signed envelope bytes in digest-addressed objects, uses a cooperative exclusive file lock, checks immutable object integrity, and conditionally advances an `active.json` marker only after signature/tenant/approval/sequence/time revalidation. It has NO WordPress hooks, public routes, site rendering, imported WP posts, database writes, live HTTP transport or 20i credentials. `miopages.org` plugin v0.0.2 requires **no update** for this slice.

**Rollback design:** Directly rewinding the active marker is forbidden; controlled restoration means a **new centrally signed, approved forward-sequence release** with previously approved desired content. This is not proof of deployed rollback; central authority and signer, release transport, staged asset coherence and actual public serving remain unimplemented.

**Safety/portability gaps:** Required outside-webroot storage, correct OS-level permissions, no symlink escapes, lock semantics on target filesystem, crash durability, cross-process/cross-host concurrency, staging retention and recovery have not been security-audited. PHP hard-link and atomic-rename behavior must be validated on intended environments (including local Windows and 20i Linux). This is a feasibility proof, not a production persistence implementation. The marker does not switch a working WordPress website.

**Next exact action:** In `C:\Users\mplxs\Projects\myomaton-web` fetch active branch, run `php -l wordpress/miopages-delivery/includes/class-miopages-release-store.php`, `php -l wordpress/miopages-delivery/tests/release-staging-smoke.php`, and `php wordpress/miopages-delivery/tests/release-staging-smoke.php`. Only record a PASS if observed; otherwise stop, inspect and repair offline. Rerun earlier release-contract smoke test to detect regression. Do not deploy staging code on WordPress or create public pages.

## Offline staging/recovery local test PASS — 2026-11-03

**User-reported Windows CLI evidence:** `php -l wordpress/miopages-delivery/includes/class-miopages-release-store.php` and `php -l wordpress/miopages-delivery/tests/release-staging-smoke.php` both returned **No syntax errors detected**. `php wordpress/miopages-delivery/tests/release-staging-smoke.php` returned **`PASS: offline immutable staging proof (signed stage, retry, tamper refusal, activation order, forward restoration).`** This completes the intended first local *offline functional* smoke proof. Existing release-contract Ed25519 checks passed separately earlier.

**Interpretation and remaining boundaries:** The smoke test demonstrates the basic lock-protected immutable object store, stage-without-activation, integrity refusal, forward sequence and signed restoration behavior *on the local Windows PHP environment*. It does **not** prove crash-safe durability, security of filesystem permissions, concurrent multi-process behavior, hostile filesystem/symlink attacks, cross-host storage, 20i Linux runtime support, WordPress durable publication, actual backup restoration or centrally authorized signer/enrollment. The installed WordPress v0.0.2 visual preview is unchanged and does not invoke this storage code. No live hosted writes or API operations have been reported.

**Next bounded engineering sequence:** Review the offline store for file/symlink race and failed/unknown-write handling, validate full concurrency/retention/error recovery with separate test processes and the target 20i filesystem in an isolated nonpublic proof only when explicitly authorized. Design WordPress-specific protected private location and transactional serving/activation state before adding WordPress integration. Preserve nonpublishable C0 fixture and signed approval authority. Continue parallel inbound editorial proposal and read-only 20i service-adapter track without conflating them.

## Offline staging failure/recovery hardening — source checkpoint 2026-11-03

**Source committed; NEW tests not yet run:** Offline release store `wordpress/miopages-delivery/includes/class-miopages-release-store.php` now rejects symlinked storage ancestors (where detectable), symlink/nonregular paths for object, active marker and lock; object directory creation and expected low-level filesystem errors fail closed. `tests/release-staging-smoke.php` includes malformed active-marker and missing-active-object fault injections, requiring that read-only status and subsequent writes refuse rather than reset release history. Added `tests/release-staging-concurrency.php` with two independent workers racing to activate the same signed first release under local `flock`; expect exactly one winner, one refusal, correct sequence-1 marker. See [staging specification](wordpress-release-staging-v0.1.md#hardening-test-slice--2026-11-03).

**Important:** User previously confirmed base offline staging smoke passed before these new edits; neither the updated smoke nor the two-process race test has passed in the current checkpoint. No live WordPress hooks, active public page router, signing enrollment, 20i filesystem validation or operational restore exist. No public/canonical writes were made. File locks are cooperative and local; OS permission tests, TOCTOU attacks, file durability/unknown-result recovery and multi-host safety remain unresolved. This is *not* production-ready staging.

**Exact next bounded action:** In Windows repo, fetch/fast-forward WordPress development branch and run syntax for release store, updated staging smoke, new concurrency test; execute updated staging smoke, concurrency test and original signature contract regression smoke. Preserve output and **stop on failure or skip**. Do not upload WordPress plugin. After tests, review errors and design explicit private storage and read-only post-uncertain-commit reconciliation before any host integration.

## Offline release hardening regression checks PASSED — 2026-11-03

**User-reported Windows PowerShell evidence:** Active development branch `docs/wordpress-delivery-feasibility-2026-11-02` fast-forwarded from `81c9ae4` to `1ed3130` (30 Git objects, 5 tracked files changed). Three syntax checks returned **No syntax errors detected** for `class-miopages-release-store.php`, `release-staging-smoke.php`, and `release-staging-concurrency.php`. All three executable smoke tests returned explicit **PASS**:
- `release-staging-smoke.php`: `PASS: offline immutable staging proof (signed stage, retry, tamper refusal, activation order, forward restoration, corrupt-state refusal).`
- `release-staging-concurrency.php`: `PASS: two-process release activation race (one winner, one refused, single monotonic active pointer).`
- `release-contract-smoke.php`: `PASS: offline release-contract smoke tests (signature, targets, approval, replay, time, content gates).`

**Scope:** These are successful **local Windows/PHP 8.3 + sodium** tests, based on exact user terminal output, not CI or 20i runtime proof. They demonstrate fail-closed recovery behavior on malformed/missing active state, cooperative two-process local filesystem locking, and regression coverage for detached signature/tenant/approval/order gates. They do **not** establish crash-durable atomicity, defense against hostile path races, reliable distributed locking, hosted Linux filesystem semantics, centrally governed signing/enrollment, or public WordPress publication and rollback. The existing 20i WP v0.0.2 visual-preview plugin remains unchanged by this step.

**Next bounded action:** Before wiring the offline store into WordPress, design and validate (read-only where possible) a private off-webroot storage location and installation identity/key enrollment on the 20i Linux Unlimited package, plus a consistent marker read/reconciliation plan after uncertain write outcomes. Verify that hosted PHP 8.3 has sodium and that storage supports required filesystem operations. Do **not** copy signing private keys to WordPress or activate any public release. Separately retain inbound operator-edit proposal and 20i API inventory tracks.

## Hosted WordPress environment-readiness diagnostic v0.0.3 — 2026-11-03

**Code committed; installation/tests NOT YET verified:** Experimental WP plugin version incremented to `0.0.3`. Added `includes/class-miopages-environment-check.php`, a restricted WordPress **Tools → MioPages Environment** administrator-only, read-only report. It checks actual WP PHP runtime, Ed25519 Sodium function availability, `flock`/`link`/`rename` function availability (NOT functionality), `open_basedir` configured/not configured, and whether the parent's filesystem location could be off-webroot. It displays only status descriptions, not server paths or credentials; performs no filesystem writes, key installation, API requests, content changes or publication. Added `tests/environment-check-smoke.php` for path classification and report shape. Existing visual preview is preserved. Do not confuse apparent outside-webroot parent with a verified private staging directory.

**Public provider research:** 20i's [shared-host PHP module list](https://docs.20i.com/web-hosting/php-modules-available-on-shared-hosting) documents sodium in multiple PHP versions. That does not prove the extension or filesystem operations are available for this particular `miopages.org` WP process. 20i warns that public phpinfo pages expose sensitive details; the diagnostic does not expose PHP configuration/path output.

**Exact next bounded operation:** Fast-forward `docs/wordpress-delivery-feasibility-2026-11-02` in `C:\Users\mplxs\Projects\myomaton-web`. Run `php -l` for `miopages-delivery.php`, environment class and test; then `php wordpress/miopages-delivery/tests/environment-check-smoke.php`, plus `tests/preview-smoke.php`. Only if passing, rebuild plugin ZIP using verified portable `tar -a -c -f miopages-delivery.zip -C wordpress miopages-delivery`; replace plugin on **password-protected dev WordPress** and visit Tools → MioPages Environment. Capture nonsecret descriptive results. Do not install staging, create private folders, expose paths, use API credentials or publish C0. The installed plugin remains `0.0.2` until user verifies upgrade.

**After hosted results:** Assess whether 20i permits a suitable actual off-webroot private directory and separately test host PHP sodium, lock, link, rename, isolation/permissions and recovery. Keep signer private keys only centrally. Do not infer trust/enrollment from a diagnostic.

## WordPress environment diagnostic path classification fix — 2026-11-03

**User-reported local test:** After fast-forward to `c6ed48f`, PHP syntax lint passed for the plugin, `class-miopages-environment-check.php` and `environment-check-smoke.php`; existing `preview-smoke.php` passed. New environment test returned **`FAIL: same root can identify possible parent`**. Root cause: `candidateStatus()` incorrectly required WordPress root to be a *strict child* of document root, rejecting a common installation where WordPress root **equals** document root. Code corrected in `class-miopages-environment-check.php` to allow equality while still refusing candidates inside document root and treating unexpected path relationships as unknown.

**Verification not yet received after fix.** Next: `git pull --ff-only`; run `php -l wordpress/miopages-delivery/includes/class-miopages-environment-check.php`, `php wordpress/miopages-delivery/tests/environment-check-smoke.php` and `php wordpress/miopages-delivery/tests/preview-smoke.php`. Require both smoke suites PASS. **Do not upgrade WordPress v0.0.2 to v0.0.3 before these checks pass.** No hosted PHP, private directory, activation, signer or 20i API work performed by this fix.

## Environment-classification repair verified locally — 2026-11-03

User-reported after fast-forward to `5e2e829`: `php wordpress/miopages-delivery/tests/environment-check-smoke.php` returned **`PASS: WordPress environment read-only diagnostic (root classification and capabilities).`** Separately, `php wordpress/miopages-delivery/tests/preview-smoke.php` returned **`PASS: C0 private preview smoke tests (structure, visual shells, publication gate, section allowlist, HTML escaping).`** This closes the local path-classification test failure. Original new-plugin syntax checks had also passed before the fix; code change is a single path-condition adjustment. No hosted v0.0.3 installation result yet.

**Next authorized operator action:** Build portable plugin ZIP with `tar -a -c -f miopages-delivery.zip -C wordpress miopages-delivery`; replace plugin on protected `miopages.org` WordPress development site; verify v0.0.3 and visit Tools → MioPages Environment. Record only descriptive diagnostic outcomes (PHP/Sodium, available filesystem functions, open_basedir, off-webroot-candidate classification), no absolute paths or secrets. Do not create private storage, issue signing keys, enable public publishing, or touch MioPages core.

## 20i WordPress hosted diagnostic observed — 2026-11-03

**User-reported output from Tools → MioPages Environment on protected `miopages.org` (v0.0.3 update implied by presence of screen):** PHP **8.4.27 (fpm-fcgi)**; `sodium_crypto_sign_verify_detached` **available**; `flock`, `link`, `rename` **functions available**, actual behavior **unverified**; `Private storage candidate: Potential off-webroot parent detected; private subdirectory, rights and access are NOT verified`; `open_basedir` **not detected**; diagnostic reports **no filesystem writes** and **no WordPress publication**. Exact runtime diagnostics supplied by user; not independently probed by developer. Do not confuse PHP 8.4 hosted with local Windows PHP 8.3.27.

**Assessment:** Basic host capabilities support proceeding to a bounded private filesystem proof; **not production-ready**. Outstanding: verify actual physically isolated off-webroot private subdirectory (including no HTTP access, permissions, symlink handling), true `flock`/`link`/`rename` behavior on the hosting filesystem, write failure/uncertain pointer state reconciliation, backups and recovery. Next bounded implementation should be a restricted admin-only or CLI-only synthetic diagnostic, gated independently and NOT invoked by normal site requests; one-shot cleanup; no real release data, no private signing key, no publication. Do not automatically create directories in unverified locations or claim that `open_basedir` absence means filesystem security. Existing offline staging code not yet deployed/connected.

## Gated one-shot private filesystem test v0.0.4 — code checkpoint 2026-11-03

**Source committed, local tests NOT YET executed and hosted probe NOT YET RUN:** WordPress plugin increments to `0.0.4`, adds `includes/class-miopages-filesystem-probe.php` and `tests/filesystem-probe-smoke.php`. New **Tools → MioPages Filesystem Probe** is administrator-only, nonce-protected and disabled without explicit `MIOPAGES_PROBE_PRIVATE_DIR` in non-Git `wp-config.php`. Path must exist and be outside public document root and WP directory, with preliminary path/symlink refusal. Operator must *independently* verify HTTP non-exposure, access rights and hosting provider permission before setting constant. No default path is guessed or created. Clicking the opt-in action creates only a randomly named synthetic child and tests write/read, single-process `flock`, hard `link`, rename, cleanup. Reports status without server paths; does not stage releases, load signer private keys, publish content, call APIs or touch canonical runtime. Current deployed 20i plugin remains v0.0.3 until user confirms upgrade.

**Exact next bounded user action:** `git pull --ff-only`, PHP syntax-check plugin entry, probe class and probe test; run `filesystem-probe-smoke.php`, `environment-check-smoke.php`, `preview-smoke.php`. Require explicit PASS on all smoke tests. If successful, package ZIP with `tar` portable separators and replace plugin on **protected development WP**. Visit new Tools → MioPages Filesystem Probe and confirm it displays **Disabled** by default; preserve prior preview and environment screens. **Do not set private path or click Run** until a real private directory has been separately verified. See `wordpress/miopages-delivery/README.md` v0.0.4. No hosted private write test is proved by simply installing v0.0.4.

**Remaining risk:** PHP path checks are defense in depth, not proof against malicious symlink/TOCTOU races, shared hosting account exposure, crash durability or cross-process locking on 20i. Physical ACL, open_basedir, permissions, URL accessibility and backup rules need independent review before using release storage.

## Filesystem probe v0.0.4 local checks — partial user results, 2026-11-03

**User-reported PowerShell output:** `php -l` passed for `miopages-delivery.php`, `class-miopages-filesystem-probe.php` and `filesystem-probe-smoke.php`. `filesystem-probe-smoke.php` returned **`PASS: synthetic filesystem probe (off-webroot guard, lock, hard link, rename, cleanup).`** `environment-check-smoke.php` returned **`PASS: WordPress environment read-only diagnostic (root classification and capabilities).`** The user supplied the command invocation for `preview-smoke.php` but **no output**; do not mark that regression check PASS until separately confirmed.

**Next step:** rerun `php wordpress/miopages-delivery/tests/preview-smoke.php` and verify explicit PASS before packaging/deploying v0.0.4. Keep the hosted private filesystem probe disabled until an independently inspected off-webroot directory is configured. None of the successful local checks establishes hosted write behavior.

## Filesystem probe v0.0.4 local test gate CLEARED — 2026-11-03

User separately reran `php wordpress/miopages-delivery/tests/preview-smoke.php` and received **`PASS: C0 private preview smoke tests (structure, visual shells, publication gate, section allowlist, HTML escaping).`** Combined with previous three successful PHP lint checks and both successful filesystem/environment test suites, **all six local checks are now user-reported PASS**. This supersedes the prior partial-output checkpoint; no failures remain in that bounded smoke gate.

**Next authorized operator action:** fast-forward branch, build plugin ZIP with portable `tar -a -c -f miopages-delivery.zip -C wordpress miopages-delivery`, replace plugin on protected `miopages.org`, confirm installed v0.0.4 and new Tools → MioPages Filesystem Probe displays **Disabled: no private path has been explicitly configured**; confirm existing Tools → MioPages Preview and Environment work. **Do not set `MIOPAGES_PROBE_PRIVATE_DIR` or click Run** until 20i private path/permissions/HTTP access are independently reviewed. Source commit is not proof of hosted installation or filesystem writes.

## Hosted v0.0.4 filesystem probe safe default confirmed — 2026-11-03

**User-reported:** On protected `miopages.org`, new Tools → MioPages Filesystem Probe screen **shows Disabled**. This is positive proof that the explicit `MIOPAGES_PROBE_PRIVATE_DIR` opt-in gate has not been armed on that installation, and strongly indicates v0.0.4 diagnostic screen was deployed. User has not separately reconfirmed version number or both earlier admin screens. No hosted filesystem write test was run and no private directory was configured.

**Next bounded operator action:** Through 20i StackCP File Manager for the `miopages.org` Linux hosting package, inspect only whether the account root contains `public_html` and whether nonpublic sibling folders/private directory placement are possible. Do not create/edit/delete yet and do not share absolute home paths. 20i documentation confirms File Manager is a standard StackCP feature and the package home directory is distinguished from `public_html` (see https://docs.20i.com/reseller-guide/reseller-hosting-stackcp and https://docs.20i.com/migrations-and-transfers/transfer-files-with-rsync). Avoid inferring directory HTTP privacy solely from it appearing outside `public_html`. Only after manually reviewing package layout and actual permissions/design can a dedicated private test directory be authorized. Then a separate explicit action may set `MIOPAGES_PROBE_PRIVATE_DIR` server-locally. No real releases or signer keys allowed in probe.

## 20i package directory layout observed — 2026-11-04

**User-reported read-only File Manager observation:** In the `miopages.org` 20i hosting package File Manager, the operator can see the `public_html` folder from the current directory level. This suggests (but does not prove) that a separate sibling directory for private test storage may be possible. No folder has been created or written, no permissions or HTTP inaccessibility verified, and the filesystem probe remains disabled.

**Next operator check:** Confirm whether File Manager exposes a **Create Folder/New Folder** action at the same level as `public_html`, without using it yet. If yes, separately plan a narrowly scoped `miopages-private` sibling, verifying host ownership, restrictive permissions, nonpublic URL access and PHP access before enabling any one-shot synthetic probe; avoid sharing absolute paths or credentials. Do not create files inside `public_html`, do not publish customer content or insert signer private keys.

## 20i private sibling folder created; permissions 0700 — 2026-11-04

**User-reported:** In the 20i File Manager for protected `miopages.org` WordPress, a sibling directory `miopages-private` was created at the same level as `public_html`. Its initial permissions were `755`; operator changed them to **`700`**. This is a useful filesystem permission boundary but is **not proof** of PHP runtime access, owner identity, web non-exposure, or hosted lock/link/rename behavior. The v0.0.4 probe remains disabled pending explicit trusted config.

**Next bounded operator check:** In File Manager, open `public_html` and confirm `wp-config.php` is located there (without showing its contents or credentials). After confirming actual config location, provide a safe backup-first instruction to define `MIOPAGES_PROBE_PRIVATE_DIR` as a path derived from that known location, with no paths pasted in chat; then run only the nonce-gated synthetic filesystem probe. Do not put secrets in Git, create public probe files, stage real releases, or infer HTTP isolation solely from mode 0700.

## Hosted filesystem probe visibly armed; public isolation check pending — 2026-11-04

**User-reported:** In password-protected `miopages.org`, after adding `MIOPAGES_PROBE_PRIVATE_DIR` via relative `dirname(__DIR__) . '/miopages-private'` expression in `public_html/wp-config.php`, Tools → MioPages Filesystem Probe now **shows the run button**. This means the plugin's preliminary `safeDirectory` check passed, not that private HTTP isolation, owner identity, or hosted filesystem semantics have been independently verified. The sibling `miopages-private` was set to mode 0700. No hosted synthetic write was reported yet.

**Immediate next step:** User checks public URL `https://miopages.org/miopages-private/` in incognito, reporting status only and not credentials/paths. A 403 or 404 is preliminary supporting evidence only, **not a complete proof** of isolation against aliases, alternate virtual hosts or direct access. If directory listing or private file appears, stop, disable probe, review server document root. Before running one-shot probe, verify separately that 20i document root is `public_html` and there are no aliases to private storage; run only synthetic test after boundary review. No live releases or signer key provisioning.

## Private storage preliminary URL check — 2026-11-04

**User-provided screenshot:** An incognito visit to `https://miopages.org/miopages-private/` displayed the ordinary WordPress "Page not found" template, with no directory listing or files exposed. This is consistent with the sibling `miopages-private` directory (mode 0700) lying outside the web document root. **It is not a comprehensive HTTP isolation or alternate-vhost/alias/security audit.**

**Next bounded action authorized in chat:** Run exactly one one-shot synthetic filesystem probe in protected WP admin via Tools → MioPages Filesystem Probe (path guard and config already visibly armed); report descriptive results only. Probe tests one-host write/read, nonblocking lock, hard link, rename, and cleanup in randomly named temporary child. If any result FAIL or cleanup incomplete, stop and inspect; do not blindly repeat. This is still not approved release staging, central signing enrollment or public publication.

## Return path: full MioPages Commercial V1

The canonical roadmap remains [Platform/service architecture — Commercial V1 sequence](platform-service-architecture.md#commercial-v1-scope-and-development-sequence) and outstanding gates remain in [deferred architecture](deferred-architecture.md). There is **no second independent backlog**.

1. Hosted foundation: 20i + PostgreSQL + independent backup proof, C0/C1 routing, persistent media, restart/deploy/recovery, monitoring, scaling observations. **Active gate.**
2. Production authority: authenticated operator, scoped production operations and tenant boundaries.
3. Commercial intake and near-finished AI-assisted site generation from confirmed structured business knowledge, with operator QA, copy/SEO/media preparation.
4. Minimal customer portal, including onboarding, review/approval, status/reporting and supported HostShop handoff.
5. Safe authorized publication, Contact/leads and conversion delivery.
6. First-party measurement, Performance Snapshot, improvement proposals, approved release and remeasurement.
7. End-to-end Commercial V1 rehearsal.
8. Real MioPages C0, then Customer #1 after readiness gates.

The approved Free Review Draft D Revision 3 remains approved **but undelivered** according to the latest recovery record; it is not a go-live or publication authorization. The future WordPress deployment/plugin path is explicitly **post-V1**.

**Phase-exit rule:** when hosted foundation is accepted against its evidence, do not keep inventing infrastructure work. Open the canonical roadmap, record completed gates and move to the next applicable stage. Exceptions require explicit priority rationale and revised checkpoint.

## Sources, scope and maintenance

- [Architecture and Human/ChatGPT/Codex responsibility](platform-service-architecture.md)
- [Shared hostname routing](shared-hostname-routing.md)
- [Managed PostgreSQL recovery/role contract](managed-postgres-recovery.md)
- [C0 operator commands/IDs](miopages-c0-canonical-state.md)
- [Deferred architecture / actual open readiness gates](deferred-architecture.md)
- Historical detailed handoff: ignored local `runtime-content/chat-recovery.md`, user-uploaded on 2026-11-01. This file **was read in its actual latest form** during continuity repair. It is not fetched by Git and must not be assumed available in later chats. Git control now carries the critical current state/next-boundary facts.
- Live secrets/credentials/runtime config stay outside Git. The checked-in operations record must contain only nonsecret context.
- After review/merge, modify the README to link this as the **mandatory current-status entry point**, and correct any stale 'external provisioning has not begun' summary. Do not silently rewrite historical proofs; mark them historical.
- Before declaring this handoff reliable, test it from a separate read of GitHub `main`, checking the commit/status/next boundary/Commercial V1 route without local recovery-file access. Until merged and tested, **continuity fix remains incomplete**.
