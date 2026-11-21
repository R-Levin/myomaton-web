"""Verified launcher-only correction; preserve the exact Core build and data.
The base artifact and runtime correction have separate, explicit provenance.
"""
import importlib.util
import json
import os
import pathlib
import shutil
import sys
import threading
import time
import traceback
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('prior', ROOT / 'protected-account-rollout.py')
prior = importlib.util.module_from_spec(spec)
spec.loader.exec_module(prior)
phase = 'preflight'
SOURCE = '653e0b16ff04ef728c02bb401b99e00e78a72a2d'
BASE = '9460b4bf200573ac055c4cb493178f34de0fead2'
FILE = '.rehearsal/private-listener.cjs'
CASE = prior.PRIVATE / 'presence-evaluation/41a83e7e-1765-4517-941a-b2b151bb7c4a'


def private_state():
    names = ['core-config.json', 'core-input.json', 'current-site-review.json', 'presence-workflow-grant.json',
             'core-usage/onboarding-usage.json', 'account-cycle-scope.json', 'account-cycle-workflow-grant.json',
             'core-account-cycle-usage/onboarding-usage.json']
    return {**{name: prior.digest(prior.PRIVATE / name) for name in names},
            'sourceGrant': prior.digest(CASE / 'grant.json'), 'sourceLedger': prior.digest(CASE / 'usage/onboarding-usage.json')}


def wait_ready():
    for index in range(20):
        try:
            prior.probe(); return
        except Exception:
            if index == 19: raise
            time.sleep(1)


def pid_identity():
    pid = int((prior.HOME / '.pm2/pids/miopages-protected-core-0.pid').read_text().strip())
    p = pathlib.Path('/proc') / str(pid)
    assert p.stat().st_uid == os.getuid() and b'private-listener.cjs' in (p / 'cmdline').read_bytes()
    return pid, (p / 'stat').read_text().rsplit(')', 1)[1].split()[19]


