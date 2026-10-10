# Myomaton Web

Website and first reference implementation of the reusable Myomaton web platform.

Current stack: Next.js, React, TypeScript, Tailwind CSS.

The project is in initial platform bring-up.

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
