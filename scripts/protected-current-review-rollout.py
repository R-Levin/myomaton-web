"""One same-account Core review correction, using the established rollout helpers.
No provider, database mutation, credential change or WordPress operation.
"""
import importlib.util
import json
import os
import pathlib
import shutil
import subprocess
import sys
import tarfile
import time
import traceback

spec = importlib.util.spec_from_file_location('prior', pathlib.Path(__file__).with_name('protected-account-rollout.py'))
prior = importlib.util.module_from_spec(spec)
spec.loader.exec_module(prior)
HOME, PRIVATE, WEB = prior.HOME, prior.PRIVATE, prior.WEB
RUN = pathlib.Path(__file__).resolve().parent
prior.RUN = RUN
OLD = '4058a74f5b88c5392563b236dab8258107c66d81'
CASE = '41a83e7e-1765-4517-941a-b2b151bb7c4a'
SOURCE = PRIVATE / 'presence-evaluation' / CASE
BINDING = {
    'schema': 'retained-core-review/1', 'ownerId': 'f2cd3fe8-58b3-4dfa-9125-fd8f1bd35f8e',
    'parentScope': {'webPresenceId': '819d007a-595d-4374-a2f0-96b900d46559', 'managedSiteId': '1d92a248-416f-4e22-baaf-d2f1fca70352'},
    'sourceCaseId': CASE,
    'sourceScope': {'webPresenceId': '2a08e054-902c-400b-9b96-3c2274bcadc2', 'managedSiteId': '2c0d637d-4ded-4597-ac8b-661519aba358'},
    'sourceManifestSha256': 'f560374969b7abdff53fa33917c9b84f7053f5f9b092b0dccf9a505bcc8f9ddd',
    'revision': 106, 'baselineRevision': 97,
    'eventDigest': 'd60864ea449c2d44e5c24e7a5935c6d261d50388070fc42148a62eb0f391a083',
}
phase = 'preflight'


def state():
    names = ['core-config.json', 'core-input.json', 'presence-workflow-grant.json', 'core-usage/onboarding-usage.json',
             'account-cycle-scope.json', 'account-cycle-workflow-grant.json', 'core-account-cycle-usage/onboarding-usage.json']
    return {**{name: prior.digest(PRIVATE / name) for name in names},
            **{name: prior.digest(SOURCE / name) for name in ['grant.json', 'context.json', 'usage/onboarding-usage.json']}}


def backup():
    archive = RUN / 'matching-rollback-4058a74.tar.gz'
    assert not archive.exists()
    with tarfile.open(archive, 'w:gz', compresslevel=1, dereference=False) as tar:
        tar.add(WEB, arcname='application')
    os.chmod(archive, 0o600)
    count = 0
    with tarfile.open(archive, 'r:gz') as tar:
        for item in tar:
            path = WEB / pathlib.PurePosixPath(item.name).relative_to('application')
            if item.isfile():
                import hashlib
                h = hashlib.sha256()
                stream = tar.extractfile(item)
                for chunk in iter(lambda: stream.read(1024 * 1024), b''):
                    h.update(chunk)
                assert h.hexdigest() == prior.digest(path)
                count += 1
            elif item.issym():
                assert os.readlink(path) == item.linkname
            else:
                assert item.isdir()
    prior.save(RUN / 'rollback-verification.json', {'sha256': prior.digest(archive), 'regularFiles': count, 'sourceCommit': OLD})


