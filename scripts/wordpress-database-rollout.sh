#!/usr/bin/env bash
# Run as a child shell, never source this file. No runtime.env or .env loading.
set +x
set -euo pipefail
umask 077
ulimit -c 0
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
[[ -t 0 && -t 1 ]] || { printf 'Use the existing authenticated interactive Cloud shell.\n' >&2; exit 1; }
[[ "$(pwd -P)" == /home/virtual/vps-bef564/5/53b4381d42/miopages-wp-rehearsal ]] || {
  printf 'Refused: use the separate reviewed Cloud rehearsal worktree.\n' >&2; exit 1;
}
cleanup() {
  unset WP_DB_BACKUP_PASSWORD WP_DB_MIGRATION_PASSWORD WP_DB_PROVIDER_PASSWORD
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM HUP
prompt() {
  local name="$1" label="$2" fallback="${3:-}"
  read -r -p "$label${fallback:+ [$fallback]}: " "$name" </dev/tty || exit 1
  [[ -n "${!name}" ]] || printf -v "$name" '%s' "$fallback"
  [[ -n "${!name}" ]] || { printf 'Required setting missing: %s\n' "$name" >&2; exit 1; }
  export "$name"
}
password() {
  local name="$1" role="$2"
  read -r -s -p "Existing $role password (blank stops): " "$name" </dev/tty || exit 1
  printf '\n' >/dev/tty
  [[ -n "${!name}" ]] || { printf 'BLOCKED: existing %s password unavailable. No guessing, rotation or provisioning.\n' "$role" >&2; exit 1; }
  export "$name"
}
prompt WP_DB_MODE 'Operation: all (recover then setup), recover, or setup (resume)' all
[[ "$WP_DB_MODE" == all || "$WP_DB_MODE" == recover || "$WP_DB_MODE" == setup ]] || exit 1
prompt WP_DB_HOST 'Established Supabase Session Pooler hostname (no URL)'
prompt WP_DB_PROJECT 'Established Supabase project reference'
prompt MIOPAGES_WP_EXPECTED_DATABASE 'Verified database name'
prompt MIOPAGES_WP_DATABASE_CA_FILE 'Existing trusted CA file' "$HOME/supabase-ca.crt"
export NODE_EXTRA_CA_CERTS="$MIOPAGES_WP_DATABASE_CA_FILE"
export PGSSLROOTCERT="$MIOPAGES_WP_DATABASE_CA_FILE"
if [[ "$WP_DB_MODE" != setup ]]; then
  prompt PG_BIN_DIR 'PostgreSQL 17 binary directory' "$HOME/.local/pgsql17/usr/pgsql-17/bin"
  prompt MIOPAGES_WP_OBJECTS_ROOT 'Actual existing MANAGED_ASSET_ROOT (do not source runtime.env)'
  prompt WP_DB_RUN_ROOT 'New private off-webroot recovery run directory' "$HOME/miopages-wp-db-$(date -u +%Y%m%dT%H%M%SZ)"
  password WP_DB_BACKUP_PASSWORD 'miopages_backup: existing MioPages backup-role'
  WP_DB_ACTION=recover node --import tsx scripts/wordpress-database-rollout.ts
  unset WP_DB_BACKUP_PASSWORD
  printf 'Verified recovery checkpoint retained at %s\n' "$WP_DB_RUN_ROOT"
  [[ "$WP_DB_MODE" != recover ]] || exit 0
else
  prompt WP_DB_RUN_ROOT 'Existing verified recovery run directory (not its recovery child)'
fi
# Verify the saved checkpoint without database credentials before prompting for setup.
WP_DB_ACTION=verify-recovery node --import tsx scripts/wordpress-database-rollout.ts
printf 'Setup can be resumed later with operation setup and this same directory.\n'
printf 'Store ONLY generated WordPress role credentials in %s/wordpress-role-credentials.json (directory 0700, file 0600).\n' "$WP_DB_RUN_ROOT"
read -r -p 'Approve this private local credential storage method by typing STORE: ' storage </dev/tty
[[ "$storage" == STORE ]] || { printf 'Storage not approved. Verified recovery retained.\n' >&2; exit 1; }
export WP_DB_STORAGE_APPROVAL=private-file-0600
password WP_DB_MIGRATION_PASSWORD 'miopages_migration: existing MioPages migration-role'
WP_DB_ACTION=check-migration node --import tsx scripts/wordpress-database-rollout.ts
password WP_DB_PROVIDER_PASSWORD 'postgres: ORIGINAL Supabase project database administrator, separate from dedicated MioPages roles'
export MIOPAGES_WP_PROVIDER_OWNER=postgres
WP_DB_ACTION=setup node --import tsx scripts/wordpress-database-rollout.ts
