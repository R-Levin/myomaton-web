"""Same-app review-guide rollout. Preserve data, dependencies and bounded recovery.
Only the already tested Core artifact changes; no provider or WordPress writes.
"""
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tarfile
import time
import traceback

ROOT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('prior', ROOT / 'protected-account-rollout.py')
prior = importlib.util.module_from_spec(spec); spec.loader.exec_module(prior)
HOME, PRIVATE, WEB = prior.HOME, prior.PRIVATE, prior.WEB
prior.RUN = ROOT
OLD = '9460b4bf200573ac055c4cb493178f34de0fead2'
NEW = '1202d6358eeea265731e49c43cdec31a7b1282ff'
ARCHIVE = '8dd877c63b00bae0a4441c9bb616dcc5e4c1b9fa90df69d01dbc7851241d3e6b'
LAUNCHER = '367acb49f4fd8a3d167a3c82f806b89248eb94e112d3c195c3d497bb8f7a86a4'
phase = 'preflight'


def state():
    files = ['core-config.json', 'core-input.json', 'current-site-review.json', 'current-wordpress-review.json',
             'presence-workflow-grant.json', 'core-usage/onboarding-usage.json', 'account-cycle-scope.json',
             'account-cycle-workflow-grant.json', 'core-account-cycle-usage/onboarding-usage.json']
    # Resolve the actual case from the existing immutable association, not a new tenant.
    case = PRIVATE / 'presence-evaluation' / json.loads((PRIVATE / 'current-site-review.json').read_bytes())['sourceCaseId']
    return {**{name: prior.digest(PRIVATE / name) for name in files},
            **{name: prior.digest(case / name) for name in ['grant.json', 'context.json', 'usage/onboarding-usage.json']}}


def process_identity():
    file = HOME / '.pm2/pids/miopages-protected-core-0.pid'
    pid = int(file.read_text().strip())
    proc = Path('/proc') / str(pid)
    assert proc.stat().st_uid == os.getuid()
    assert b'private-listener.cjs' in (proc / 'cmdline').read_bytes()
    return {'pid': pid, 'start': (proc / 'stat').read_text().rsplit(')', 1)[1].split()[19]}


def tree(root):
    files, links = {}, {}
    for directory, dirs, names in os.walk(root, followlinks=False):
        for name in dirs + names:
            path = Path(directory) / name
            relative = str(path.relative_to(root))
            if path.is_symlink(): links[relative] = os.readlink(path)
            elif path.is_file(): files[relative] = prior.digest(path)
            else: assert path.is_dir()
    return {'files': files, 'links': links}


def ready():
    for attempt in range(20):
        try: prior.probe(); return
        except Exception:
            if attempt == 19: raise
            time.sleep(1)


