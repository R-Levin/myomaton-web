param(
  [Parameter(Mandatory=$true)][string]$BackupRoot,
  [string]$NodePath = (Get-Command node -ErrorAction Stop).Source
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$backupRepository = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
Push-Location -LiteralPath $backupRepository
try {
  $backupOutput = & $NodePath --env-file=.env.local --import tsx scripts/backup-recovery.ts backup --root $BackupRoot
  if ($LASTEXITCODE -ne 0) { throw 'Backup failed. No successful scheduled run is claimed.' }
  $backupReceipt = ($backupOutput -join "`n") | ConvertFrom-Json
  $verifyOutput = & $NodePath --env-file=.env.local --import tsx scripts/backup-recovery.ts verify --root $BackupRoot --point $backupReceipt.id
  if ($LASTEXITCODE -ne 0) { throw 'Backup verification failed. No successful scheduled run is claimed.' }
  $verifiedReceipt = ($verifyOutput -join "`n") | ConvertFrom-Json
  if (-not $verifiedReceipt.verified) { throw 'Backup verification did not confirm success.' }
  $backupOutput
  $verifyOutput
} finally {
  Pop-Location
}
