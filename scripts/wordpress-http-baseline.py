"""Read-only protected WordPress baseline. No credentials in files or arguments."""

import argparse
import base64
import getpass
import json
import os
from pathlib import Path
import re
import subprocess
import sys
from datetime import datetime, timezone

PHP_CODE = r'''
try {
    $input = json_decode(stream_get_contents(STDIN), true, 8, JSON_THROW_ON_ERROR);
    if (!is_array($input) || !is_string($input['user'] ?? null) || $input['user'] === ''
        || str_contains($input['user'], ':') || !is_string($input['password'] ?? null) || $input['password'] === '') {
        throw new RuntimeException('Missing existing HTTP credential.');
    }
    $passes = [];
    for ($i = 0; $i < 2; $i++) {
        $curl = curl_init('https://miopages.org/');
        curl_setopt_array($curl, [
            CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_CONNECTTIMEOUT => 10, CURLOPT_TIMEOUT => 20,
            CURLOPT_SSL_VERIFYPEER => true, CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_HTTPAUTH => CURLAUTH_BASIC,
            CURLOPT_USERPWD => $input['user'] . ':' . $input['password'],
        ]);
        try {
            $body = curl_exec($curl);
            $status = curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
            if (!is_string($body) || strlen($body) > 8388608 || $status !== 200) {
                throw new RuntimeException('Authenticated baseline refused.');
            }
            $passes[] = ['httpStatus' => 200, 'bytes' => strlen($body), 'bodySha256' => hash('sha256', $body)];
        } finally { curl_close($curl); }
    }
    if ($passes[0] !== $passes[1]) { throw new RuntimeException('Unstable response baseline.'); }
    unset($input);
    echo json_encode(['status' => 'PASS', 'origin' => 'https://miopages.org',
        'authenticatedHttpBaseline' => $passes[0], 'consecutiveResponses' => 2,
        'verifiedTls' => true, 'hostedWrites' => 0, 'credentialsStored' => false]) . "\n";
} catch (Throwable $error) {
    fwrite(STDERR, "Authenticated WordPress baseline refused or failed. No credential rotation or hosted change attempted.\n");
    exit(1);
}
'''


def capture_baseline(user, password, runner=subprocess.run):
    if not user or ":" in user or not password:
        raise ValueError("Existing HTTP Basic Auth credential unavailable or invalid. No guessing or reset.")
    source = base64.b64encode(PHP_CODE.encode("utf-8")).decode("ascii")
    # Only static source is in argv. The credential travels on encrypted stdin.
    command = "/usr/php84/usr/bin/php -r 'eval(base64_decode($argv[1]));' " + source
    result = runner(
        ["ssh", "-o", "BatchMode=yes", "-o", "IdentitiesOnly=yes", "-o", "StrictHostKeyChecking=yes",
         "-o", "ConnectTimeout=10", "-i", str(Path.home() / ".ssh" / "miopages_wp_20i"),
         "-p", "22", "miopages.org@ssh.us.stackcp.com", command],
        input=json.dumps({"user": user, "password": password}, ensure_ascii=False).encode("utf-8"),
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=70, check=False,
    )
    if result.returncode != 0:
        raise RuntimeError("SSH or authenticated HTTP baseline failed. Stop; no automatic retry or credential rotation.")
    data = json.loads(result.stdout)
    baseline = data.get("authenticatedHttpBaseline", {})
    if not (data.get("status") == "PASS" and data.get("origin") == "https://miopages.org"
            and baseline.get("httpStatus") == 200 and type(baseline.get("bytes")) is int
            and 0 < baseline["bytes"] <= 8388608
            and isinstance(baseline.get("bodySha256"), str)
            and re.fullmatch(r"[a-f0-9]{64}", baseline["bodySha256"])
            and data.get("consecutiveResponses") == 2 and data.get("verifiedTls") is True
            and data.get("hostedWrites") == 0 and data.get("credentialsStored") is False):
        raise RuntimeError("Unexpected baseline receipt. Stop.")
    return {"status": "PASS", "origin": "https://miopages.org",
            "authenticatedHttpBaseline": {"httpStatus": 200, "bytes": baseline["bytes"], "bodySha256": baseline["bodySha256"]},
            "consecutiveResponses": 2, "verifiedTls": True, "hostedWrites": 0, "credentialsStored": False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    password = None
    try:
        if not sys.stdin.isatty():
            raise RuntimeError("Use an interactive local console for hidden credential input.")
        user = input("Existing miopages.org HTTP Basic Auth username (not WordPress admin): ")
        password = getpass.getpass("Existing HTTP Basic Auth password (blank stops): ")
        evidence = capture_baseline(user, password)
        password = None
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
        output = args.output or Path(__file__).resolve().parent.parent / "runtime-content" / ("wordpress-http-baseline-" + stamp + ".json")
        output = output.resolve()
        output.parent.mkdir(parents=True, exist_ok=True)
        with output.open("x", encoding="utf-8", newline="\n") as file:
            json.dump(evidence, file, indent=2)
            file.write("\n")
            file.flush()
            os.fsync(file.fileno())
        print("PASS: authenticated read-only baseline saved to " + str(output))
        return 0
    except (Exception, KeyboardInterrupt):
        print("BLOCKED: credential, SSH, HTTPS stability or local receipt validation failed. No automatic retry or hosted change attempted.", file=sys.stderr)
        return 1
    finally:
        password = None


if __name__ == "__main__":
    raise SystemExit(main())
