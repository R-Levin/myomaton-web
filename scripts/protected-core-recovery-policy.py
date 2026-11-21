"""Bounded recovery for the existing persistent Core app; no provider/work retry."""
import importlib.util
import json
import os
import pathlib
import re
import shutil
import signal
import sys
import time
import traceback

ROOT = pathlib.Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('memory_fix', ROOT / 'protected-core-memory-fix.py')
fix = importlib.util.module_from_spec(spec); spec.loader.exec_module(fix)
prior = fix.prior
POLICY = {'autorestart': True, 'restart_delay': 15000, 'min_uptime': 60000, 'max_restarts': 3}
phase = 'preflight'


def rewrite_policy(source):
    assert len(re.findall(r'\bautorestart\s*:\s*false\b', source)) == 1
    assert not any(re.search(r'\b' + key + r'\s*:', source) for key in POLICY if key != 'autorestart')
    return re.sub(r'\bautorestart\s*:\s*false\b', 'autorestart: true, restart_delay: 15000, min_uptime: 60000, max_restarts: 3', source, count=1)


def current():
    rows = json.loads(prior.pm2('jlist')); assert len(rows) == 1
    app = rows[0]; env = app['pm2_env']
    assert app['name'] == 'miopages-protected-core' and app['pm_id'] == 0
    assert env['pm_cwd'] == str(prior.WEB) and env['pm_exec_path'] == str(prior.WEB / '.rehearsal/private-listener.cjs')
    assert env['args'] == ['--core']
    return app


def main():
    global phase
    assert len(sys.argv) == 2 and sys.argv[1] == 'ENABLE-BOUNDED-CORE-RECOVERY'
    assert ROOT == prior.PRIVATE / 'core-memory-653e0b1' and pathlib.Path.home().resolve() == prior.HOME
    assert json.loads((ROOT / 'result.json').read_bytes())['status'] == 'PASS'
    assert not (ROOT / 'recovery-policy-before.json').exists()
    config = prior.WEB / 'ecosystem.config.js'; original = config.read_bytes()
    revised = rewrite_policy(original.decode('utf-8')).encode('utf-8')
    before = {'state': fix.private_state(), 'public': prior.public(), 'configSha256': prior.digest(config)}
    prior.save(ROOT / 'recovery-policy-before.json', before)
    backup = ROOT / 'previous-ecosystem.config.js'; shutil.copy2(config, backup); os.chmod(backup, 0o600)
    shutil.copy2(prior.HOME / '.pm2/dump.pm2', ROOT / 'previous-pm2-dump.json'); os.chmod(ROOT / 'previous-pm2-dump.json', 0o600)
    stopped = changed = False
    try:
        phase = 'same-app-policy-update'
        prior.pm2('stop', '0'); stopped = True
        assert current()['pm2_env']['autorestart'] is False
        with config.with_suffix('.new').open('xb') as stream:
            os.chmod(stream.name, 0o600); stream.write(revised); stream.flush(); os.fsync(stream.fileno())
        import subprocess
        checked = subprocess.run(['/usr/bin/node', '--check', '--input-type=commonjs'], input=revised, capture_output=True)
        assert checked.returncode == 0
        config.with_suffix('.new').replace(config); changed = True
        prior.pm2('restart', str(config), '--only', 'miopages-protected-core'); fix.wait_ready()
        app = current(); assert app['pm2_env']['status'] == 'online'
        assert all(app['pm2_env'].get(key) == value for key, value in POLICY.items())
        prior.pm2('save', '--force')
        phase = 'one-controlled-recovery'
        pid, started = fix.pid_identity(); assert pid == app['pid']
        os.kill(pid, signal.SIGTERM)
        recovered = None
        for _ in range(40):
            time.sleep(1)
            try:
                candidate = fix.pid_identity()
                if candidate[0] != pid: recovered = candidate; break
            except (OSError, AssertionError, ValueError): pass
        assert recovered is not None
        fix.wait_ready()
        phase = 'stable-recovered-core'
        for _ in range(12):
            time.sleep(5); assert fix.pid_identity() == recovered; prior.probe()
        final = current()
        assert final['pid'] == recovered[0] and final['pm2_env']['restart_time'] == app['pm2_env']['restart_time'] + 1
        assert all(final['pm2_env'].get(key) == value for key, value in POLICY.items())
        assert fix.private_state() == before['state'] and prior.public() == before['public']
        prior.verify_files(prior.WEB, fix.BASE)
        result = {'status': 'PASS', 'operation': 'bounded-core-process-recovery', 'policy': POLICY,
                  'previousPid': pid, 'pid': recovered[0], 'started': recovered[1], 'exactlyOneRecovery': True,
                  'stableAfterRecoverySeconds': 60, 'applicationCount': 1, 'privateStateUnchanged': True,
                  'publicDigestsUnchanged': True, 'providerRequests': 0, 'databaseWrites': 0, 'workReplayEnabled': False}
        prior.save(ROOT / 'recovery-policy-result.json', result); print(json.dumps(result), flush=True)
    except Exception:
        prior.save(ROOT / 'recovery-policy-failure.json', {'phase': phase})
        if stopped:
            prior.pm2('stop', '0')
            if changed: shutil.copy2(backup, config)
            prior.pm2('restart', str(config), '--only', 'miopages-protected-core'); fix.wait_ready()
            assert current()['pm2_env']['autorestart'] is False
            prior.pm2('save', '--force')
            prior.save(ROOT / 'recovery-policy-rollback.json', {'status': 'PASS', 'privateStateUnchanged': fix.private_state() == before['state']})
        raise


if __name__ == '__main__':
    try: main()
    except Exception as error:
        line = traceback.extract_tb(error.__traceback__)[-1].lineno
        print(json.dumps({'status': 'BLOCKED', 'stage': phase, 'type': type(error).__name__, 'line': line}), flush=True)
        sys.exit(1)
