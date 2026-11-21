"""Install only the removable preview annotation; never mutate WordPress records."""
import hashlib
import json
import os
import pathlib
import subprocess
import sys

HOME = pathlib.Path('/home/sites/36a/9/9fe7ae6df4')
WEB = HOME / 'public_html'
ROOT = pathlib.Path(__file__).resolve().parent
STAGE = HOME / 'miopages-private/native-draft-d84ebc69-46d5-4c64-adc6-ac7b87468f89/stage-36f5dbff'
TARGET = WEB / 'wp-content/mu-plugins/miopages-temporary-review-guide.php'
PHP = '/usr/php84/usr/bin/php'
EXPECTED = '42c7060518c24ddb08b6104e4560a5ed701028dc9d74867bacf85dd1f12c5ddb'


def wp(*args):
    result = subprocess.run([PHP, '/usr/local/bin/wp', '--path=' + str(WEB),
        '--require=' + str(STAGE / 'wordpress-stage-c0-visual-media.php'), '--user=1', *args],
        cwd=STAGE, capture_output=True, timeout=45)
    assert result.returncode == 0, 'Read-only WordPress verification refused'
    return result.stdout


def readback():
    result = json.loads(wp('eval-file', str(STAGE / 'wordpress-stage-c0-visual-readback.php'), 'verify-apply'))
    assert result['status'] == 'PASS' and result['revision'] == 6 and result['digest'] == EXPECTED
    assert len(result['pages']) == 13 and result['images'] == 2
    return result


def main():
    assert len(sys.argv) == 2 and len(sys.argv[1]) == 64
    assert pathlib.Path.home().resolve() == HOME and ROOT.parent == HOME / 'miopages-private'
    assert ROOT.name == 'temporary-review-guide-20261121'
    for directory in [ROOT, TARGET.parent]:
        assert directory.resolve() == directory and directory.stat().st_uid == os.getuid()
    assert not TARGET.exists(), 'Inspect existing guide instead of overwriting it'
    source = ROOT / 'wordpress-temporary-review-guide.php'
    assert source.resolve() == source and source.stat().st_uid == os.getuid()
    data = source.read_bytes()
    assert hashlib.sha256(data).hexdigest() == sys.argv[1]
    assert 'wp_body_open();' in (WEB / 'wp-includes/template-canvas.php').read_text()
    before = readback()
    with (ROOT / 'before.json').open('x') as file:
        os.chmod(file.name, 0o600); json.dump(before, file)
    temporary = TARGET.with_suffix('.pending')
    try:
        with temporary.open('xb') as file:
            os.chmod(file.name, 0o644); file.write(data); file.flush(); os.fsync(file.fileno())
        os.replace(temporary, TARGET)
        assert hashlib.sha256(TARGET.read_bytes()).hexdigest() == sys.argv[1]
        assert readback() == before
        # Real installed WordPress, existing scoped admin identity in CLI only.
        # No browser credential/session is created. Exercise body hook for each Page.
        code = '''$state = get_option('miopages_native_draft_' . hash('sha256', 'd84ebc69-46d5-4c64-adc6-ac7b87468f89'));
if (is_string($state)) $state = json_decode($state, true, 48, JSON_THROW_ON_ERROR);
$ids = array_values(array_map(static fn($r) => $r['ID'], $state['current']['posts']));
foreach ($ids as $id) {
    $GLOBALS['wp_query']->is_preview = true; $GLOBALS['wp_query']->queried_object_id = $id;
    ob_start(); do_action('wp_body_open'); $html = ob_get_clean();
    if (!str_contains($html, 'Actual WordPress draft') || !str_contains($html, 'revision 6')) throw new Exception('Guide refused');
}
echo wp_json_encode(['status'=>'PASS','pages'=>count($ids),'writes'=>false]);'''
        verified = json.loads(wp('eval', code))
        assert verified == {'status': 'PASS', 'pages': 13, 'writes': False}
        result = {'status': 'PASS', 'operation': 'temporary-wordpress-review-guide', 'pages': 13,
            'sha256': sys.argv[1], 'signedContentUnchanged': True, 'databaseWrites': False,
            'browserLoginTested': False, 'rollback': 'Remove only ' + str(TARGET)}
        with (ROOT / 'result.json').open('x') as file:
            os.chmod(file.name, 0o600); json.dump(result, file)
        print(json.dumps(result))
    except Exception:
        if TARGET.exists() and hashlib.sha256(TARGET.read_bytes()).hexdigest() == sys.argv[1]:
            TARGET.unlink()
        if temporary.exists():
            temporary.unlink()
        assert readback() == before
        raise


if __name__ == '__main__':
    try:
        main()
    except Exception:
        print(json.dumps({'status': 'BLOCKED', 'operation': 'temporary-wordpress-review-guide',
                          'requirement': 'Inspect preserved receipt; do not retry automatically.'}))
        sys.exit(1)
