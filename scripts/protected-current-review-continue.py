"""Diagnosed memory-only continuation. Reuse the already verified candidate and
rollback; avoid retaining archive metadata or spawning PM2 CLIs during stability polls.
The app's 384MiB / 512MiB guards remain unchanged.
"""
import importlib.util
import json
import os
import pathlib
import sys
import time
import traceback

ROOT = pathlib.Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('attempt', ROOT / 'protected-current-review-rollout.py')
attempt = importlib.util.module_from_spec(spec)
spec.loader.exec_module(attempt)
prior = attempt.prior
phase = 'diagnosed-continuation-preflight'


def identity():
    file = prior.HOME / '.pm2/pids/miopages-protected-core-0.pid'
    assert file.resolve() == file and file.stat().st_uid == os.getuid()
    pid = int(file.read_text().strip())
    process = pathlib.Path('/proc') / str(pid)
    assert process.stat().st_uid == os.getuid()
    command = (process / 'cmdline').read_bytes()
    # PM2 replaces the process title with the script path, dropping arguments.
    # Verify arguments in the preserved PM2 definition, not the rewritten title.
    assert b'private-listener.cjs' in command
    stat = (process / 'stat').read_text().rsplit(')', 1)[1].split()
    assert stat[0] != 'Z'
    return {'pid': pid, 'started': stat[19]}


def wait_ready():
    for number in range(20):
        try:
            prior.probe()
            return
        except Exception:
            if number == 19: raise
            time.sleep(2)


def main():
    global phase
    assert len(sys.argv) == 2 and sys.argv[1] == 'CONTINUE-VERIFIED-RESOURCE-CORRECTION'
    assert sys.platform == 'linux' and pathlib.Path.home().resolve() == prior.HOME
    assert ROOT == prior.PRIVATE / 'current-review-9460b4b'
    before = json.loads((ROOT / 'before.json').read_bytes())
    check = json.loads((ROOT / 'actual-readcheck.json').read_bytes())
    assert check['status'] == 'PASS' and check['rssBytes'] < 384 * 1024 ** 2
    assert json.loads((ROOT / 'rollback-independent.json').read_bytes())['status'] == 'PASS'
    assert json.loads((ROOT / 'failure.json').read_bytes())['phase'] == 'independent-stability-and-state'
    assert not (ROOT / 'resource-continuation-attempt.json').exists()
    assert prior.digest(ROOT / 'matching-rollback-4058a74.tar.gz') == json.loads((ROOT / 'rollback-verification.json').read_bytes())['sha256']
    candidate, previous = ROOT / 'failed-candidate', ROOT / 'previous-resource-continuation'
    binding = prior.PRIVATE / 'current-site-review.json'
    assert not previous.exists() and not binding.exists()
    assert json.loads((ROOT / 'failed-binding.json').read_bytes()) == attempt.BINDING
    prior.verify_files(prior.WEB, attempt.OLD)
    prior.verify_files(candidate, before['target'])
    assert attempt.state() == before['state'] and prior.public() == before['public']
    app = prior.application('online')
    assert app == json.loads((ROOT / 'rollback-independent.json').read_bytes())['application']
    prior.resources()
    dump = json.loads((prior.HOME / '.pm2/dump.pm2').read_bytes())
    assert len(dump) == 1 and dump[0]['name'] == 'miopages-protected-core'
    assert dump[0]['args'] == ['--core']
    assert dump[0]['pm_cwd'] == str(prior.WEB) and dump[0]['pm_exec_path'] == str(prior.WEB / '.rehearsal/private-listener.cjs')
    prior.save(ROOT / 'resource-continuation-attempt.json', {'reason': 'Retained archive metadata and transient Node PM2 polling consume reserve',
               'freshProcess': True, 'polling': 'owned proc identity and HTTPS', 'memoryThresholdsUnchanged': True, 'application': app})
    stopped = swapped = False
    try:
        phase = 'existing-app-only-swap'
        prior.pm2('stop', '0'); stopped = True
        prior.save(binding, attempt.BINDING)
        prior.WEB.rename(previous); candidate.rename(prior.WEB); swapped = True
        prior.pm2('restart', '0')
        wait_ready()
        current = identity()
        phase = 'low-memory-stability-verification'
        minimum = prior.resources()
        for _ in range(6):
            time.sleep(5)
            assert identity() == current
            prior.probe()
            minimum = min(minimum, prior.resources())
        count = prior.verify_files(prior.WEB, before['target'])
        assert attempt.state() == before['state'] and prior.public() == before['public']
        assert identity() == current and json.loads(binding.read_bytes()) == attempt.BINDING
        # No app registration/configuration changed, so the existing saved PM2
        # definition remains exact. A new PM2 save is unnecessary.
        assert json.loads((prior.HOME / '.pm2/dump.pm2').read_bytes()) == dump
        result = {'status': 'PASS', 'operation': 'deploy-current-core-review', 'sourceCommit': before['target'],
                  'artifactSha256': before['archive'], 'verifiedFiles': count, 'process': current,
                  'minimumAvailableKiB': minimum, 'actualCaseReadcheck': 'PASS', 'privateStateUnchanged': True,
                  'publicDigestsUnchanged': True, 'priorRollbackVerified': True, 'memoryThresholdsUnchanged': True,
                  'providerRequests': 0, 'databaseWrites': 0, 'ownerPasswordLoginTested': False}
        prior.save(ROOT / 'resource-continuation-result.json', result)
        print(json.dumps(result), flush=True)
    except Exception:
        failed = phase
        prior.save(ROOT / 'resource-continuation-failure.json', {'phase': phase, 'stateUnchanged': attempt.state() == before['state']})
        if stopped:
            prior.pm2('stop', '0')
            if binding.exists(): binding.rename(ROOT / 'resource-continuation-failed-binding.json')
            if swapped:
                prior.WEB.rename(ROOT / 'resource-continuation-failed-candidate'); previous.rename(prior.WEB)
            prior.verify_files(prior.WEB, attempt.OLD)
            prior.pm2('restart', '0'); wait_ready()
            assert attempt.state() == before['state'] and prior.public() == before['public']
            prior.save(ROOT / 'resource-continuation-rollback.json', {'status': 'PASS', 'sourceCommit': attempt.OLD, 'failedPhase': failed})
        raise


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        line = traceback.extract_tb(error.__traceback__)[-1].lineno
        print(json.dumps({'status': 'BLOCKED', 'stage': phase, 'type': type(error).__name__, 'line': line}), flush=True)
        sys.exit(1)
