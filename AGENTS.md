## MioPages development recovery

Read `docs/development-control.md` and the existing local
`runtime-content/chat-recovery.md` before substantive work. Verify the active
branch/worktree and latest owner decisions; an older root checkout or `main`
is not the latest implementation checkpoint. Preserve uncommitted work.
Update the local note during material work, before a Git checkpoint or
interruption, with decisions, progress, failures, pending operations and the next
safe action. Keep credentials and protected customer text out of recovery notes.
Use the canonical service contracts for product direction; C0 tests and temporary
launch arrangements do not redefine the complete growth service. Reuse suitable
existing components throughout development. These rules grant no external authority.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