def main():
    global phase
    assert len(sys.argv) == 2 and sys.argv[1] == 'APPLY-VERIFIED-CORE-MEMORY-FIX'
    assert sys.platform == 'linux' and pathlib.Path.home().resolve() == prior.HOME
    assert ROOT == prior.PRIVATE / 'core-memory-653e0b1'
    assert ROOT.stat().st_mode & 0o777 == 0o700 and ROOT.stat().st_uid == os.getuid()
    assert not (ROOT / 'before.json').exists()
    proof = json.loads((ROOT / 'linux-proof.json').read_bytes())
    assert proof['sourceCommit'] == SOURCE and proof['isolatedRuntimeSmoke'] == proof['nativePreviewSmoke'] == 'PASS'
    new = ROOT / 'private-listener.cjs'
    assert prior.digest(new) == proof['files'][FILE]
    prior.verify_files(prior.WEB, BASE)
    manifest = json.loads((prior.WEB / 'rehearsal-build.json').read_bytes())
    assert 'runtimeCorrections' not in manifest
    before = {'state': private_state(), 'public': prior.public(), 'baseManifest': prior.digest(prior.WEB / 'rehearsal-build.json'),
              'oldLauncher': prior.digest(prior.WEB / FILE), 'newLauncher': prior.digest(new)}
    prior.save(ROOT / 'before.json', before)
    for source, name in [(prior.WEB / FILE, 'previous-listener.cjs'), (prior.WEB / 'rehearsal-build.json', 'previous-build.json')]:
        shutil.copy2(source, ROOT / name); os.chmod(ROOT / name, 0o600)
        assert prior.digest(source) == prior.digest(ROOT / name)
    changed = stopped = False
    try:
        phase = 'targeted-stop-and-identity'
        prior.pm2('stop', '0'); stopped = True
        assert prior.application('stopped')['restarts'] == 10
        phase = 'verified-launcher-only-swap'
        target = prior.WEB / FILE
        shutil.copy2(new, target.with_suffix('.new')); os.chmod(target.with_suffix('.new'), 0o600)
        target.with_suffix('.new').replace(target); changed = True
        updated = {**manifest, 'files': {**manifest['files'], FILE: before['newLauncher']},
                   'runtimeCorrections': [{'sourceCommit': SOURCE, 'file': FILE, 'sha256': before['newLauncher'],
                     'baseManifestSha256': before['baseManifest'], 'linuxRun': 44911215993,
                     'v8OldSpaceMiB': 128, 'v8SemiSpaceMiB': 4, 'safetyLimitsUnchanged': True}]}
        prior.save(prior.WEB / 'rehearsal-build.json.new', updated)
        (prior.WEB / 'rehearsal-build.json.new').replace(prior.WEB / 'rehearsal-build.json')
        prior.verify_files(prior.WEB, BASE)
        prior.pm2('restart', '0'); wait_ready()
        identity = pid_identity()
        phase = 'login-allocation-and-sustained-stability'
        samples, finished = [], threading.Event()
        def measure():
            while not finished.wait(.1):
                try:
                    available = int(next(x.split()[1] for x in pathlib.Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:')))
                    samples.append(available)
                except Exception: pass
        monitor = threading.Thread(target=measure, daemon=True); monitor.start()
        try:
            request = urllib.request.Request('https://wp-acceptance.miopages.com/api/protected-core', method='POST',
              data=json.dumps({'operation': 'sign-in', 'username': 'owner', 'password': 'controlled-negative-login-not-an-owner-credential'}).encode(),
              headers={'Origin': 'https://wp-acceptance.miopages.com', 'Content-Type': 'application/json', 'X-Intake-Request': '1'})
            try:
                urllib.request.urlopen(request, timeout=20)
                raise AssertionError('Synthetic password unexpectedly accepted')
            except urllib.error.HTTPError as error:
                assert error.code == 401 and not error.headers.get('Set-Cookie')
            for _ in range(24):
                time.sleep(5); assert pid_identity() == identity; prior.probe()
        finally:
            finished.set(); monitor.join(timeout=2)
        assert samples and min(samples) >= 524288
        assert private_state() == before['state'] and prior.public() == before['public']
        prior.verify_files(prior.WEB, BASE)
        result = {'status': 'PASS', 'operation': 'protected-core-memory-correction', 'baseSource': BASE,
                  'launcherSource': SOURCE, 'launcherSha256': before['newLauncher'], 'pid': identity[0], 'started': identity[1],
                  'minimumAvailableKiB': min(samples), 'stabilitySeconds': 120, 'negativeLoginAllocation': '401/no-session',
                  'privateStateUnchanged': True, 'publicDigestsUnchanged': True, 'safetyLimitsUnchanged': True,
                  'providerRequests': 0, 'databaseWrites': 0, 'ownerPasswordUsed': False}
        prior.save(ROOT / 'result.json', result); print(json.dumps(result), flush=True)
    except Exception:
        failed = phase
        prior.save(ROOT / 'failure.json', {'phase': phase, 'stateUnchanged': private_state() == before['state']})
        if stopped:
            prior.pm2('stop', '0')
            if changed:
                shutil.copy2(ROOT / 'previous-listener.cjs', prior.WEB / FILE)
                shutil.copy2(ROOT / 'previous-build.json', prior.WEB / 'rehearsal-build.json')
            prior.verify_files(prior.WEB, BASE)
            prior.pm2('restart', '0'); wait_ready()
            assert private_state() == before['state'] and prior.public() == before['public']
            prior.save(ROOT / 'rollback.json', {'status': 'PASS', 'failedPhase': failed, 'baseSource': BASE})
        raise


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        line = traceback.extract_tb(error.__traceback__)[-1].lineno
        print(json.dumps({'status': 'BLOCKED', 'stage': phase, 'type': type(error).__name__, 'line': line}), flush=True)
        sys.exit(1)
