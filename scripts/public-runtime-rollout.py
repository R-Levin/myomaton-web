"""Fixed, approved 62439fc deployment; no credentials, migrations or registration."""
import argparse
import hashlib
import html.parser
import json
import os
from pathlib import Path, PurePosixPath
import posixpath
import re
import stat
import subprocess
import tarfile
import time
import urllib.error
import urllib.parse
import urllib.request

APPROVED = "62439fc0c8bde7fe98339625d33a845102a7995a"
PREVIOUS = "5b94a1d118b8ea7da0087fcab76786c5be9c0c13"
ACCOUNT = Path("/home/virtual/vps-bef564/5/53b4381d42")
HOSTS = ("runtime.miopages.com", "domain-test.miopages.com")
VERSIONS = {"next": "16.4.5", "sharp": "0.35.5", "dompurify": "3.4.17", "react": "19.2.8", "react-dom": "19.2.8"}
STAGE = "configuration"


def checkpoint(stage):
    global STAGE
    STAGE = stage
    print(json.dumps({"stage": stage, "status": "RUNNING"}), flush=True)


def sha(stream):
    value = hashlib.sha256()
    for block in iter(lambda: stream.read(1024 * 1024), b""):
        value.update(block)
    return value.hexdigest()


def file_sha(path):
    with open(path, "rb") as stream:
        return sha(stream)


def canonical(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def save(path, value):
    temporary = path.with_suffix(".tmp")
    with open(temporary, "w", encoding="utf-8") as stream:
        os.chmod(temporary, 0o600)
        json.dump(value, stream, sort_keys=True)
        stream.write("\n")
        stream.flush()
        os.fsync(stream.fileno())
    os.replace(temporary, path)


def command(args, cwd=None):
    # Never inherit/load the public environment or print captured command output.
    result = subprocess.run(args, cwd=cwd, capture_output=True, timeout=300)
    if result.returncode:
        raise RuntimeError("Command failed: " + Path(str(args[0])).name)
    return result.stdout


class Content(html.parser.HTMLParser):
    """Compare app DOM/SEO; exclude framework scripts and build asset locators."""
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.tokens, self.links = [], set()
        self.script = None

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if tag == "script":
            self.script = (values, [])
            return
        if tag == "link" and (values.get("href", "").startswith("/_next/") or values.get("rel") == "preload"):
            return
        clean = []
        for name, value in sorted(attrs):
            if name == "nonce":
                continue
            if value:
                value = re.sub(r"__variable_[a-f0-9]+", "__variable_FONT", value)
            clean.append([name, value])
        self.tokens.append(["start", tag, clean])
        if tag == "a":
            href = values.get("href", "")
            if re.fullmatch(r"/[a-z0-9/-]*", href) and not href.startswith(("/api/", "/media/", "/_next/")):
                self.links.add(href)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)

    def handle_endtag(self, tag):
        if tag == "script":
            if self.script and self.script[0].get("type") == "application/ld+json":
                self.tokens.append(["jsonld", json.loads("".join(self.script[1]))])
            self.script = None
        elif tag != "link":
            self.tokens.append(["end", tag])

    def handle_data(self, data):
        if self.script:
            self.script[1].append(data)
        elif data.strip():
            self.tokens.append(["text", data])


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def response(host, route):
    request = urllib.request.Request("https://" + host + route, headers={"User-Agent": "MioPages-approved-security-check/1", "Cache-Control": "no-cache"})
    try:
        result = urllib.request.build_opener(NoRedirect()).open(request, timeout=20)
    except urllib.error.HTTPError as error:
        result = error
    with result:
        body = result.read(4 * 1024 * 1024 + 1)
        assert len(body) <= 4 * 1024 * 1024, "Unexpected HTTP response size"
        status = result.code
    parser = Content()
    if status == 200:
        parser.feed(body.decode("utf-8"))
    return {"status": status, "bytes": len(body), "sha256": hashlib.sha256(body).hexdigest(), "content": parser.tokens, "links": sorted(parser.links)}


