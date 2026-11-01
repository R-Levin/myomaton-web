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
