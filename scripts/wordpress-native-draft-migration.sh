#!/usr/bin/env bash
# Run only in the authenticated Cloud rehearsal shell.
set +x
set -euo pipefail
umask 077
ulimit -c 0
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
[[ -t 0 && -t 1 && "$(pwd -P)" == /home/virtual/vps-bef564/5/53b4381d42/miopages-wp-rehearsal ]] || exit 1
[[ $# == 1 && ( "$1" == APPLY-0018-NATIVE-DRAFT || "$1" == APPLY-0019-AND-ENROLL-NATIVE-DRAFT ) ]] || exit 1
git diff --quiet HEAD -- scripts lib/platform
trap 'unset WP_REHEARSAL_MIGRATION_PASSWORD' EXIT
read -r -s -p 'Existing miopages_migration password (blank stops): ' WP_REHEARSAL_MIGRATION_PASSWORD </dev/tty
printf '\n' >/dev/tty
[[ -n "$WP_REHEARSAL_MIGRATION_PASSWORD" ]] || exit 1
export WP_REHEARSAL_MIGRATION_PASSWORD
while IFS= read -r name; do
  case "$name" in HOME|PATH|LANG|WP_REHEARSAL_MIGRATION_PASSWORD) ;; *) unset "$name" ;; esac
done < <(compgen -e)
node - "$1" <<'NODE'
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
try {
  const home = fs.realpathSync(process.env.HOME);
  const file = path.join(home, "miopages-wp-db-20261105T181534Z", "wordpress-role-credentials.json");
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || (stat.mode & 511) !== 384 || stat.uid !== process.getuid() || fs.realpathSync(file) !== file) throw Error();
  const url = new URL(JSON.parse(fs.readFileSync(file, "utf8")).operator.url);
  if (url.protocol !== "postgresql:" || url.hostname !== "aws-0-us-east-1.pooler.supabase.com" ||
      url.port !== "5432" || url.pathname !== "/postgres" || url.searchParams.get("sslmode") !== "verify-full" ||
      !/^miopages_wp_operator\.[a-z0-9]+$/.test(url.username)) throw Error();
  url.username = url.username.replace(/^miopages_wp_operator\./, "miopages_migration.");
  url.password = encodeURIComponent(process.env.WP_REHEARSAL_MIGRATION_PASSWORD);
  delete process.env.WP_REHEARSAL_MIGRATION_PASSWORD;
  const ca = fs.readFileSync(path.join(home, "supabase-ca.crt"), "utf8");
  const enroll = process.argv[2] === "APPLY-0019-AND-ENROLL-NATIVE-DRAFT";
  const steps = enroll ? ["apply-active-installation-origin", "verify-active-installation-origin", "enroll"]
    : ["apply-native-draft-stage", "verify-native-draft-stage"];
  for (const action of steps) {
    const result = spawnSync(process.execPath, ["--import", "tsx", action === "enroll"
      ? "scripts/wordpress-enroll-native-draft.ts" : "scripts/db/wordpress-private-stage.ts"], {
      env: { HOME: home, PATH: process.env.PATH, MIOPAGES_WP_SCHEMA_ACTION: action, MIOPAGES_WP_EXPECTED_DATABASE: "postgres",
        MIOPAGES_WP_MIGRATION_URL: url.toString(), MIOPAGES_WP_DATABASE_CA: ca }, encoding: "utf8", timeout: 60000,
    });
    const report = JSON.parse((result.status === 0 ? result.stdout : result.stderr).trim());
    if (result.status !== 0) {
      console.error(JSON.stringify({ status: "BLOCKED", operation: action, stage: report.stage, code: report.code, directory: report.directory }));
      process.exit(1);
    }
    if (action === "enroll") {
      if (report.status !== "PASS") throw Error();
      console.log(JSON.stringify(report));
      continue;
    }
    const count = enroll ? 4 : 3;
    if (report.verified !== true || report.privateStageMigrations !== count ||
        (action.startsWith("verify") && (!report.readOnly || !report.checksumsVerified || !report.grantsVerified))) throw Error();
    console.log(JSON.stringify({ status: "PASS", operation: action, privateStageMigrations: count }));
  }
} catch {
  console.error("BLOCKED: native draft migration prerequisites or result could not be verified.");
  process.exitCode = 1;
}
NODE