def http_snapshot(routes=None):
    data = {}
    for host in HOSTS:
        root = response(host, "/")
        assert root["status"] == 200, "Public root unhealthy"
        paths = routes[host] if routes else sorted({"/", "/api/intake", "/api/contact", "/media/assets/invalid", *root["links"]})
        assert len(paths) <= 16
        data[host] = {}
        for route in paths:
            first = root if route == "/" else response(host, route)
            second = response(host, route)
            assert first == second, "Unstable public baseline"
            assert first["status"] < 500 or route == "/api/intake" and first["status"] == 503, "Existing route unhealthy"
            data[host][route] = first
    return data


def compare_http(before, after, exact=False):
    assert before.keys() == after.keys()
    for host, routes in before.items():
        assert routes.keys() == after[host].keys()
        for route, old in routes.items():
            new = after[host][route]
            assert old["status"] == new["status"], "HTTP status changed"
            assert old["content"] == new["content"] and old["links"] == new["links"], "Public app content changed"
            if exact:
                assert old["sha256"] == new["sha256"], "Rollback response differs"


def tree(roots):
    manifest = {}
    def visit(path):
        info = path.lstat()
        name = path.relative_to(ACCOUNT).as_posix()
        item = {"mode": stat.S_IMODE(info.st_mode), "uid": info.st_uid, "gid": info.st_gid}
        if path.is_symlink():
            target = path.resolve(strict=True)
            assert target.is_relative_to(ACCOUNT), "Existing link escapes account"
            item.update(kind="link", target=os.readlink(path))
        elif path.is_dir():
            item["kind"] = "directory"
        else:
            assert path.is_file(), "Special application file refused"
            item.update(kind="file", sha256=file_sha(path), size=info.st_size)
        manifest[name] = item
        if item["kind"] == "directory":
            for child in sorted(path.iterdir()):
                visit(child)
    for root in roots:
        visit(root)
    return manifest


def backup_roots(web):
    return [web, ACCOUNT / ".config/miopages", ACCOUNT / "supabase-ca.crt"]


def protected_tree(web):
    return tree([ACCOUNT / ".config/miopages", ACCOUNT / "supabase-ca.crt", web / ".env", web / "ecosystem.config.js"])


def verify_archive(archive, manifest, rollback=False):
    seen = set()
    with tarfile.open(archive, "r:*") as stream:
        for entry in stream:
            name = entry.name[2:] if entry.name.startswith("./") else entry.name
            if name == ".":
                continue
            assert not PurePosixPath(name).is_absolute() and ".." not in PurePosixPath(name).parts, "Unsafe archive path"
            if entry.isdir():
                if rollback:
                    assert manifest[name]["kind"] == "directory"
                    seen.add(name)
                continue
            if name == "public-security-build.json" and not rollback:
                assert json.load(stream.extractfile(entry)) == manifest
                continue
            expected = manifest[name] if rollback else manifest["symlinks"].get(name)
            if entry.issym():
                target = expected["target"] if rollback else expected
                assert entry.linkname == target
                if not rollback:
                    assert not PurePosixPath(target).is_absolute()
                    resolved = posixpath.normpath(posixpath.join(posixpath.dirname(name), target))
                    assert not resolved.startswith("../") and resolved != ".."
                else:
                    assert expected["kind"] == "link"
            else:
                assert entry.isfile() or rollback and entry.islnk()
                if not rollback:
                    expected = manifest["files"][name]
                    for parent in PurePosixPath(name).parents:
                        assert str(parent) not in manifest["symlinks"], "Archive writes through a symlink"
                else:
                    assert expected["kind"] == "file"
                assert sha(stream.extractfile(entry)) == expected["sha256"], "Archive file checksum mismatch"
                assert stat.S_IMODE(entry.mode) == expected["mode"]
            assert name not in seen, "Duplicate archive entry"
            seen.add(name)
    expected = set(manifest) if rollback else set(manifest["files"]) | set(manifest["symlinks"])
    assert seen == expected, "Incomplete archive"


def installed(root, manifest):
    for name, info in manifest["files"].items():
        assert file_sha(root / name) == info["sha256"], "Installed candidate checksum mismatch"
    for name, target in manifest["symlinks"].items():
        path = root / name
        assert path.is_symlink() and os.readlink(path) == target
        assert path.resolve(strict=True).is_relative_to(root), "Installed link escapes release"


