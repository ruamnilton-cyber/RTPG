$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$nodeCandidates = @(
  (Join-Path $projectRoot "..\nodejs\node-v20.20.2-win-x64"),
  "C:\Users\ruamn\OneDrive\Desktop\trabalhos em python\nodejs\node-v20.20.2-win-x64"
)
$localNode = $nodeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
$npmCmd = if ($localNode -and (Test-Path (Join-Path $localNode "npm.cmd"))) { Join-Path $localNode "npm.cmd" } else { "npm" }

Push-Location $projectRoot
try {
  if ($localNode -and (Test-Path $localNode)) {
    $env:Path = "$localNode;$env:Path"
  }
  & $npmCmd run dev
}
finally {
  Pop-Location
}
