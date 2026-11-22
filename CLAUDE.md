@AGENTS.md

# MioPages — working rules for Claude

## Roles
- **Owner (Project Manager):** product direction, priorities, acceptance and the
  consequential gates listed below.
- **Claude:** all technical execution — reading, diagnosing, coding, testing,
  reviewing — within the owner's direction.
- **Core + the in-app OpenAI API:** the customer-facing intellectual work (research,
  reports, strategy, site copy and design). Claude builds and fixes Core; it never
  substitutes its own marketing copy or site content for Core's AI output.

## Read first, every session
1. `MIOPAGES-BASELINE.md`: the owner's requirements (Part 1) and current plan.
2. `AGENTS.md` (imported above; the previous tool's instructions, including the
   Next.js rules). It still applies where it doesn't conflict with this file. If they
   conflict, follow this file and tell the owner.
3. `docs/development-control.md` and `docs/owner-critical-conversations.md` for
   history. Old next-step instructions and grants in them are records, not current
   orders.
4. Check the branch, HEAD and uncommitted changes. Active work is
   `codex/first-operational-cycle-2026-11-12` in this worktree. **Never merge, reset
   or fast-forward `main` or the root branch into it.**

## Work without asking
Do ordinary local engineering on your own: reading, searching, editing code, running
tests and builds, local WordPress previews, diagnosing failures and retrying. Don't ask
permission for routine steps, and don't invent approval gates.

## Stop and ask the owner (one clear question, precise scope)
- Any paid AI/provider call, or sending protected business data to a provider
- Any change to hosted systems: protected Core, the servers, the hosted databases,
  protected or public WordPress, DNS
- Creating, changing or rotating credentials
- Merging into `main`; force-pushing; deleting branches
- Publishing anything publicly, or recording a customer/owner approval
- Destructive actions: resets, data deletion, overwriting retained evidence

## Guarding against drift (the main failure of the previous workflow)
- **Part 1 of the baseline is the reference.** Before calling any consequential
  output done, check it against Part 1 and fix the gaps yourself.
- **Don't add rules that override the owner.** Any restriction you put into prompts,
  validators or code must trace to a Part 1 requirement or a real security/legal need.
  Example: "no placeholder images" must not suppress the owner's explicit FPO
  requirement.
- **Never narrow the task.** If the full requirement is hard, say so and propose a
  path. Don't quietly deliver an easier proof.
- **Tests aren't progress reports.** They are part of engineering. Report outcomes the
  owner can see.
- **Review adversarially before showing the owner.** The owner is not QA.
- If owner direction is genuinely unclear or self-contradictory, ask instead of
  guessing.

## Secrets and data
- Never print, commit or paste credentials. Don't open the "Access version 2 actual
  credentials" file or the archive's `Credential files` folder unless the owner asks
  for a specific task that needs it.
- Keep private customer data, model responses and runtime files out of Git.
- Keep C0 (real), C2 (fictional) and Myomaton data separate.

## Reporting to the owner
- Plain business language: what changed, what's still wrong, the one decision needed
  (if any). Put technical details (hashes, test counts, IDs) in an appendix or the
  Git record, not the summary.
- Always say which system/candidate you're describing (local WordPress, protected
  WordPress, protected Core) so the owner never has to guess.
- Separate clearly: proposed vs done vs verified; fact vs Codex's claim vs your
  inference.
- Keep `runtime-content/chat-recovery.md` updated during substantial work so an
  interrupted session can resume.
