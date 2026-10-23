# Myomaton Web

Website and first reference implementation of the reusable Myomaton web platform.

Current stack: Next.js, React, TypeScript, Tailwind CSS.

## Current checkpoint and authoritative records

Verified implementation baseline: `7bd79c02048e7537074463fc148122fc728dc7a1`,
**Add managed PostgreSQL compatibility and recovery**. Use `git rev-parse HEAD`
for the current source checkpoint; this baseline is not a claim about future HEADs.
Shared development is PostgreSQL 18.6 with migrations 0000–0015 applied (16, zero
pending). Local PG17/PG18 bootstrap and managed recovery are proven within their
documented bounds. This does not authorize production operation.

**100+ customer shared-runtime architecture is P0:** many hostnames → shared
runtime → immutable request-scoped tenant context → shared PostgreSQL → strict
isolation. C0/C1 same-process proof is implemented; hosted capacity is unproved.
External provisioning for the hosted proof has **not begun**.

- [Architecture, principles, decisions and Human/AI charter](docs/platform-service-architecture.md)
  own the current 20i Managed Cloud + Supabase prototype direction, assumptions and
  empty external-resource inventory. Providers remain replaceable candidates.
- [Service model](docs/web-presence-service-model.md) and
  [capabilities](docs/platform-capabilities.md) own product intent and scope.
- [Deferred register](docs/deferred-architecture.md) owns active requirements and triggers.
- [Shared routing](docs/shared-hostname-routing.md),
  [security](docs/security-operations.md), [readiness](docs/progressive-onboarding-and-launch-readiness.md),
  [local recovery](docs/backup-recovery.md) and [managed PostgreSQL recovery](docs/managed-postgres-recovery.md)
  own their specialist contracts. Local proof is distinct from hosted verification
  and production authorization.

Ignored `runtime-content/chat-recovery.md` holds machine-local next-step context;
Git/docs, database/media backups and protected secrets recovery remain separate.

## Local commands

```bash
npm run dev
npm run build
npm run lint
```

`npm run db:seed` initializes platform reference data only. For a new Myomaton
customer baseline, explicitly run `npm run bootstrap:myomaton` afterward.
Existing customer state is never synchronized or repaired by either command.
See [seed, customer bootstrap, and canonical state](docs/bootstrap.md).

The [media acquisition foundation and disposable image pilot](docs/media-acquisition.md)
documents private candidates, attributable review, operational migration rehearsal
and the narrow Hero eligibility gate. Real attachment and publication remain
separate review boundaries.

The [local operator QC harness](docs/operator-qc.md) prepares exact-context review
packets, proposed visual strategies and readiness assessments without customer
writes, image generation or publication authority.
