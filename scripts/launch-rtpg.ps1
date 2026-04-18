param(
  [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$nodeCandidates = @(
  (Join-Path $projectRoot "..\nodejs\node-v20.20.2-win-x64"),
  "C:\Users\ruamn\OneDrive\Desktop\trabalhos em python\nodejs\node-v20.20.2-win-x64"
)
$localNode = $nodeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
$npmCmd = if ($localNode -and (Test-Path (Join-Path $localNode "npm.cmd"))) { Join-Path $localNode "npm.cmd" } else { "npm" }
$serverUrl = "http://localhost:3333"
$healthUrl = "$serverUrl/api/health"
$driveDataDir = "G:\Meu Drive\RTPG\Gestor Bar"

if ($localNode -and (Test-Path $localNode)) {
  $env:Path = "$localNode;$env:Path"
}

if (Test-Path $driveDataDir) {
  $env:RTPG_DATA_DIR = $driveDataDir
}

$serverReady = $false
try {
  $response = Invoke-WebRequest -UseBasicParsing $healthUrl -TimeoutSec 3
  if ($response.StatusCode -eq 200) {
    $serverReady = $true
  }
}
catch {
  $serverReady = $false
}

if (-not $serverReady) {
  Start-Process powershell -WindowStyle Minimized -ArgumentList @(
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-Command", "Set-Location '$projectRoot'; `$env:Path='$localNode;' + `$env:Path; if (Test-Path '$driveDataDir') { `$env:RTPG_DATA_DIR='$driveDataDir' }; & '$npmCmd' run start"
  )

  Start-Sleep -Seconds 6
}

if (-not $NoBrowser) {
  Start-Process $serverUrl
}
