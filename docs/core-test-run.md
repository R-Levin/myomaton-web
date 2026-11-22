# First rebuilt-Core test run: procedure

Plan: `docs/c0-rebuilt-run.json` (new case beb8de9c-…, $25 ceiling, generous counters).
Approvals needed from the owner before step 1: deploy to protected Core, and the $25
ceiling. Paid steps are marked **$**. Everything else is free.

## 1. Deploy the current Core (hosted change)
1. Take the CI artifact `protected-core-linux-x64` built from the branch head
   (`.tar.gz` + `.sha256`).
2. Upload both plus `scripts/deploy/core-update.py` to `~/miopages-private-acceptance/`.
3. Run `python3 core-update.py install <archive> <commit>`. It verifies every file, keeps
   the installed libraries, moves the current app to `app-before-…`, restarts once and
   checks `/core`.
4. If anything is wrong: `python3 core-update.py rollback app-before-…`.

## 2. Create the case (free)
From `~/public_html`, with `NODE_ENV=development`:
1. `node .rehearsal/rebuilt-evaluation-worker.cjs prepare-database`
2. `node .rehearsal/rebuilt-evaluation-worker.cjs activate`: builds the context and grant
   from the previous case's knowledge, starts a fresh spending ledger, and copies the
   original materials into the new case.
3. `node .rehearsal/rebuilt-evaluation-worker.cjs preflight`

## 3. Run Core (**$**)
From this computer: `npx tsx scripts/intake/presence-research-controller.ts --rebuilt work`.
The server runs research. Peer pages are captured in the local browser through the SSH
link. Then the report. The owner chose not to stop at the report for this test, so it is
followed by `continue` and `work` again: Direction with design → plan → all pages. The
run pauses when the pages need a rendered critique.

## 4. First look (free)
1. Server: `local-site` (exports the packet), `editorial-review-input`, then
   `MIOPAGES_RUN=rebuilt node .rehearsal/rendered-review.cjs intent site <version> <digest>`.
2. Download the packet and its receipt/intent into
   `runtime-content/p022-wp-validation/source-aware-incoming/`.
3. Locally: `MIOPAGES_RUN=rebuilt php scripts/intake/source-aware-local-wordpress.php <p022 root> site-<version>.json`
   (with the SQLite PHP extension flags).
4. The owner reviews on local WordPress, http://127.0.0.1:4474.

## 5. Critique and revise (**$**, up to two rounds)
1. Capture the rendered pages locally (`source-aware-local-capture.ts`) and upload them
   as `capture-upload-<version>`.
2. `rendered-review.cjs store …`, then `critique-site`, `revise-site`, `work`.
3. Export and look again (step 4).

Spending is read from the case ledger after every paid step and reported in plain terms.
