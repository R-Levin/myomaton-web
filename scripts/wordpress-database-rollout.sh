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
prompt WP_DB_HOST 'Established Supabase Session Pooler hostname (no URL)'
prompt WP_DB_PROJECT 'Established Supabase project reference'
prompt MIOPAGES_WP_EXPECTED_DATABASE 'Verified database name'
prompt MIOPAGES_WP_PROVIDER_OWNER 'Authorized existing provider-owner role'
prompt MIOPAGES_WP_DATABASE_CA_FILE 'Existing trusted CA file' "$HOME/supabase-ca.crt"
prompt PG_BIN_DIR 'PostgreSQL 17 binary directory' "$HOME/.local/pgsql17/usr/pgsql-17/bin"
prompt MIOPAGES_WP_OBJECTS_ROOT 'Actual existing MANAGED_ASSET_ROOT (do not source runtime.env)'
prompt WP_DB_RUN_ROOT 'New private off-webroot run directory' "$HOME/miopages-wp-db-$(date -u +%Y%m%dT%H%M%SZ)"
printf 'Store ONLY the generated WordPress role URLs/passwords in %s/wordpress-role-credentials.json (directory 0700, file 0600).\n' "$WP_DB_RUN_ROOT"
read -r -p 'Approve this private local credential storage method by typing STORE: ' storage </dev/tty
[[ "$storage" == STORE ]] || { printf 'Storage not approved. Stopped.\n' >&2; exit 1; }
export WP_DB_STORAGE_APPROVAL=private-file-0600
password WP_DB_BACKUP_PASSWORD miopages_backup
password WP_DB_MIGRATION_PASSWORD miopages_migration
password WP_DB_PROVIDER_PASSWORD "$MIOPAGES_WP_PROVIDER_OWNER"
export NODE_EXTRA_CA_CERTS="$MIOPAGES_WP_DATABASE_CA_FILE"
export PGSSLROOTCERT="$MIOPAGES_WP_DATABASE_CA_FILE"
# The helper and its children load no shared environment files.
node --import tsx scripts/wordpress-database-rollout.ts
