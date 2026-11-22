"""Update protected Core on the 20i server from a CI-built artifact, with a rollback copy.

Usage (on the server, from ~/miopages-private-acceptance):
  python3 core-update.py install <artifact.tar.gz> <expected-source-commit>
  python3 core-update.py rollback <backup-directory-name>

install: verifies the archive checksum and every file against the build manifest inside
it, requires an unchanged dependency lockfile (installed node_modules are kept), moves the
current app files into a dated backup folder, extracts the new build, verifies it on disk,
restarts the PM2 app once and checks that /core answers 200. Any failure before the
restart leaves the backup in place for rollback. Prints only non-sensitive status JSON.
"""
import hashlib, json, os, pathlib, shutil, subprocess, sys, tarfile, time, urllib.request

HOME = pathlib.Path.home().resolve()
WEB = HOME / "public_html"
PRIVATE = HOME / "miopages-private-acceptance"
MANAGED = [".next", ".rehearsal", "docs", "lib", "public", "package.json", "package-lock.json", "next.config.ts", "rehearsal-build.json"]
KEEP = {"node_modules", ".env", "ecosystem.config.js"}
PM2 = ["node", str(HOME / "node_modules/pm2/bin/pm2")]


def sha(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def fail(stage, detail):
    print(json.dumps({"status": "BLOCKED", "stage": stage, "detail": detail}))
    sys.exit(1)


def core_status():
    for _ in range(30):
        try:
            with urllib.request.urlopen("https://wp-acceptance.miopages.com/core", timeout=10) as response:
                if response.status == 200:
                    return 200
        except Exception:
            pass
        time.sleep(3)
    return 0


def restart():
    subprocess.run(PM2 + ["restart", "miopages-protected-core"], check=True, capture_output=True)
    return core_status()


def install(archive_name, commit):
    archive = PRIVATE / archive_name
    checksum = (PRIVATE / (archive_name + ".sha256")).read_text().split()[0]
    if sha(archive) != checksum:
        fail("archive", "Archive checksum differs")
    with tarfile.open(archive, "r:gz") as tar:
        members = {m.name.removeprefix("./"): m for m in tar.getmembers()}
        manifest = json.loads(tar.extractfile(members["rehearsal-build.json"]).read())
        if manifest.get("sourceCommit") != commit or manifest.get("symlinks"):
            fail("manifest", "Unexpected source commit or symlinks")
        for name, member in members.items():
            if name.startswith("/") or ".." in name.split("/") or not (member.isfile() or member.isdir()):
                fail("manifest", "Unsafe archive entry")
            if member.isfile() and name.split("/")[0] not in MANAGED:
                fail("manifest", "Archive entry outside managed app files")
        for name, expected in manifest["files"].items():
            expected = expected["sha256"] if isinstance(expected, dict) else expected
            if hashlib.sha256(tar.extractfile(members[name]).read()).hexdigest() != expected:
                fail("manifest", "File differs from build manifest")
        lock = members["package-lock.json"]
        if hashlib.sha256(tar.extractfile(lock).read()).hexdigest() != sha(WEB / "package-lock.json"):
            fail("dependencies", "Dependency lockfile changed; installed libraries cannot be reused")
        previous = json.loads((WEB / "rehearsal-build.json").read_text()).get("sourceCommit", "unknown")[:7]
        backup = PRIVATE / ("app-before-" + commit[:7] + "-was-" + previous + "-" + time.strftime("%Y%m%dT%H%M%SZ", time.gmtime()))
        backup.mkdir(mode=0o700)
        for entry in MANAGED:
            if (WEB / entry).exists():
                shutil.move(str(WEB / entry), str(backup / entry))
        tar.extractall(WEB, members=[m for n, m in members.items() if n.split("/")[0] in MANAGED])
    for name, expected in manifest["files"].items():
        expected = expected["sha256"] if isinstance(expected, dict) else expected
        if sha(WEB / name) != expected:
            fail("verify", "Installed file differs; roll back with: rollback " + backup.name)
    status = restart()
    print(json.dumps({"status": "PASS" if status == 200 else "BLOCKED", "installedCommit": commit[:7], "previousCommit": previous,
                      "files": len(manifest["files"]), "backup": backup.name, "core": status, "librariesKept": True}))
    if status != 200:
        sys.exit(1)


def rollback(name):
    backup = PRIVATE / name
    if not backup.is_dir() or not name.startswith("app-before-"):
        fail("rollback", "Backup folder not found")
    failed = PRIVATE / ("app-failed-" + time.strftime("%Y%m%dT%H%M%SZ", time.gmtime()))
    failed.mkdir(mode=0o700)
    for entry in MANAGED:
        if (WEB / entry).exists():
            shutil.move(str(WEB / entry), str(failed / entry))
        if (backup / entry).exists():
            shutil.move(str(backup / entry), str(WEB / entry))
    status = restart()
    print(json.dumps({"status": "PASS" if status == 200 else "BLOCKED", "restoredFrom": name, "setAside": failed.name, "core": status}))


if __name__ == "__main__":
    assert os.getuid() == 3326411 and WEB.resolve() == WEB
    if len(sys.argv) == 4 and sys.argv[1] == "install":
        install(sys.argv[2], sys.argv[3])
    elif len(sys.argv) == 3 and sys.argv[1] == "rollback":
        rollback(sys.argv[2])
    else:
        fail("usage", "install <artifact> <commit> | rollback <backup>")