def native(root):
    script = """const fs=require('fs'); const versions={};for(const name of ['next','sharp','dompurify','react','react-dom'])versions[name]=JSON.parse(fs.readFileSync('node_modules/'+name+'/package.json','utf8')).version;
if(typeof require('@next/swc-linux-x64-gnu').transformSync!=='function')throw Error('SWC unavailable');
(async()=>{await require('sharp')({create:{width:1,height:1,channels:3,background:'white'}}).png().toBuffer(); const {JSDOM}=require('jsdom'),w=new JSDOM('').window;try{if(require('dompurify')(w).sanitize('<p>safe</p><script>bad()</script>')!=='<p>safe</p>')throw Error('Sanitizer probe');}finally{w.close();}console.log(JSON.stringify(versions));})().catch(()=>{process.exitCode=1;});"""
    return json.loads(command(["node", "--max-old-space-size=192", "-e", script], root))


def pm2_cli():
    home = ACCOUNT / ".pm2"
    assert (home / "rpc.sock").is_socket(), "Existing PM2 daemon required"
    pid = int((home / "pm2.pid").read_text())
    assert Path("/proc", str(pid)).stat().st_uid == os.getuid()
    path = command(["node", "-e", "console.log(require('path').join(require('path').dirname(require.resolve('pm2/package.json')),'bin/pm2'))"], ACCOUNT).decode().strip()
    assert Path(path).resolve().is_relative_to(ACCOUNT / "node_modules")
    os.environ["PM2_HOME"] = str(home)
    return path


def app(cli):
    entries = json.loads(command(["node", cli, "jlist"]))
    assert len(entries) == 1 and entries[0]["name"] == "miopages-runtime", "Unexpected process registration"
    entry, env = entries[0], entries[0]["pm2_env"]
    assert env["pm_cwd"] == str(ACCOUNT / "public_html")
    assert env["pm_exec_path"] == str(ACCOUNT / ".config/miopages/start-runtime.sh")
    assert str(env["PORT"]) == "8080" and env["exec_interpreter"] == "bash"
    return {"name": entry["name"], "id": entry["pm_id"], "pid": entry["pid"], "status": env["status"], "restarts": env["restart_time"], "rss": entry["monit"]["memory"]}


def state_paths(root):
    assert Path.home().resolve() == ACCOUNT and (ACCOUNT / "public_html").resolve() == ACCOUNT / "public_html"
    root = root.resolve()
    assert root.parent == ACCOUNT and re.fullmatch(r"miopages-public-security-[0-9TZ]+", root.name)
    assert root.stat().st_uid == os.getuid() and stat.S_IMODE(root.stat().st_mode) == 0o700
    return root, ACCOUNT / "public_html"


