#!/usr/bin/env bash
set +x
set -euo pipefail
umask 077
ulimit -c 0
home="$(realpath -- "$HOME")"
dir="$home/miopages-c0-stage-36f5dbff/guard-5b8e2c8"
[[ "$home" == /home/virtual/vps-bef564/5/53b4381d42 && -t 0 && -t 1 && $# == 0 ]]
cd -- "$dir"
[[ "$(pwd -P)" == "$dir" && "$(stat -c '%a:%u' .)" == "700:$(id -u)" ]]
sha256sum -c SHA256SUMS >/dev/null
trap 'unset migration' EXIT
IFS= read -r -s -p 'Existing miopages_migration password (blank stops): ' migration </dev/tty
printf '\n' >/dev/tty
[[ -n "$migration" ]]
printf '%s\n' "$migration" | env -i HOME="$home" PATH="$PATH" NODE_PATH="$home/miopages-wp-rehearsal/node_modules" /usr/bin/node "$dir/c0-visual-guard-migration.cjs" apply
