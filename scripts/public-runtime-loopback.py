"""One authorized, bounded GET-only comparison. Never deploy or control PM2."""
import argparse
import hashlib
import http.client
import importlib.util
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import threading
import time
import urllib.error
import urllib.request

spec = importlib.util.spec_from_file_location("public_rollout_helpers", Path(__file__).with_name("public-runtime-rollout.py"))
r = importlib.util.module_from_spec(spec)
spec.loader.exec_module(r)

ARTIFACT_SHA = "24e0bff248ae1ff377c253925a91b84cebc1138b46fd11faaec9cc01a1f3ee08"
ROUTES = ("/", "/service", "/experience", "/review", "/api/intake", "/api/contact", "/media/assets/invalid")
MAX_RSS = 384 * 1024 * 1024
MIN_AVAILABLE = 512 * 1024 * 1024
MAX_SECONDS = 120
WATCHDOG_SECONDS = 115  # Five seconds reserved for cleanup before the ceiling.


class Gate(Exception):
    def __init__(self, code):
        self.code = code


def require(value, code):
    if not value:
        raise Gate(code)


def memory_available():
    match = re.search(r"^MemAvailable:\s+(\d+) kB$", Path("/proc/meminfo").read_text(), re.M)
    require(match is not None, "MEMORY_METRIC_UNAVAILABLE")
    return int(match[1]) * 1024


def resource_failure(rss, available, elapsed):
    if rss > MAX_RSS:
        return "RSS_LIMIT"
    if available < MIN_AVAILABLE:
        return "MEMORY_FLOOR"
    if elapsed >= WATCHDOG_SECONDS:
        return "DEADLINE"
    return None


def group_members(group):
    members = {}
    for path in Path("/proc").iterdir():
        if not path.name.isdigit():
            continue
        try:
            if path.stat().st_uid != os.getuid():
                continue
            fields = (path / "stat").read_text().rsplit(")", 1)[1].split()
            if int(fields[2]) != group or int(fields[3]) != group:
                continue
            status = (path / "status").read_text()
            rss = re.search(r"^VmRSS:\s+(\d+) kB$", status, re.M)
            members[int(path.name)] = {"startTicks": fields[19], "rss": int(rss[1]) * 1024 if rss else 0}
        except (FileNotFoundError, ProcessLookupError, PermissionError):
            pass
    return members


def terminate_group(group, sig):
    # SID and PGID must both be the new session created by this launcher.
    if group_members(group):
        try:
            os.killpg(group, sig)
        except ProcessLookupError:
            pass


def listener():
    return r.command(["ss", "-H", "-ltnp", "sport = :8081"]).decode().strip()


def check_binding(output, owned):
    rows = output.splitlines()
    require(len(rows) == 1 and len(rows[0].split()) >= 5, "LISTENER_COUNT_REFUSED")
    require(rows[0].split()[3] == "127.0.0.1:8081", "NON_LOOPBACK_BINDING_REFUSED")
    pids = {int(value) for value in re.findall(r"pid=(\d+)", output)}
    require(pids and pids.issubset(set(owned)), "LISTENER_PROCESS_IDENTITY_REFUSED")


def observe(root, host, route, transport, label):
    require(host in r.HOSTS and route in ROUTES, "REQUEST_SCOPE_REFUSED")
    headers = {"User-Agent": "MioPages-approved-security-check/1", "Cache-Control": "no-cache"}
    if transport == "https":
        request = urllib.request.Request("https://" + host + route, headers=headers, method="GET")
        try:
            result = urllib.request.build_opener(r.NoRedirect()).open(request, timeout=5)
        except urllib.error.HTTPError as error:
            result = error
        with result:
            status, body = result.code, result.read(4 * 1024 * 1024 + 1)
    else:
        require(transport == "loopback", "TRANSPORT_REFUSED")
        connection = http.client.HTTPConnection("127.0.0.1", 8081, timeout=5)
        try:
            connection.request("GET", route, headers={**headers, "Host": host, "X-Forwarded-Proto": "https"})
            result = connection.getresponse()
            status, body = result.status, result.read(4 * 1024 * 1024 + 1)
        finally:
            connection.close()
    require(len(body) <= 4 * 1024 * 1024, "RESPONSE_SIZE_REFUSED")
    # Bodies/logs stay in private storage, never in printed or Git evidence.
    body_path = root / (label + ".body")
    with open(body_path, "xb") as output:
        output.write(body)
    parser = r.Content()
    if status == 200:
        parser.feed(body.decode("utf-8"))
    value = {"status": status, "bytes": len(body), "sha256": hashlib.sha256(body).hexdigest(),
             "content": parser.tokens, "links": sorted(parser.links)}
    r.save(root / (label + ".json"), value)
    return value


