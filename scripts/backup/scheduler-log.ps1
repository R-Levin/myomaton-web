# Every scheduler log write uses UTF-8 without a BOM, including captured errors.
function Write-BackupSchedulerLog {
  param(
    [Parameter(Mandatory=$true)][string]$Path,
    [Parameter(Mandatory=$true)][AllowEmptyString()][string]$Entry,
    [switch]$Reset
  )
  $encoding = New-Object System.Text.UTF8Encoding($false)
  $line = $Entry + [Environment]::NewLine
  if ($Reset) {
    [IO.File]::WriteAllText($Path, $line, $encoding)
  } else {
    [IO.File]::AppendAllText($Path, $line, $encoding)
  }
}