def prepare(root, archive_sha):
    checkpoint("existing_application_identity")
    root, web = state_paths(root)
    assert not (root / "state.json").exists(), "Existing deployment checkpoint; do not repeat prepare"
    assert command(["git", "rev-parse", "HEAD"], web).decode().strip() == PREVIOUS
    assert not command(["git", "status", "--porcelain", "--untracked-files=no"], web)
    cli = pm2_cli()
    before_app = app(cli)
    assert before_app["status"] == "online"
    archive = root / "public-security-62439fc-linux-x64.tar.gz"
    assert re.fullmatch(r"[a-f0-9]{64}", archive_sha) and file_sha(archive) == archive_sha
    manifest = json.loads((root / "public-security-build.json").read_text())
    assert manifest["sourceCommit"] == APPROVED and manifest["versions"] == VERSIONS
    assert manifest["packagedRuntimeSmoke"] == "PASS" and manifest["nativeProbe"] == "PASS"
    checkpoint("candidate_archive_verification")
    verify_archive(archive, manifest)
    stage = root / "candidate"
    stage.mkdir(mode=0o700)
    command(["tar", "--extract", "--gzip", "--file", str(archive), "--directory", str(stage), "--no-same-owner"])
    checkpoint("candidate_extracted_integrity_and_host_abi")
    installed(stage, manifest)
    assert native(stage) == VERSIONS, "Host ABI/native dependency refusal"
    command(["git", "fetch", "--no-tags", "origin", APPROVED], web)
    assert set(command(["git", "diff", "--name-only", PREVIOUS, APPROVED], web).decode().splitlines()) == {"package.json", "package-lock.json"}
    tracked = command(["git", "ls-tree", "-rz", APPROVED], web).split(b"\0")
    for row in filter(None, tracked):
        metadata, name = row.split(b"\t", 1)
        name = name.decode()
        body = (stage / name).read_bytes()
        assert hashlib.sha1(b"blob " + str(len(body)).encode() + b"\0" + body).hexdigest() == metadata.split()[2].decode(), "Artifact source differs from approved Git commit"
    checkpoint("https_and_application_baseline")
    baseline = http_snapshot()
    save(root / "http-before.json", baseline)
    protected = protected_tree(web)
    checkpoint("complete_rollback_archive")
    rollback_manifest = tree(backup_roots(web))
    save(root / "rollback-files.json", rollback_manifest)
    rollback = root / "rollback.tar"
    command(["tar", "--create", "--file", str(rollback), "--directory", str(ACCOUNT), "public_html", ".config/miopages", "supabase-ca.crt"])
    os.chmod(rollback, 0o600)
    assert tree(backup_roots(web)) == rollback_manifest, "Application changed during backup"
    checkpoint("independent_rollback_verification")
    verify_archive(rollback, rollback_manifest, True)
    recovery = {"archiveSha256": file_sha(rollback), "treeDigest": canonical(rollback_manifest), "entries": len(rollback_manifest), "independentlyVerified": True}
    save(root / "recovery-verified.json", recovery)
    state = {"phase": "prepared", "sourceCommit": APPROVED, "previousCommit": PREVIOUS, "artifactSha256": archive_sha,
             "protected": protected, "app": before_app, "recovery": recovery, "moved": [],
             "previousBranch": command(["git", "branch", "--show-current"], web).decode().strip()}
    save(root / "state.json", state)
    print(json.dumps({"status": "PREPARED", "recoveryVerified": True, "nativeProbe": "PASS", "sourceCommit": APPROVED, "rollbackSha256": recovery["archiveSha256"], "runDirectory": str(root)}))


def rollback(root, state, cli):
    checkpoint("rollback_matching_previous_release")
    web = ACCOUNT / "public_html"
    command(["node", cli, "stop", "miopages-runtime"])
    previous = root / "previous-live-tree"
    rejected = root / "rejected-new-tree"
    rejected.mkdir(exist_ok=True, mode=0o700)
    for name in (".next", "node_modules"):
        if (previous / name).exists():
            if (web / name).exists():
                assert not (rejected / name).exists()
                os.rename(web / name, rejected / name)
            os.rename(previous / name, web / name)
    branch = state["previousBranch"]
    if branch:
        assert command(["git", "rev-parse", branch], web).decode().strip() == PREVIOUS
        command(["git", "switch", branch], web)
    else:
        command(["git", "switch", "--detach", PREVIOUS], web)
    assert protected_tree(web) == state["protected"]
    command(["node", cli, "restart", "miopages-runtime"])
    healthy(root, state, cli, restored=True)
    state["phase"] = "ROLLED_BACK_VULNERABLE"
    save(root / "state.json", state)
    save(root / "deployment-evidence.json", {"status": "ROLLED_BACK", "previousVersionRemainsVulnerable": True, "sourceCommit": PREVIOUS, "recovery": state["recovery"]})


def healthy(root, state, cli, restored=False):
    baseline = json.loads((root / "http-before.json").read_text())
    for attempt in range(30):
        current = app(cli)
        if current["status"] == "online" and current["pid"]:
            try:
                for host in HOSTS:
                    assert response(host, "/")["status"] == 200
                break
            except (AssertionError, OSError):
                pass
        time.sleep(1)
    else:
        raise RuntimeError("Public process readiness failed")
    result = http_snapshot({host: list(routes) for host, routes in baseline.items()})
    compare_http(baseline, result, exact=restored)
    save(root / ("http-restored.json" if restored else "http-after.json"), result)
    assert protected_tree(ACCOUNT / "public_html") == state["protected"]
    assert current["id"] == state["app"]["id"] and current["rss"] < 512 * 1024 * 1024
    return current, result