def differences(before, after):
    """Exact token positions and digests; no arbitrary response strings emitted."""
    result = []
    for field in ("status", "links", "content"):
        if before[field] == after[field]:
            continue
        item = {"field": field, "beforeDigest": r.canonical(before[field]), "afterDigest": r.canonical(after[field])}
        if field == "status":
            item.update(before=before[field], after=after[field])
        else:
            old, new = before[field], after[field]
            item.update(beforeCount=len(old), afterCount=len(new))
            item["positions"] = [{"index": i,
                                  "beforeDigest": r.canonical(old[i]) if i < len(old) else None,
                                  "afterDigest": r.canonical(new[i]) if i < len(new) else None}
                                 for i in range(max(len(old), len(new)))
                                 if i >= len(old) or i >= len(new) or old[i] != new[i]]
        result.append(item)
    return result


def live_identity(cli):
    web = r.ACCOUNT / "public_html"
    head = r.command(["git", "rev-parse", "HEAD"], web).decode().strip()
    require(head == r.PREVIOUS, "LIVE_SOURCE_IDENTITY_CHANGED")
    require(not r.command(["git", "--no-optional-locks", "status", "--porcelain", "--untracked-files=no"], web), "LIVE_TRACKED_CHANGES")
    process = r.app(cli)
    require(process["status"] == "online", "LIVE_APPLICATION_NOT_ONLINE")
    tree = r.tree(r.backup_roots(web))
    selected = {key: value for key, value in tree.items() if key != "public_html/.git" and not key.startswith("public_html/.git/")}
    return {"sourceCommit": head, "process": {k: process[k] for k in ("name", "id", "pid", "status", "restarts")},
            "entries": len(selected), "treeDigest": r.canonical(selected), "protectedDigest": r.canonical(r.protected_tree(web))}


