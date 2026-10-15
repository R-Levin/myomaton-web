import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

test("Windows PowerShell 5.1 scheduler logging preserves UTF-8 across reset, append, stdout and stderr",{skip:process.platform!=="win32"},async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),"backup-log-"));
  try {
    await writeFile(path.join(root,"output.cjs"),'console.log("stdout"); console.error("stderr"); process.exitCode=7;');
    const command=`$ErrorActionPreference='Stop'; . $env:BACKUP_LOG_HELPER
Write-BackupSchedulerLog -Path $env:BACKUP_LOG_TEST -Entry 'obsolete' -Reset
Write-BackupSchedulerLog -Path $env:BACKUP_LOG_TEST -Entry ('StartedUtc=2026-10-15; '+[char]0x00e9) -Reset
Write-BackupSchedulerLog -Path $env:BACKUP_LOG_TEST -Entry ('append '+[char]0x03bb)
$ErrorActionPreference='Continue'
& $env:BACKUP_LOG_NODE $env:BACKUP_LOG_FIXTURE 2>&1 | ForEach-Object { Write-BackupSchedulerLog -Path $env:BACKUP_LOG_TEST -Entry ([string]$_) }
$code=$LASTEXITCODE
$ErrorActionPreference='Stop'
if($code -ne 7){throw 'Native exit code lost'}
Write-BackupSchedulerLog -Path $env:BACKUP_LOG_TEST -Entry 'FailedUtc=2026-10-15; exit=7'
Write-BackupSchedulerLog -Path $env:BACKUP_LOG_TEST -Entry 'SuccessUtc=2026-10-15'
`;
    await promisify(execFile)(path.join(process.env.SystemRoot||"C:\\Windows","System32","WindowsPowerShell","v1.0","powershell.exe"),["-NoProfile","-NonInteractive","-ExecutionPolicy","RemoteSigned","-EncodedCommand",Buffer.from(command,"utf16le").toString("base64")],{env:{...process.env,BACKUP_LOG_HELPER:path.resolve("scripts/backup/scheduler-log.ps1"),BACKUP_LOG_TEST:path.join(root,"test.log"),BACKUP_LOG_FIXTURE:path.join(root,"output.cjs"),BACKUP_LOG_NODE:process.execPath},windowsHide:true});
    const bytes=await readFile(path.join(root,"test.log"));
    const text=new TextDecoder("utf-8",{fatal:true}).decode(bytes);
    assert.ok(!bytes.includes(0));assert.ok(!text.includes("\uFEFF"));
    assert.ok(!text.includes("obsolete"));
    for(const entry of ["StartedUtc=2026-10-15; é","append λ","stdout","stderr","FailedUtc=2026-10-15; exit=7","SuccessUtc=2026-10-15"])assert.ok(text.includes(entry),entry);
  } finally { await rm(root,{recursive:true}); }
});