def apply(root):
    checkpoint("durable_recovery_and_candidate_gate")
    root, web = state_paths(root)
    state = json.loads((root / "state.json").read_text())
    assert state["phase"] == "prepared", "Inspect existing checkpoint before resuming"
    assert file_sha(root / "rollback.tar") == state["recovery"]["archiveSha256"]
    assert json.loads((root / "recovery-verified.json").read_text()) == state["recovery"]
    assert file_sha(root / "public-security-62439fc-linux-x64.tar.gz") == state["artifactSha256"]
    manifest = json.loads((root / "public-security-build.json").read_text())
    installed(root / "candidate", manifest)
    assert command(["git", "rev-parse", "HEAD"], web).decode().strip() == PREVIOUS
    assert not command(["git", "status", "--porcelain", "--untracked-files=no"], web)
    assert tree(backup_roots(web)) == json.loads((root / "rollback-files.json").read_text()), "Live application changed after recovery verification"
    assert protected_tree(web) == state["protected"]
    baseline = json.loads((root / "http-before.json").read_text())
    compare_http(baseline, http_snapshot({host: list(routes) for host, routes in baseline.items()}), exact=True)
    cli = pm2_cli()
    assert app(cli)["status"] == "online"
    previous = root / "previous-live-tree"
    previous.mkdir(mode=0o700)
    state["phase"] = "stopping"
    save(root / "state.json", state)
    try:
        checkpoint("targeted_application_stop")
        command(["node", cli, "stop", "miopages-runtime"])
        assert app(cli)["status"] == "stopped"
        ports = command(["ss", "-ltn", "sport = :8080"]).decode().splitlines()
        assert len(ports) == 1, "Port8080 still occupied after targeted stop"
        for name in (".next", "node_modules"):
            os.rename(web / name, previous / name)
            os.rename(root / "candidate" / name, web / name)
            state["moved"].append(name)
            save(root / "state.json", state)
        command(["git", "switch", "--detach", APPROVED], web)
        for name in ("package.json", "package-lock.json"):
            assert file_sha(web / name) == manifest["files"][name]["sha256"]
        checkpoint("targeted_application_restart")
        command(["node", cli, "restart", "miopages-runtime"])
        checkpoint("post_deployment_https_content_configuration_and_health")
        current, http = healthy(root, state, cli)
        assert native(web) == VERSIONS
        assert not command(["git", "status", "--porcelain", "--untracked-files=no"], web)
        state["phase"] = "PASS"
        save(root / "state.json", state)
        evidence = {"status": "PASS", "sourceCommit": APPROVED, "previousCommit": PREVIOUS, "versions": VERSIONS,
                    "process": current, "recovery": state["recovery"], "artifactSha256": state["artifactSha256"],
                    "protectedConfigurationUnchanged": True, "databaseWrites": 0, "migrationsRun": 0,
                    "registrationChanged": False, "publicationChanged": False,
                    "http": {host: {route: {"status": item["status"], "sha256": item["sha256"], "contentDigest": canonical(item["content"])} for route, item in routes.items()} for host, routes in http.items()}}
        save(root / "deployment-evidence.json", evidence)
        print(json.dumps({"status": "PASS", "sourceCommit": APPROVED, "evidence": str(root / "deployment-evidence.json"), "evidenceSha256": file_sha(root / "deployment-evidence.json")}))
    except BaseException:
        try:
            rollback(root, state, cli)
            print(json.dumps({"status": "ROLLED_BACK", "previousVersionRemainsVulnerable": True, "evidence": str(root / "deployment-evidence.json")}))
        except BaseException:
            state["phase"] = "ROLLBACK_FAILED_STOP"
            save(root / "state.json", state)
            print(json.dumps({"status": "BLOCKED", "stage": "rollback", "runDirectory": str(root)}))
        raise


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser()
    parser.add_argument("operation", choices=("prepare", "apply"))
    parser.add_argument("root", type=Path)
    parser.add_argument("--archive-sha256")
    args = parser.parse_args()
    import fcntl
    root, _ = state_paths(args.root)
    with open(root / ".rollout.lock", "a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        if args.operation == "prepare":
            prepare(root, args.archive_sha256)
        else:
            apply(root)


if __name__ == "__main__":
    try:
        main()
    except BaseException as error:
        # No arbitrary subprocess/HTTP/environment strings in operator output.
        print(json.dumps({"status": "BLOCKED", "stage": STAGE, "category": type(error).__name__}))
        raise SystemExit(1)
