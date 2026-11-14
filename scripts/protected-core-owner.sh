#!/usr/bin/env bash
set +x
set -euo pipefail
umask 077
ulimit -c 0
home=$(realpath -- "$HOME")
dir="$home/miopages-protected-owner-access"
[[ "$home" == /home/virtual/vps-bef564/5/53b4381d42 && -t 0 && -t 1 && $# == 0 ]]
cd -- "$dir"
[[ "$(pwd -P)" == "$dir" && "$(stat -c '%a:%u' .)" == "700:$(id -u)" ]]
sha256sum -c SHA256SUMS >/dev/null
trap 'unset migration password confirm' EXIT
printf 'Create a unique password of at least 16 characters in your password manager and save it for https://wp-acceptance.miopages.com/core, username owner.\n' >/dev/tty
read -r -s -p 'New MioPages owner password: ' password </dev/tty
printf '\n' >/dev/tty
read -r -s -p 'Repeat MioPages owner password: ' confirm </dev/tty
printf '\n' >/dev/tty
if [[ -z "$password" || "$password" != "$confirm" || "${#password}" -lt 16 ]]; then
  printf 'BLOCKED: Passwords must match and have at least 16 characters.\n' >&2
  exit 1
fi
unset confirm
read -r -s -p 'Existing miopages_migration password: ' migration </dev/tty
printf '\n' >/dev/tty
[[ -n "$migration" ]]
printf '%s\n' "$migration" "$password" | env -i HOME="$home" PATH="$PATH" NODE_PATH="$home/miopages-wp-rehearsal/node_modules" node "$dir/set-owner.cjs" SET-PROTECTED-OWNER-PASSWORD
