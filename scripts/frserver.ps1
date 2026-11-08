# frserver.ps1 - lifecycle for the FineReport web server that ships with the install (Tomcat in server/lib).
#   Why: web-interaction verification needs the real webapp; starting the DESIGNER GUI is not acceptable
#   for automation. This script boots the shipped Tomcat headlessly against webapps/webroot:
#     start  - prepare a temp catalina.base under logs (copies server/conf, rewrites appBase +
#              common.loader to absolute install paths, connector port), start Bootstrap detached,
#              wait for /webroot/decision to answer 200, write logs/frserver.pid
#     status - pid alive? HTTP status of /webroot/decision
#     stop   - stop ONLY the pid this script started (never touches other java processes)
#   The production install files are never modified (temp base only). ASCII-only (PS 5.1 GBK lesson).
#   Usage: powershell -File scripts\frserver.ps1 start [-Port 8705] [-FrHome D:\software\FineReport_11.0]
param(
  [Parameter(Mandatory = $true)][ValidateSet('start', 'stop', 'status')][string]$Action,
  [int]$Port = 8705,
  [string]$FrHome = '',
  [string]$Base = '',
  [int]$TimeoutSec = 600
)
$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
if (-not $FrHome) { $FrHome = if ($env:FR_HOME) { $env:FR_HOME } else { 'D:\software\FineReport_11.0' } }
if (-not $Base) { $Base = Join-Path $RepoRoot 'logs\frserver_base' }
$pidFile = Join-Path $RepoRoot 'logs\frserver.pid'
$outLog = Join-Path $RepoRoot 'logs\frserver.out.log'
$errLog = Join-Path $RepoRoot 'logs\frserver.err.log'