def run(root):
    root, web = r.state_paths(root)
    require(not (root / "loopback-evidence.json").exists(), "EXISTING_DIAGNOSTIC_EVIDENCE")
    evidence = {"status": "BLOCKED", "sourceCommit": r.APPROVED, "artifactSha256": ARTIFACT_SHA,
                "port": "127.0.0.1:8081", "maximumSeconds": MAX_SECONDS, "watchdogSeconds": WATCHDOG_SECONDS,
                "heapMiB": 256, "rssLimitBytes": MAX_RSS, "minimumAvailableBytes": MIN_AVAILABLE,
                "comparisons": [], "cleanup": {"processGone": False, "portUnused": False},
                "publicApplicationControlled": False, "databaseWrites": 0, "registrationChanges": 0}
    process = None
    monitor = None
    monitor_stop = threading.Event()
    metrics = {"peakRssBytes": 0, "minimumAvailableBytes": None, "seenPids": set(), "failure": None}
    started = None
    before = None
    failure = None
    cli = r.pm2_cli()  # Read-only jlist; this tool never sends lifecycle commands.
    try:
        r.checkpoint("loopback_artifact_and_live_preflight")
        require(not listener(), "PORT_8081_ALREADY_OCCUPIED")
        require(memory_available() >= MIN_AVAILABLE, "MEMORY_FLOOR_REFUSED")
        before = live_identity(cli)
        archive = root / "public-security-62439fc-linux-x64.tar.gz"
        require(r.file_sha(archive) == ARTIFACT_SHA, "ARTIFACT_CHECKSUM_REFUSED")
        manifest = json.loads((root / "public-security-build.json").read_text())
        require(manifest["sourceCommit"] == r.APPROVED and manifest["bundler"] == "webpack" and manifest["versions"] == r.VERSIONS, "ARTIFACT_IDENTITY_REFUSED")
        require(manifest["packagedRuntimeSmoke"] == "PASS" and manifest["nativeProbe"] == "PASS", "ARTIFACT_BUILD_GATES_REFUSED")
        r.verify_archive(archive, manifest)
        candidate = root / "candidate"
        candidate.mkdir(mode=0o700)
        r.command(["tar", "--extract", "--gzip", "--file", str(archive), "--directory", str(candidate), "--no-same-owner"])
        r.installed(candidate, manifest)
        require((candidate / ".next/server/webpack-runtime.js").is_file(), "WEBPACK_RUNTIME_REQUIRED")
        for row in filter(None, r.command(["git", "ls-tree", "-rz", r.APPROVED], web).split(b"\0")):
            metadata, name = row.split(b"\t", 1)
            body = (candidate / name.decode()).read_bytes()
            require(hashlib.sha1(b"blob " + str(len(body)).encode() + b"\0" + body).hexdigest() == metadata.split()[2].decode(), "APPROVED_SOURCE_BLOB_MISMATCH")
        require(not (candidate / "app/api/wordpress-delivery").exists() and not (candidate / "proxy.ts").exists(), "UNAPPROVED_APPLICATION_CODE")
        r.checkpoint("unchanged_https_baselines")
        baseline = {}
        for host in r.HOSTS:
            baseline[host] = {}
            for index, route in enumerate(ROUTES):
                first = observe(root, host, route, "https", host + "-before-" + str(index) + "-1")
                second = observe(root, host, route, "https", host + "-before-" + str(index) + "-2")
                require(first == second, "LIVE_BASELINE_UNSTABLE")
                require(first["status"] == (503 if route == "/api/intake" else 405 if route == "/api/contact" else 404 if route == "/media/assets/invalid" else 200), "LIVE_BASELINE_STATUS_REFUSED")
                baseline[host][route] = first
        r.save(root / "https-before.json", baseline)
        require(not listener() and memory_available() >= MIN_AVAILABLE, "PRE_START_RESOURCE_GATE")

        # The existing credential file is sourced only by this temporary child.
        launch = 'set -euo pipefail; set -a; source "$HOME/.config/miopages/runtime.env"; set +a; export NODE_ENV=production NEXT_TELEMETRY_DISABLED=1; exec /usr/bin/node --max-old-space-size=256 "$1/node_modules/next/dist/bin/next" start "$1" --hostname 127.0.0.1 --port 8081'
        r.checkpoint("bounded_loopback_process_start")
        started = time.monotonic()
        log = open(root / "candidate-process.private.log", "xb", buffering=0)
        try:
            process = subprocess.Popen(["/usr/bin/timeout", "--signal=KILL", str(WATCHDOG_SECONDS) + "s", "/bin/bash", "-c", launch, "miopages-loopback-diagnostic", str(candidate)],
                                       cwd=candidate, stdin=subprocess.DEVNULL, stdout=log, stderr=log, start_new_session=True,
                                       env={"HOME": str(r.ACCOUNT), "PATH": "/usr/local/bin:/usr/bin:/bin", "LANG": "C.UTF-8"})
        finally:
            log.close()
        group = process.pid
        evidence["processGroup"] = group

        def watch():
            while not monitor_stop.wait(0.1):
                try:
                    members = group_members(group)
                    metrics["seenPids"].update(members)
                    rss = sum(item["rss"] for item in members.values())
                    available = memory_available()
                    metrics["peakRssBytes"] = max(metrics["peakRssBytes"], rss)
                    metrics["minimumAvailableBytes"] = available if metrics["minimumAvailableBytes"] is None else min(metrics["minimumAvailableBytes"], available)
                    code = resource_failure(rss, available, time.monotonic() - started)
                    if code:
                        metrics["failure"] = code
                        terminate_group(group, signal.SIGKILL)
                        return
                except BaseException:
                    metrics["failure"] = "RESOURCE_MONITOR_FAILED"
                    terminate_group(group, signal.SIGKILL)
                    return
        monitor = threading.Thread(target=watch, daemon=True)
        monitor.start()
        for _ in range(150):
            require(metrics["failure"] is None and process.poll() is None, metrics["failure"] or "CANDIDATE_EXITED")
            output = listener()
            if output:
                check_binding(output, group_members(group))
                break
            time.sleep(0.1)
        else:
            raise Gate("LISTENER_START_TIMEOUT")
        r.checkpoint("hostname_get_comparison")
        for host in r.HOSTS:
            for index, route in enumerate(ROUTES):
                require(metrics["failure"] is None, metrics["failure"] or "RESOURCE_GATE")
                first = observe(root, host, route, "loopback", host + "-candidate-" + str(index) + "-1")
                delta = differences(baseline[host][route], first)
                comparison = {"host": host, "route": route, "liveStatus": baseline[host][route]["status"], "candidateStatus": first["status"],
                              "liveSha256": baseline[host][route]["sha256"], "candidateSha256": first["sha256"], "candidateSecondSha256": None,
                              "normalizedMatch": not delta, "candidateRawStable": None, "differences": delta, "pairDifferences": None}
                evidence["comparisons"].append(comparison)
                r.save(root / "loopback-observations.json", evidence)
                require(not delta, "PUBLIC_RESPONSE_MISMATCH")
                require(metrics["failure"] is None, metrics["failure"] or "RESOURCE_GATE")
                second = observe(root, host, route, "loopback", host + "-candidate-" + str(index) + "-2")
                pair_delta = differences(first, second)
                comparison.update(candidateSecondSha256=second["sha256"], candidateRawStable=first == second, pairDifferences=pair_delta)
                r.save(root / "loopback-observations.json", evidence)
                require(not pair_delta and first == second, "CANDIDATE_RESPONSE_UNSTABLE")
                require(metrics["failure"] is None, metrics["failure"] or "RESOURCE_GATE")
        evidence["status"] = "PASS"
    except BaseException as error:
        failure = {"stage": r.STAGE, "code": error.code if isinstance(error, Gate) else "DIAGNOSTIC_VALIDATION_FAILED", "category": type(error).__name__}
    finally:
        if process is not None:
            terminate_group(process.pid, signal.SIGTERM)
            deadline = time.monotonic() + 1
            while group_members(process.pid) and time.monotonic() < deadline:
                time.sleep(0.05)
            terminate_group(process.pid, signal.SIGKILL)
            process.wait(timeout=3)
            monitor_stop.set()
            if monitor:
                monitor.join(timeout=2)
            evidence["listenerProcessSeconds"] = round(time.monotonic() - started, 3)
            evidence["cleanup"]["processGone"] = not group_members(process.pid)
            if metrics["failure"] and failure is None:
                failure = {"stage": "resource_monitor", "code": metrics["failure"], "category": "Gate"}
            if evidence["listenerProcessSeconds"] > MAX_SECONDS:
                failure = {"stage": "cleanup", "code": "DEADLINE_EXCEEDED", "category": "Gate"}
        else:
            evidence["cleanup"]["processGone"] = True
        evidence["cleanup"]["portUnused"] = not listener()
        try:
            r.checkpoint("diagnostic_cleanup_and_live_invariants")
            require(evidence["cleanup"]["processGone"] and evidence["cleanup"]["portUnused"], "CLEANUP_FAILED")
            after = live_identity(cli)
            require(before is not None and before == after, "LIVE_IDENTITY_OR_FILES_CHANGED")
            evidence["liveUnchanged"] = {"process": after["process"], "sourceCommit": after["sourceCommit"], "entries": after["entries"], "treeDigest": after["treeDigest"], "protectedDigest": after["protectedDigest"]}
            if before is not None and (root / "https-before.json").exists():
                roots = {}
                for host in r.HOSTS:
                    actual = observe(root, host, "/", "https", host + "-after")
                    expected = baseline[host]["/"]
                    require(actual == expected, "LIVE_HTTPS_ROOT_CHANGED")
                    roots[host] = {"status": actual["status"], "sha256": actual["sha256"]}
                evidence["liveUnchanged"]["httpsRoots"] = roots
        except BaseException as error:
            failure = {"stage": "cleanup_and_live_verification", "code": error.code if isinstance(error, Gate) else "LIVE_VERIFICATION_FAILED", "category": type(error).__name__}
        evidence["metrics"] = {key: sorted(value) if isinstance(value, set) else value for key, value in metrics.items()}
        if failure:
            evidence["status"], evidence["failure"] = "BLOCKED", failure
        r.save(root / "loopback-evidence.json", evidence)
        print(json.dumps({"status": evidence["status"], "comparisons": len(evidence["comparisons"]), "cleanup": evidence["cleanup"],
                          "failure": failure, "evidence": str(root / "loopback-evidence.json"), "sha256": r.file_sha(root / "loopback-evidence.json")}), flush=True)
    return evidence["status"] == "PASS"


if __name__ == "__main__":
    os.umask(0o077)
    parser = argparse.ArgumentParser()
    parser.add_argument("root", type=Path)
    args = parser.parse_args()
    try:
        import fcntl
        root, _ = r.state_paths(args.root)
        with open(root / ".loopback.lock", "a") as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            success = run(root)
        raise SystemExit(0 if success else 1)
    except SystemExit:
        raise
    except BaseException as error:
        print(json.dumps({"status": "BLOCKED", "code": error.code if isinstance(error, Gate) else "LAUNCHER_FAILED", "category": type(error).__name__}), flush=True)
        raise SystemExit(1)