def main():
    global phase
    assert sys.platform == 'linux' and pathlib.Path.home().resolve() == HOME
    assert RUN.parent == PRIVATE and RUN.name.startswith('current-review-')
    assert len(sys.argv) == 4 and sys.argv[1] == 'DEPLOY-RETAINED-REVIEW'
    target, checksum = sys.argv[2:]
    assert len(target) == 40 and len(checksum) == 64 and all(c in '0123456789abcdef' for c in target + checksum)
    assert not (RUN / 'before.json').exists(), 'An attempted rollout must be inspected before any continuation'
    for directory in [PRIVATE, RUN, WEB]:
        assert directory.resolve() == directory and directory.stat().st_uid == os.getuid() and directory.stat().st_mode & 0o777 == 0o700
    binding = PRIVATE / 'current-site-review.json'
    assert not binding.exists()
    assert prior.digest(RUN / 'protected-core-linux-x64.tar.gz') == checksum
    assert prior.digest(SOURCE / 'usage/onboarding-usage.json') == '241777da3d784337b943df824546eb0e1f8c17602f72d5313c067f808a727baa'
    prior.resources()
    prior.verify_files(WEB, OLD)
    app = prior.application('online')
    assert app['pid'] == 406236 and app['restarts'] == 10, 'Unexpected process drift'
    before = {'application': app, 'state': state(), 'public': prior.public(), 'target': target, 'archive': checksum}
    prior.save(RUN / 'before.json', before)
    phase = 'complete-matching-rollback'
    backup()
    phase = 'candidate-verification'
    candidate, previous = RUN / 'candidate', RUN / 'previous-4058a74'
    assert not candidate.exists() and not previous.exists()
    candidate.mkdir(mode=0o700)
    with tarfile.open(RUN / 'protected-core-linux-x64.tar.gz', 'r:gz') as tar:
        for item in tar.getmembers():
            assert not item.name.startswith('/') and '..' not in pathlib.PurePosixPath(item.name).parts
            assert item.isfile() or item.isdir()
        tar.extractall(candidate)
    os.chmod(candidate, 0o700)
    build = json.loads((candidate / 'rehearsal-build.json').read_bytes())
    assert build['nativePreviewSmoke'] == 'PASS'
    for name in ['package.json', 'package-lock.json']:
        assert prior.digest(WEB / name) == prior.digest(candidate / name), 'Dependency drift'
    shutil.copytree(WEB / 'node_modules', candidate / 'node_modules', symlinks=True)
    for name in ['.env', 'ecosystem.config.js']:
        shutil.copy2(WEB / name, candidate / name)
        assert prior.digest(WEB / name) == prior.digest(candidate / name)
    prior.verify_files(candidate, target)
    assert state() == before['state'] and prior.public() == before['public']
    stopped = swapped = False
    try:
        phase = 'sequential-actual-case-readcheck'
        prior.resources()
        prior.pm2('stop', '0'); stopped = True
        prior.application('stopped')
        prior.save(binding, BINDING)
        env = {'HOME': str(HOME), 'PATH': '/usr/bin:/bin', 'NODE_PATH': str(candidate / 'node_modules'), 'NODE_ENV': 'production'}
        result = subprocess.run(['/usr/bin/node', '--max-old-space-size=192', str(RUN / 'retained-review-readcheck.cjs')],
                                cwd=candidate, env=env, capture_output=True, timeout=120)
        prior.save(RUN / 'readcheck-process.json', {'returncode': result.returncode,
                   'stdout': result.stdout.decode('utf-8', errors='replace'), 'stderr': result.stderr.decode('utf-8', errors='replace')})
        # Only the readcheck's sanitized receipt may leave this process.
        assert result.returncode == 0, 'Actual retained-case readcheck failed'
        check = json.loads(result.stdout)
        assert check['status'] == 'PASS' and check['providerRequests'] == check['databaseWrites'] == 0
        assert check['rssBytes'] <= 384 * 1024 ** 2
        prior.resources()
        prior.save(RUN / 'actual-readcheck.json', check)
        phase = 'swap-only-protected-core'
        WEB.rename(previous); candidate.rename(WEB); swapped = True
        prior.pm2('restart', '0')
        for attempt in range(15):
            try:
                prior.probe(); break
            except Exception:
                if attempt == 14: raise
                time.sleep(2)
        active = prior.application('online')
        assert active['restarts'] in [app['restarts'], app['restarts'] + 1]
        phase = 'independent-stability-and-state'
        for _ in range(3):
            time.sleep(5); prior.probe(); assert prior.application('online') == active
        count = prior.verify_files(WEB, target)
        assert state() == before['state'] and prior.public() == before['public']
        assert json.loads(binding.read_bytes()) == BINDING
        prior.resources()
        prior.pm2('save', '--force')
        receipt = {'status': 'PASS', 'operation': 'deploy-retained-core-review', 'sourceCommit': target,
                   'artifactSha256': checksum, 'verifiedFiles': count, 'application': active, 'actualCaseReadcheck': 'PASS',
                   'privateStateUnchanged': True, 'publicDigestsUnchanged': True, 'rollbackUsed': False,
                   'providerRequests': 0, 'databaseWrites': 0, 'ownerPasswordLoginTested': False}
        prior.save(RUN / 'deployment.json', receipt)
        print(json.dumps(receipt), flush=True)
    except Exception:
        failed = phase
        prior.save(RUN / 'failure.json', {'phase': failed, 'application': prior.application(), 'stateUnchanged': state() == before['state']})
        if stopped:
            prior.pm2('stop', '0')
            if binding.exists(): binding.rename(RUN / 'failed-binding.json')
            if swapped:
                WEB.rename(RUN / 'failed-candidate'); previous.rename(WEB)
            prior.verify_files(WEB, OLD)
            prior.pm2('restart', '0'); time.sleep(4); prior.probe()
            assert state() == before['state'] and prior.public() == before['public']
            prior.save(RUN / 'rollback.json', {'status': 'PASS', 'sourceCommit': OLD, 'failedPhase': failed})
        raise


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        location = traceback.extract_tb(error.__traceback__)[-1]
        print(json.dumps({'status': 'BLOCKED', 'stage': phase, 'type': type(error).__name__, 'line': location.lineno}), flush=True)
        sys.exit(1)
