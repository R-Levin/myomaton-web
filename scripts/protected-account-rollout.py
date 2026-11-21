"""Exact targeted protected-Core swap; no database, provider or WordPress calls."""
import hashlib
import base64
import json
import os
import pathlib
import shutil
import stat
import subprocess
import sys
import tarfile
import time
import urllib.request

HOME = pathlib.Path('/home/virtual/vps-bef564/e/e494602172')
PRIVATE = HOME / 'miopages-private-acceptance'
RUN = PRIVATE / 'update-6a728ea'
WEB = HOME / 'public_html'
CANDIDATE = RUN / 'candidate'
PREVIOUS = RUN / 'previous-runtime-4df15c1'
OLD = '4df15c1693a0b49edeee9f18fb2fd6379c9f3f7b'
NEW = '6a728ea6066fa30592815bf5b9fea45dac0bf268'
APPROVAL = 'd0aa1d64b2ca934a115b83448b9d75124966461057220835628fd77a2c852460'
ARCHIVE = 'cf0f2f3bd28c731da25ce6b049f843c8775bb6b32d90d6032937c02a6f727e6a'
CLI = PRIVATE / 'hosted-c0-3bf0209a/pm2-client/node_modules/pm2/bin/pm2'
phase = 'configuration'


def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for block in iter(lambda: f.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def save(path, value):
    with path.open('x', encoding='utf-8') as f:
        os.chmod(path, 0o600)
        json.dump(value, f, sort_keys=True)
        f.write('\n')
        f.flush()
        os.fsync(f.fileno())


def pm2(*args):
    env = {'HOME': str(HOME), 'PM2_HOME': str(HOME / '.pm2'), 'PATH': '/usr/bin:/bin'}
    assert (HOME / '.pm2/rpc.sock').is_socket()
    assert (HOME / '.pm2/rpc.sock').stat().st_uid == os.getuid()
    os.kill(int((HOME / '.pm2/pm2.pid').read_text().strip()), 0)
    result = subprocess.run(['/usr/bin/node', str(CLI), *args], env=env, capture_output=True, timeout=20)
    assert result.returncode == 0, 'Package-local PM2 command failed'
    return result.stdout


def application(status=None):
    records = json.loads(pm2('jlist'))
    assert len(records) == 1
    app = records[0]
    e = app['pm2_env']
    assert app['name'] == 'miopages-protected-core' and app['pm_id'] == 0
    assert e['pm_cwd'] == str(WEB) and e['pm_exec_path'] == str(WEB / '.rehearsal/private-listener.cjs')
    if status:
        assert e['status'] == status
    return {'pid': app['pid'], 'status': e['status'], 'restarts': e['restart_time']}


def verify_files(root, expected):
    b = json.loads((root / 'rehearsal-build.json').read_bytes())
    assert b['sourceCommit'] == expected and b['isolatedRuntimeSmoke'] == 'PASS'
    for name, hashed in b['files'].items():
        p = root / name
        assert p.resolve() == p and p.is_file() and digest(p) == hashed, 'Build identity failed'
    for name, target in b['symlinks'].items():
        assert os.readlink(root / name) == target
    return len(b['files'])


def public():
    result = []
    for url in ['https://runtime.miopages.com/', 'https://miopages.com/']:
        with urllib.request.urlopen(url, timeout=12) as r:
            assert r.status == 200
            result.append(hashlib.sha256(r.read()).hexdigest())
    return result


def private_state():
    names = ['core-config.json', 'core-input.json', 'presence-workflow-grant.json', 'core-usage/onboarding-usage.json']
    return {name: digest(PRIVATE / name) for name in names}


def resources():
    available = int(next(x.split()[1] for x in pathlib.Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:')))
    assert available >= 524288
    assert shutil.disk_usage(RUN).free >= 3 * 1024 ** 3
    return available


def probe():
    with urllib.request.urlopen('https://wp-acceptance.miopages.com/core', timeout=12) as r:
        assert r.status == 200
        assert 'no-store' in r.headers.get('Cache-Control', '')
        html = r.read().decode('utf-8')
        # The sign-in form appears after hydration and a refused anonymous API
        # read; inspect it with the separate real browser check, not SSR text.
        assert 'MioPages' in html
    req = urllib.request.Request('https://wp-acceptance.miopages.com/api/protected-core', headers={'X-Intake-Request': '1'})
    try:
        urllib.request.urlopen(req, timeout=12)
        raise AssertionError('Anonymous protected API accepted')
    except urllib.error.HTTPError as error:
        assert error.code == 401


def stage():
    global phase
    phase = 'stage-preflight'
    assert application('stopped') == {'pid': 0, 'status': 'stopped', 'restarts': 10}
    assert not CANDIDATE.exists() and not PREVIOUS.exists()
    resources()
    verify_files(WEB, OLD)
    assert digest(RUN / 'manifest.json') == APPROVAL and digest(RUN / 'protected-core-linux-x64.tar.gz') == ARCHIVE
    before = {'public': public(), 'private': private_state(), 'application': application('stopped')}
    assert before['private']['core-input.json'] == 'deec4f52ddf038776b511276929db7151b26c5f7a64355be3642ed43a0963041'
    save(RUN / 'before.json', before)
    phase = 'matching-rollback-archive'
    backup = RUN / 'rollback-4df15c1.tar.gz'
    assert not backup.exists()
    with tarfile.open(backup, 'w:gz', compresslevel=1, dereference=False) as t:
        t.add(WEB, arcname='application', recursive=True)
    os.chmod(backup, 0o600)
    checked = 0
    with tarfile.open(backup, 'r:gz') as t:
        for item in t:
            assert item.name == 'application' or item.name.startswith('application/')
            local = WEB / pathlib.PurePosixPath(item.name).relative_to('application')
            if item.isfile():
                h = hashlib.sha256()
                stream = t.extractfile(item)
                for block in iter(lambda: stream.read(1024 * 1024), b''):
                    h.update(block)
                assert h.hexdigest() == digest(local)
                checked += 1
            elif item.issym():
                assert os.readlink(local) == item.linkname
            else:
                assert item.isdir()
    save(RUN / 'rollback-verification.json', {'sha256': digest(backup), 'regularFilesVerified': checked, 'sourceCommit': OLD})
    print(json.dumps({'stage': 'matching-rollback-verified', 'files': checked}), flush=True)
    phase = 'stage-candidate'
    CANDIDATE.mkdir(mode=0o700)
    with tarfile.open(RUN / 'protected-core-linux-x64.tar.gz', 'r:gz') as t:
        for item in t.getmembers():
            assert not item.name.startswith('/') and '..' not in pathlib.PurePosixPath(item.name).parts
            assert item.isfile() or item.isdir()  # This exact artifact has no symlinks.
        t.extractall(CANDIDATE)
    os.chmod(CANDIDATE, 0o700)
    for name in ['package.json', 'package-lock.json']:
        assert digest(WEB / name) == digest(CANDIDATE / name), 'Dependency change refused'
    assert (WEB / 'node_modules').resolve() == WEB / 'node_modules'
    shutil.copytree(WEB / 'node_modules', CANDIDATE / 'node_modules', symlinks=True)
    for name in ['.env', 'ecosystem.config.js']:
        assert (WEB / name).resolve() == WEB / name
        shutil.copy2(WEB / name, CANDIDATE / name)
        assert digest(WEB / name) == digest(CANDIDATE / name)
    verify_files(CANDIDATE, NEW)
    assert WEB.stat().st_dev == CANDIDATE.stat().st_dev
    assert private_state() == before['private'] and public() == before['public']
    save(RUN / 'stage-evidence.json', {'status': 'PASS', 'sourceCommit': NEW, 'rollbackFilesVerified': checked})
    print(json.dumps({'status': 'PASS', 'operation': 'stage-protected-core', 'sourceCommit': NEW, 'rollbackVerified': True}), flush=True)


def resume_stage():
    """Finish only the diagnosed, exact Playwright addition; never bypass a
    changed runtime dependency graph or repeat/overwrite a failed swap."""
    global phase
    phase = 'verified-dependency-completion'
    assert not (RUN / 'stage-evidence.json').exists() and not PREVIOUS.exists()
    before = json.loads((RUN / 'before.json').read_bytes())
    assert application('stopped') == before['application']
    assert digest(RUN / 'rollback-4df15c1.tar.gz') == json.loads((RUN / 'rollback-verification.json').read_bytes())['sha256']
    verify_files(WEB, OLD)
    verify_files(CANDIDATE, NEW)
    resources()
    assert private_state() == before['private'] and public() == before['public']
    old = json.loads((WEB / 'package.json').read_bytes())
    new = json.loads((CANDIDATE / 'package.json').read_bytes())
    declared = json.loads(json.dumps(new))
    assert declared['devDependencies'].pop('playwright-core') == '1.63.0'
    assert declared == old, 'Additional package change refused'
    old_lock = json.loads((WEB / 'package-lock.json').read_bytes())
    new_lock = json.loads((CANDIDATE / 'package-lock.json').read_bytes())
    expected = json.loads(json.dumps(new_lock))
    package = expected['packages'].pop('node_modules/playwright-core')
    assert expected['packages']['']['devDependencies'].pop('playwright-core') == '1.63.0'
    assert expected == old_lock, 'Additional lockfile change refused'
    archive = RUN / 'playwright-core-1.63.0.tgz'
    assert package['integrity'] == 'sha512-' + base64.b64encode(hashlib.sha512(archive.read_bytes()).digest()).decode()
    assert not (CANDIDATE / 'node_modules').exists()
    shutil.copytree(WEB / 'node_modules', CANDIDATE / 'node_modules', symlinks=True)
    target = CANDIDATE / 'node_modules/playwright-core'
    target.mkdir()
    with tarfile.open(archive, 'r:gz') as t:
        for item in t.getmembers():
            assert item.name.startswith('package/') and '..' not in pathlib.PurePosixPath(item.name).parts
            assert item.isfile() or item.isdir()
            relative = pathlib.PurePosixPath(item.name).relative_to('package')
            path = target / relative
            if item.isdir():
                path.mkdir(parents=True, exist_ok=True)
            else:
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(t.extractfile(item).read())
                os.chmod(path, item.mode & 0o777)
    executable = CANDIDATE / 'node_modules/.bin/playwright-core'
    assert not executable.exists() and not executable.is_symlink()
    executable.symlink_to('../playwright-core/cli.js')
    hidden = CANDIDATE / 'node_modules/.package-lock.json'
    installed = json.loads(hidden.read_bytes())
    assert 'node_modules/playwright-core' not in installed['packages']
    installed['packages']['node_modules/playwright-core'] = package
    hidden.write_text(json.dumps(installed, indent=2) + '\n')
    probe_module = subprocess.run(['/usr/bin/node', '-e', "const p=require('./node_modules/playwright-core/package.json');if(p.version!=='1.63.0'||!require('./node_modules/playwright-core').chromium)process.exit(1)"],
                                  cwd=CANDIDATE, capture_output=True, timeout=12)
    assert probe_module.returncode == 0
    for name in ['.env', 'ecosystem.config.js']:
        shutil.copy2(WEB / name, CANDIDATE / name)
        assert digest(WEB / name) == digest(CANDIDATE / name)
    verify_files(CANDIDATE, NEW)
    assert private_state() == before['private'] and public() == before['public']
    save(RUN / 'stage-evidence.json', {'status': 'PASS', 'sourceCommit': NEW, 'rollbackVerified': True,
         'exactDependencyAddition': 'playwright-core@1.63.0', 'dependencyArchiveSha256': digest(archive), 'linuxImport': 'PASS'})
    print(json.dumps({'status': 'PASS', 'operation': 'stage-protected-core', 'sourceCommit': NEW, 'rollbackVerified': True,
                      'dependencyIntegrityVerified': True, 'linuxImport': 'PASS'}), flush=True)


def deploy(account=True, corrected_probe=False, label=None):
    global phase
    assert (RUN / 'stage-evidence.json').is_file() and not (RUN / 'deployment-evidence.json').exists()
    before = json.loads((RUN / 'before.json').read_bytes())
    assert application('stopped') == before['application']
    verify_files(WEB, OLD)
    verify_files(CANDIDATE, NEW)
    resources()
    assert private_state() == before['private'] and public() == before['public']
    for name in (['account-cycle-scope.json', 'account-cycle-workflow-grant.json', 'core-account-cycle-usage/onboarding-usage.json'] if account else []):
        p = PRIVATE / name
        assert p.resolve() == p and p.is_file() and p.stat().st_uid == os.getuid() and stat.S_IMODE(p.stat().st_mode) == 0o600
    if not account:
        assert not (PRIVATE / 'account-cycle-scope.json').exists()
    assert not PREVIOUS.exists()
    swapped = False
    try:
        phase = 'swap-existing-app'
        WEB.rename(PREVIOUS)
        CANDIDATE.rename(WEB)
        swapped = True
        phase = 'start-existing-pm2-entry'
        pm2('restart', '0')
        for attempt in range(20):
            try:
                probe()
                break
            except Exception:
                if attempt == 19:
                    raise
                time.sleep(2)
        phase = 'stable-runtime-verification'
        current = application('online')
        assert current['pid'] > 1 and current['restarts'] in [before['application']['restarts'], before['application']['restarts'] + 1]
        # Manual start accounting differs across PM2 versions; any subsequent
        # restart is unexpected. Compare actual identity/count across the window.
        for _ in range(3):
            time.sleep(5)
            assert application('online') == current
            probe()
        verify_files(WEB, NEW)
        assert private_state() == before['private'] and public() == before['public']
        pm2('save', '--force')
        saved = json.loads((HOME / '.pm2/dump.pm2').read_bytes())
        assert len(saved) == 1 and saved[0]['name'] == 'miopages-protected-core'
        result = {'status': 'PASS', 'operation': 'deploy-protected-core', 'sourceCommit': NEW, 'application': current,
                  'publicDigestsMatch': True, 'protectedStateMatches': True, 'rollbackUsed': False}
        result['accountCapabilityEnabled'] = account
        save(RUN / ('deployment-evidence.json' if account else 'review-deployment-evidence.json'), result)
        print(json.dumps(result), flush=True)
    except Exception:
        phase_before_rollback = phase
        save(RUN / (f'failure-evidence-{label}.json' if label else 'failure-evidence-corrected-probe.json' if corrected_probe else 'failure-evidence.json'),
             {'phase': phase_before_rollback, 'application': application(), 'protectedStateMatches': private_state() == before['private']})
        phase = 'restore-matching-previous-build'
        if swapped:
            pm2('stop', '0')
            application('stopped')
            WEB.rename(RUN / 'failed-candidate')
            PREVIOUS.rename(WEB)
        elif PREVIOUS.exists() and not WEB.exists():
            PREVIOUS.rename(WEB)
        verify_files(WEB, OLD)
        pm2('restart', '0')
        time.sleep(4)
        probe()
        assert private_state() == before['private'] and public() == before['public']
        save(RUN / (f'rollback-evidence-{label}.json' if label else 'rollback-evidence.json'), {'status': 'PASS', 'sourceCommit': OLD, 'failedPhase': phase_before_rollback})
        phase = phase_before_rollback
        raise


def corrected_probe_deploy():
    """One evidence-based continuation after the diagnosed SSR-text assertion.
    Requires the previous build restored and independently verified first."""
    assert (RUN / 'rollback-independent-verification.json').is_file()
    assert not (RUN / 'corrected-probe-attempt.json').exists()
    before = json.loads((RUN / 'before.json').read_bytes())
    verify_files(WEB, OLD)
    verify_files(RUN / 'failed-candidate', NEW)
    assert not CANDIDATE.exists() and not PREVIOUS.exists()
    assert private_state() == before['private'] and public() == before['public']
    current = application('online')
    assert current['restarts'] == before['application']['restarts']
    save(RUN / 'corrected-probe-attempt.json', {'reason': 'Client-rendered sign-in was incorrectly required in SSR HTML', 'previousApplication': current})
    pm2('stop', '0')
    assert application('stopped') == before['application']
    (RUN / 'failed-candidate').rename(CANDIDATE)
    deploy(False, True)


def lazy_research_correction():
    """Tested purpose-bound code correction under the approved scope. Preserve
    original artifacts/failures and both resource thresholds unchanged."""
    global NEW, CANDIDATE
    assert not (RUN / 'lazy-research-attempt.json').exists()
    before = json.loads((RUN / 'before.json').read_bytes())
    verify_files(WEB, OLD)
    assert application('online')['restarts'] == before['application']['restarts']
    assert private_state() == before['private'] and public() == before['public']
    assert digest(RUN / 'rollback-4df15c1.tar.gz') == json.loads((RUN / 'rollback-verification.json').read_bytes())['sha256']
    archive = RUN / 'protected-core-4058a74-linux-x64.tar.gz'
    assert digest(archive) == '0630236ad669e7f3555d560af940a00a1df61faae90f3e9c727d92685011db70'
    NEW = '4058a74f5b88c5392563b236dab8258107c66d81'
    CANDIDATE = RUN / 'candidate-4058a74'
    assert not CANDIDATE.exists() and not PREVIOUS.exists()
    resources()
    CANDIDATE.mkdir(mode=0o700)
    with tarfile.open(archive, 'r:gz') as t:
        for item in t.getmembers():
            assert not item.name.startswith('/') and '..' not in pathlib.PurePosixPath(item.name).parts
            assert item.isfile() or item.isdir()
        t.extractall(CANDIDATE)
    os.chmod(CANDIDATE, 0o700)
    previous_candidate = RUN / 'failed-candidate'
    for name in ['package.json', 'package-lock.json']:
        assert digest(CANDIDATE / name) == digest(previous_candidate / name)
    shutil.copytree(previous_candidate / 'node_modules', CANDIDATE / 'node_modules', symlinks=True)
    for name in ['.env', 'ecosystem.config.js']:
        shutil.copy2(WEB / name, CANDIDATE / name)
    verify_files(CANDIDATE, NEW)
    save(RUN / 'lazy-research-attempt.json', {'baseApprovalSha256': APPROVAL, 'sourceCommit': NEW,
        'artifactSha256': digest(archive), 'linuxRun': 44838020904, 'reason': 'Defer research-browser initialization during Core review',
        'memoryThresholdsUnchanged': True, 'priorFailurePreserved': True})
    pm2('stop', '0')
    assert application('stopped') == before['application']
    deploy(False, True, 'lazy-research')


def account_review_documents(plan, legacy_ledger, research_sources, now_ms):
    """Configure review using the existing ledger/provider contract. Dispatch
    stays revoked until a real confirmed correction has exact derived pins."""
    assert plan['provider']['maximumAdditionalUsd'] == 3
    assert plan['provider']['maximumGenerations'] == 12
    assert plan['provider']['maximumRequestsIncludingCounts'] == 24
    rates = dict(legacy_ledger['rateCard'])
    assert rates['model'] == 'gpt-5.4-mini-2026-03-17'
    assert [rates[k] for k in ['inputPerMillion', 'cachedPerMillion', 'outputPerMillion', 'countMicros']] == [750000, 75000, 4500000, 0]
    stable = lambda value: json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(',', ':')).encode()
    fingerprint = lambda value: hashlib.sha256(stable(value)).hexdigest()
    # Preserve the existing JS canonical rate-card digest: Python's key ordering
    # differs from localeCompare for camelCase keys. Never re-hash it differently.
    ledger = {'ratesDigest': legacy_ledger['ratesDigest'], 'rateCard': rates,
              'adapterVersion': 'onboarding-responses/1', 'model': rates['model'], 'tier': 'default', 'attempts': []}
    ledger_bytes = json.dumps(ledger, ensure_ascii=False, separators=(',', ':')).encode() + b'\n'
    actual_rates = {'model': plan['provider']['model'], 'verifiedOn': plan['provider']['ratesVerifiedOn'],
                    'inputPerMillion': 2500000, 'cachedPerMillion': 250000, 'cacheWritePerMillion': 0,
                    'outputPerMillion': 15000000, 'countMicros': 0}
    assert actual_rates['model'] == 'gpt-5.4-2026-03-05'
    stage = {'rates': actual_rates, 'requestInputTokens': 96000, 'requestOutputTokens': 16384,
             'cumulativeInputTokens': 1152000, 'cumulativeOutputTokens': 196608, 'capMicros': 3000000}
    grant = {'contextDigest': plan['data']['retainedContextDigest'],
             'approvedSources': plan['data']['approvedOriginalSourceDigests'], 'approvedCorrections': [],
             'researchSources': research_sources, 'researchResponseBytes': 1000000,
             'maxRetries': 0, 'maxEditorialRevisions': 12, 'maxCommercialReplans': 12,
             'maxOutputTokens': 16384, 'expiresAt': now_ms - 1, 'revoked': True,
             'ledger': {'id': fingerprint({'approval': APPROVAL, 'purpose': 'account-cycle-review'}),
                        'startingLedger': hashlib.sha256(ledger_bytes).hexdigest(), 'baselineAttempts': 0,
                        'requests': 24, 'generations': 12, 'capMicros': 3000000,
                        'inputTokens': 96000, 'inputBytes': 1000000, 'stageSpendingPolicy': 'shared-aggregate',
                        'stages': {name: dict(stage) for name in ['research', 'report', 'direction', 'blueprint', 'page', 'revision', 'editorial']}}}
    scope = {'schema': 'protected-account-cycle/1', 'ownerId': plan['identity']['reuseOwnerId'],
             'webPresenceId': plan['scope']['webPresenceId'], 'managedSiteId': plan['scope']['managedSiteId']}
    return scope, grant, ledger_bytes


def enable_account_review():
    """Enable only the approved account scope on the verified existing build.
    Preserve the original grant/ledger and restore review configuration on failure."""
    global phase
    phase = 'account-review-preflight'
    assert not (RUN / 'account-review-before.json').exists()
    assert verify_files(WEB, '4058a74f5b88c5392563b236dab8258107c66d81') == 205
    current = application('online')
    assert current['restarts'] == 10
    before = json.loads((RUN / 'before.json').read_bytes())
    assert private_state() == before['private'] and public() == before['public']
    assert digest(RUN / 'rollback-4df15c1.tar.gz') == json.loads((RUN / 'rollback-verification.json').read_bytes())['sha256']
    assert digest(RUN / 'manifest.json') == APPROVAL
    plan = json.loads((RUN / 'manifest.json').read_bytes())
    readback_file = RUN / 'account-database-verification.json'
    assert readback_file.resolve() == readback_file and readback_file.stat().st_uid == os.getuid() and stat.S_IMODE(readback_file.stat().st_mode) == 0o600
    readback = json.loads(readback_file.read_bytes())
    assert readback['operation'] == 'independent-protected-account-readback' and readback['status'] == 'PASS'
    assert readback['newGrants'] == 3 and readback['draftVersion'] == 28 and readback['workflowRevision'] == 41
    assert all(readback[k] for k in ['tlsCertificateValidated', 'identityAndCredentialUnchanged', 'knowledgeUnchanged', 'guardUnchanged', 'noRawPublicTablePrivileges', 'forcedRls'])
    legacy = json.loads((PRIVATE / 'presence-workflow-grant.json').read_bytes())
    assert legacy['contextDigest'] == plan['data']['retainedContextDigest']
    assert sorted(legacy['approvedSources']) == sorted(plan['data']['approvedOriginalSourceDigests'])
    names = ['account-cycle-scope.json', 'account-cycle-workflow-grant.json', 'core-account-cycle-usage']
    assert all(not (PRIVATE / name).exists() and not (PRIVATE / name).is_symlink() for name in names)
    resources()
    save(RUN / 'account-review-before.json', {'application': current, 'private': private_state(),
         'public': before['public'], 'sqlIndependentReadbackRequired': True, 'ownerAuthorizationIssueComment': 7054044894})
    stopped = False
    try:
        phase = 'account-review-stop-existing-entry'
        pm2('stop', '0')
        stopped = True
        assert application('stopped')['restarts'] == current['restarts']
        legacy_ledger = json.loads((PRIVATE / 'core-usage/onboarding-usage.json').read_bytes())
        scope, grant, ledger = account_review_documents(plan, legacy_ledger, legacy['researchSources'], int(time.time() * 1000))
        directory = PRIVATE / 'core-account-cycle-usage'
        directory.mkdir(mode=0o700)
        with (directory / 'onboarding-usage.json').open('xb') as f:
            os.chmod(f.fileno(), 0o600)
            f.write(ledger)
            f.flush()
            os.fsync(f.fileno())
        save(PRIVATE / 'account-cycle-workflow-grant.json', grant)
        save(PRIVATE / 'account-cycle-scope.json', scope)
        phase = 'account-review-start-existing-entry'
        pm2('restart', '0')
        for attempt in range(20):
            try:
                probe()
                break
            except Exception:
                if attempt == 19:
                    raise
                time.sleep(2)
        online = application('online')
        assert online['restarts'] in [current['restarts'], current['restarts'] + 1]
        for _ in range(3):
            time.sleep(5)
            assert application('online') == online
            resources()
            probe()
        assert private_state() == before['private'] and public() == before['public']
        assert verify_files(WEB, '4058a74f5b88c5392563b236dab8258107c66d81') == 205
        pm2('save', '--force')
        saved = json.loads((HOME / '.pm2/dump.pm2').read_bytes())
        assert len(saved) == 1 and saved[0]['name'] == 'miopages-protected-core'
        result = {'status': 'PASS', 'operation': 'enable-protected-account-review', 'application': online,
                  'sourceCommit': '4058a74f5b88c5392563b236dab8258107c66d81',
                  'accountCapabilityEnabled': True, 'providerDispatchRevoked': True,
                  'aiWindowStarted': False, 'privateStateMatches': True, 'publicDigestsMatch': True}
        save(RUN / 'account-review-evidence.json', result)
        print(json.dumps(result), flush=True)
    except Exception:
        failed_phase = phase
        save(RUN / 'account-review-failure.json', {'phase': failed_phase, 'application': application()})
        if stopped:
            pm2('stop', '0')
            for name in names:
                p = PRIVATE / name
                if p.exists():
                    p.rename(RUN / ('failed-account-review-' + name))
            pm2('restart', '0')
            time.sleep(4)
            probe()
            assert private_state() == before['private'] and public() == before['public']
            save(RUN / 'account-review-rollback.json', {'status': 'PASS', 'failedPhase': failed_phase,
                 'providerDispatchRevoked': True, 'databaseHistoryPreserved': True})
        phase = failed_phase
        raise


if __name__ == '__main__':
    try:
        assert sys.platform == 'linux' and pathlib.Path.home().resolve() == HOME
        for directory in [PRIVATE, RUN, WEB]:
            assert directory.resolve() == directory and directory.stat().st_uid == os.getuid() and stat.S_IMODE(directory.stat().st_mode) == 0o700
        assert len(sys.argv) == 2 and sys.argv[1] in ['STAGE', 'RESUME-STAGE', 'DEPLOY', 'RESTORE-REVIEW', 'CORRECTED-PROBE-DEPLOY', 'LAZY-RESEARCH-CORRECTION', 'ENABLE-ACCOUNT-REVIEW']
        {'STAGE': stage, 'RESUME-STAGE': resume_stage, 'DEPLOY': deploy, 'RESTORE-REVIEW': lambda: deploy(False),
         'CORRECTED-PROBE-DEPLOY': corrected_probe_deploy, 'LAZY-RESEARCH-CORRECTION': lazy_research_correction,
         'ENABLE-ACCOUNT-REVIEW': enable_account_review}[sys.argv[1]]()
    except Exception as error:
        import traceback
        location = traceback.extract_tb(error.__traceback__)[-1]
        print(json.dumps({'status': 'BLOCKED', 'operation': 'protected-core-rollout', 'stage': phase, 'errorType': type(error).__name__,
                          'sourceFile': pathlib.Path(location.filename).name, 'sourceLine': location.lineno}), flush=True)
        sys.exit(1)
