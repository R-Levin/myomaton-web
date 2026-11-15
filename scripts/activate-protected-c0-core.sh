#!/usr/bin/env bash
set +x
set -euo pipefail
umask 077
home="$(realpath -- "$HOME")"
[[ "$home" == /home/virtual/vps-bef564/e/e494602172 && $# == 1 && "$1" == APPLY-EXACT-PROTECTED-C0-CORE ]]
root="$home/miopages-private-acceptance"
run="$root/hosted-c0-3bf0209a"
web="$home/public_html"
candidate="$run/candidate"
previous="$run/previous-runtime-740e3c1"
grant="$root/presence-workflow-grant.json"
manifest="$root/c0-hosted-presence-run.json"
digest=3bf0209a1bdabfc80e2b6f783b5365039c08bbeebb000db7d6de1c5eab7d9bc4
export PM2_HOME="$home/.pm2"
cli="$run/pm2-client/node_modules/pm2/bin/pm2"
[[ -f "$cli" && -O "$PM2_HOME/rpc.sock" && -S "$PM2_HOME/rpc.sock" ]]
kill -0 "$(cat "$PM2_HOME/pm2.pid")"
for dir in "$root" "$run" "$web" "$candidate"; do
  [[ -O "$dir" && "$(realpath -- "$dir")" == "$dir" && "$(stat -c %a "$dir")" == 700 ]]
done
[[ ! -e "$previous" && ! -e "$grant" && -O "$manifest" && ! -L "$manifest" && "$(stat -c %a "$manifest")" == 600 ]]
[[ "$(sha256sum "$manifest" | cut -d' ' -f1)" == "$digest" ]]
[[ "$(stat -c '%d' "$web")" == "$(stat -c '%d' "$candidate")" ]]
[[ "$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo)" -ge 524288 ]]
pm2() { /usr/bin/node "$cli" "$@"; }

verify_process() {
  pm2 jlist | /usr/bin/node -e '
    const assert = require("node:assert/strict"), fs = require("node:fs");
    const [web, state] = process.argv.slice(1);
    const records = JSON.parse(fs.readFileSync(0, "utf8"));
    assert.equal(records.length, 1);
    const app = records[0], env = app.pm2_env;
    assert.equal(app.pm_id, 0);
    assert.equal(app.name, "miopages-protected-core");
    assert.equal(env.status, state);
    assert.equal(env.pm_cwd, web);
    assert.equal(env.pm_exec_path, web + "/.rehearsal/private-listener.cjs");
    assert.ok(state === "online" ? app.pid > 1 : app.pid === 0);
  ' "$web" "$1"
}

verify_files() {
  python3 -B - "$1" "$2" <<'PYTHON'
import hashlib, json, os, pathlib, sys
root = pathlib.Path(sys.argv[1])
build = json.loads((root / 'rehearsal-build.json').read_bytes())
assert build['sourceCommit'] == sys.argv[2] and build['isolatedRuntimeSmoke'] == 'PASS'
for filename, digest in build['files'].items():
    path = root / filename
    assert path.is_file() and path.resolve() == path and hashlib.sha256(path.read_bytes()).hexdigest() == digest
for filename, target in build['symlinks'].items():
    assert os.readlink(root / filename) == target
PYTHON
}

public_digest() {
  curl -fsS --max-time 12 --proto '=https' 'https://runtime.miopages.com/' | sha256sum | cut -d' ' -f1
  curl -fsS --max-time 12 --proto '=https' 'https://miopages.com/' | sha256sum | cut -d' ' -f1
}

probe_core() {
  [[ "$(curl -sS --max-time 6 --proto '=https' -o /dev/null -w '%{http_code}' 'https://wp-acceptance.miopages.com/core')" == 200 ]] &&
  [[ "$(curl -sS --max-time 6 --proto '=https' -H 'X-Intake-Request: 1' -o /dev/null -w '%{http_code}' 'https://wp-acceptance.miopages.com/api/protected-core')" == 401 ]]
}

verify_process online
verify_files "$web" 740e3c1d983aa442d53ee45ecb0f5c8a90755a9d
verify_files "$candidate" eb2518f61bd4dfa0ba5cd460057a4e713a5c24f6
cmp -s "$web/package-lock.json" "$candidate/package-lock.json"
cmp -s "$web/.env" "$candidate/.env"
cmp -s "$web/ecosystem.config.js" "$candidate/ecosystem.config.js"
before="$(public_digest)"
[[ $(wc -l <<<"$before") == 2 ]]
phase=stop
previous_saved=false
candidate_active=false
lock="$run/deployment-lock"
mkdir -m 700 -- "$lock"
rollback() {
  local result=$?
  trap - EXIT
  if [[ "$result" -eq 0 ]]; then
    rmdir -- "$lock"
    return
  fi
  printf 'Protected Core swap stopped at %s. Checking restoration.\n' "$phase" >&2
  if [[ "$candidate_active" == true ]]; then
    pm2 stop 0 >/dev/null
    verify_process stopped
    if [[ -e "$grant" ]]; then mv -T -- "$grant" "$run/unused-grant-after-rollback.json"; fi
    mv -T -- "$web" "$run/candidate-failed"
  fi
  if [[ "$previous_saved" == true ]]; then mv -T -- "$previous" "$web"; fi
  verify_files "$web" 740e3c1d983aa442d53ee45ecb0f5c8a90755a9d
  if ! verify_process online; then pm2 restart 0 >/dev/null; fi
  for attempt in {1..20}; do
    if probe_core; then
      [[ "$(public_digest)" == "$before" ]]
      rmdir -- "$lock"
      printf 'Verified original protected Core restored\n' >&2
      exit "$result"
    fi
    sleep 1
  done
  printf 'Original application was returned to its path. Online recovery remains unverified.\n' >&2
  exit 1
}
trap rollback EXIT

pm2 stop 0 >/dev/null
verify_process stopped
phase=preserve-previous
mv -T -- "$web" "$previous"
previous_saved=true
phase=install-candidate
mv -T -- "$candidate" "$web"
candidate_active=true
phase=exact-grant
(cd "$web" && /usr/bin/node .rehearsal/private-listener.cjs --workflow ACTIVATE-EXACT-WORKFLOW-GRANT "$digest")
phase=protected-service
pm2 restart 0 >/dev/null
for attempt in {1..20}; do
  if probe_core; then
    verify_process online
    verify_files "$web" eb2518f61bd4dfa0ba5cd460057a4e713a5c24f6
    [[ "$(public_digest)" == "$before" ]]
    printf '{"status":"PASS","operation":"activate-protected-c0-core","sourceCommit":"eb2518f61bd4dfa0ba5cd460057a4e713a5c24f6","previousRuntimeRetained":true,"anonymousApiRefused":true,"publicRootsMatched":true}\n'
    exit 0
  fi
  sleep 1
done
exit 1