function Get-ServerPid() {
  if (-not (Test-Path -LiteralPath $pidFile)) { return 0 }
  $raw = ('' + (Get-Content -LiteralPath $pidFile -ErrorAction SilentlyContinue | Select-Object -First 1)).Trim()
  $n = 0
  if ([int]::TryParse($raw, [ref]$n)) { return $n }
  return 0
}
function Test-ProcessAlive([int]$procId) {
  if ($procId -le 0) { return $false }
  $p = Get-Process -Id $procId -ErrorAction SilentlyContinue
  return ($null -ne $p)
}
function Probe-Http([int]$p) {
  # follow redirects: /webroot/decision 302 -> /login 200 is READY (FR is serving); a non-2xx final
  # answer or a connection error stays 0. Reading Response off a 302 exception is unreliable in PS 5.1.
  try {
    $r = Invoke-WebRequest -Uri ("http://127.0.0.1:" + $p + "/webroot/decision") -UseBasicParsing -TimeoutSec 10
    return [int]$r.StatusCode
  } catch {
    return 0
  }
}
function Prepare-Base() {
  foreach ($d in @($Base, (Join-Path $Base 'conf'), (Join-Path $Base 'work'), (Join-Path $Base 'logs'), (Join-Path $Base 'temp'))) {
    New-Item -ItemType Directory -Force -Path $d | Out-Null
  }
  Copy-Item (Join-Path $FrHome 'server\conf\*') (Join-Path $Base 'conf\') -Force
  $sxPath = Join-Path $Base 'conf\server.xml'
  $sx = [System.IO.File]::ReadAllText($sxPath, [System.Text.Encoding]::UTF8)
  $sx = $sx.Replace('appBase="webapps"', ('appBase="' + ($FrHome -replace '\\', '/') + '/webapps"'))
  $sx = [regex]::Replace($sx, 'Connector port="\d+"', ('Connector port="' + $Port + '"'), 1)
  [System.IO.File]::WriteAllText($sxPath, $sx, (New-Object System.Text.UTF8Encoding($false)))
  $cpPath = Join-Path $Base 'conf\catalina.properties'
  $lines = [System.IO.File]::ReadAllLines($cpPath, [System.Text.Encoding]::UTF8)
  $root = ($FrHome -replace '\\', '/')
  $loader = 'common.loader="' + $root + '/lib","' + $root + '/lib/*.jar","' + $root + '/server/lib","' + $root + '/server/lib/*.jar","' + $root + '/webapps/webroot/WEB-INF/lib","' + $root + '/webapps/webroot/WEB-INF/lib/*.jar"'
  for ($i = 0; $i -lt $lines.Count; $i++) { if ($lines[$i].StartsWith('common.loader=')) { $lines[$i] = $loader } }
  [System.IO.File]::WriteAllLines($cpPath, $lines, (New-Object System.Text.UTF8Encoding($false)))
}
function Wait-Ready([int]$procId, [int]$timeout) {
  $deadline = (Get-Date).AddSeconds($timeout)
  while ((Get-Date) -lt $deadline) {
    if (-not (Test-ProcessAlive $procId)) { return 0 }
    $code = Probe-Http $Port
    if ($code -eq 200 -or $code -eq 302) { return $code }
    Start-Sleep -Seconds 5
  }
  return 0
}

if ($Action -eq 'status') {
  $procId = Get-ServerPid
  $alive = Test-ProcessAlive $procId
  $code = if ($alive) { Probe-Http $Port } else { 0 }
  Write-Output ('FRSERVER status pid=' + $procId + ' alive=' + $alive + ' http=' + $code + ' port=' + $Port)
  exit $(if ($alive -and $code -gt 0) { 0 } else { 1 })
}
if ($Action -eq 'stop') {
  $procId = Get-ServerPid
  if (Test-ProcessAlive $procId) {
    Stop-Process -Id $procId -Force
    Start-Sleep -Seconds 3
    Write-Output ('FRSERVER stopped pid=' + $procId)
  } else { Write-Output 'FRSERVER not running (no live pidfile)' }
  Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
  exit 0
}
# start
$existing = Get-ServerPid
if (Test-ProcessAlive $existing) {
  $code = Probe-Http $Port
  if ($code -gt 0) { Write-Output ('FRSERVER already running pid=' + $existing + ' http=' + $code); exit 0 }
}
$java = Join-Path $FrHome 'jre\bin\java.exe'
if (-not (Test-Path -LiteralPath $java)) { Write-Output ('FRSERVER FAIL java missing: ' + $java); exit 3 }
Prepare-Base
$cp = @(
  (Join-Path $FrHome 'server\lib\*'),
  (Join-Path $FrHome 'lib\*'),
  (Join-Path $FrHome 'webapps\webroot\WEB-INF\lib\*'),
  (Join-Path $FrHome 'webapps\webroot\WEB-INF\classes')
) -join ';'
$jargs = @(
  '-Xmx1500m',
  ('-Dcatalina.base=' + $Base),
  ('-Dcatalina.home=' + $Base),
  '-Dfile.encoding=UTF-8',
  ('-Dfine.home=' + $FrHome),
  '-cp', $cp,
  'org.apache.catalina.startup.Bootstrap', 'start'
)
$proc = Start-Process -FilePath $java -ArgumentList $jargs -RedirectStandardOutput $outLog -RedirectStandardError $errLog -PassThru -WindowStyle Hidden
Set-Content -LiteralPath $pidFile -Value ([string]$proc.Id) -Encoding ASCII
Write-Output ('FRSERVER starting pid=' + $proc.Id + ' port=' + $Port + ' base=' + $Base)
$code = Wait-Ready $proc.Id $TimeoutSec
if ($code -eq 0) {
  if (Test-ProcessAlive $proc.Id) { Stop-Process -Id $proc.Id -Force }
  Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
  Write-Output ('FRSERVER FAIL not ready within ' + $TimeoutSec + 's (see ' + $errLog + ')')
  exit 1
}
Write-Output ('FRSERVER ready http=' + $code + ' pid=' + $proc.Id)
exit 0