def main():
    global phase
    assert sys.argv[1:] == ['DEPLOY-TEMPORARY-REVIEW-GUIDES']
    assert sys.platform == 'linux' and Path.home().resolve() == HOME
    assert ROOT == PRIVATE / 'review-guides-1202d63'
    for directory in [PRIVATE, ROOT, WEB]:
        assert directory.resolve() == directory and directory.stat().st_uid == os.getuid() and directory.stat().st_mode & 0o777 == 0o700
    assert not (ROOT / 'before.json').exists(), 'Inspect previous attempt before continuing'
    prior.resources()
    before_state, before_public, identity = state(), prior.public(), process_identity()
    build = json.loads((WEB / 'rehearsal-build.json').read_bytes())
    assert build['sourceCommit'] == OLD and prior.digest(WEB / '.rehearsal/private-listener.cjs') == LAUNCHER
    prior.verify_files(WEB, OLD)
    saved = json.loads((HOME / '.pm2/dump.pm2').read_bytes())
    assert len(saved) == 1 and saved[0]['name'] == 'miopages-protected-core'
    for key, value in {'autorestart': True, 'restart_delay': 15000, 'min_uptime': 60000, 'max_restarts': 3}.items():
        assert saved[0][key] == value
    assert prior.digest(ROOT / 'protected-core-linux-x64.tar.gz') == ARCHIVE
    candidate, previous = ROOT / 'candidate', ROOT / 'matching-previous-runtime'
    candidate.mkdir(mode=0o700)
    with tarfile.open(ROOT / 'protected-core-linux-x64.tar.gz', 'r:gz') as archive:
        for item in archive.getmembers():
            assert not item.name.startswith('/') and '..' not in Path(item.name).parts
            assert item.isfile() or item.isdir()
        archive.extractall(candidate)
    os.chmod(candidate, 0o700)
    assert prior.digest(candidate / '.rehearsal/private-listener.cjs') == LAUNCHER
    assert json.loads((candidate / 'rehearsal-build.json').read_bytes())['nativePreviewSmoke'] == 'PASS'
    for name in ['package.json', 'package-lock.json']:
        assert prior.digest(WEB / name) == prior.digest(candidate / name)
    shutil.copytree(WEB / 'node_modules', candidate / 'node_modules', symlinks=True)
    for name in ['.env', 'ecosystem.config.js']: shutil.copy2(WEB / name, candidate / name)
    prior.verify_files(candidate, NEW)
    prior.save(ROOT / 'before.json', {'state': before_state, 'public': before_public, 'process': identity,
        'source': OLD, 'launcherSha256': LAUNCHER, 'managerDumpSha256': prior.digest(HOME / '.pm2/dump.pm2')})
    stopped = swapped = False
    try:
        phase = 'sequential-actual-case-verification'
        prior.pm2('stop', '0'); stopped = True
        assert not (Path('/proc') / str(identity['pid'])).exists()
        matching = tree(WEB)
        prior.save(ROOT / 'matching-rollback-files.json', matching)
        env = {'HOME': str(HOME), 'PATH': '/usr/bin:/bin', 'NODE_PATH': str(candidate / 'node_modules'), 'NODE_ENV': 'production'}
        result = subprocess.run(['/usr/bin/node', '--max-old-space-size=192', str(ROOT / 'retained-review-readcheck.cjs')],
            cwd=candidate, env=env, capture_output=True, timeout=120)
        prior.save(ROOT / 'readcheck-process.json', {'returncode': result.returncode,
            'stdout': result.stdout.decode(errors='replace'), 'stderr': result.stderr.decode(errors='replace')})
        assert result.returncode == 0, 'Actual-case readcheck refused'
        check = json.loads(result.stdout)
        assert check['status'] == 'PASS' and check['providerRequests'] == check['databaseWrites'] == 0
        prior.resources()
        assert state() == before_state
        phase = 'same-application-swap'
        WEB.rename(previous); candidate.rename(WEB); swapped = True
        assert tree(previous) == matching
        prior.pm2('restart', '0'); ready()
        active = process_identity()
        phase = 'stability-verification'
        minimum = prior.resources()
        for _ in range(12):
            time.sleep(5); prior.probe()
            assert process_identity() == active, 'Unexpected restart'
            minimum = min(minimum, prior.resources())
        count = prior.verify_files(WEB, NEW)
        assert state() == before_state and prior.public() == before_public
        assert prior.digest(WEB / 'ecosystem.config.js') == prior.digest(previous / 'ecosystem.config.js')
        result = {'status': 'PASS', 'sourceCommit': NEW, 'artifactSha256': ARCHIVE, 'verifiedFiles': count,
            'process': active, 'minimumAvailableKiB': minimum, 'boundedRecoveryPreserved': True,
            'completeMatchingRollback': True, 'rollbackUsed': False, 'privateStateUnchanged': True,
            'publicOutputUnchanged': True, 'providerRequests': 0, 'databaseWrites': 0, 'ownerPasswordLoginTested': False}
        prior.save(ROOT / 'deployment.json', result); print(json.dumps(result), flush=True)
    except Exception:
        prior.save(ROOT / 'failure.json', {'phase': phase, 'swapped': swapped})
        if stopped:
            prior.pm2('stop', '0')
            if swapped:
                WEB.rename(ROOT / 'failed-candidate'); previous.rename(WEB)
            assert tree(WEB) == matching
            prior.pm2('restart', '0'); ready()
            assert state() == before_state and prior.public() == before_public
            prior.save(ROOT / 'rollback.json', {'status': 'PASS', 'source': OLD, 'phase': phase})
        raise


if __name__ == '__main__':
    try: main()
    except Exception as error:
        print(json.dumps({'status': 'BLOCKED', 'phase': phase, 'type': type(error).__name__,
            'line': traceback.extract_tb(error.__traceback__)[-1].lineno}), flush=True)
        sys.exit(1)
