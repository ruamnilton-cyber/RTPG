$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$nodeCandidates = @(
  (Join-Path $projectRoot "..\nodejs\node-v20.20.2-win-x64"),
  "C:\Users\ruamn\OneDrive\Desktop\trabalhos em python\nodejs\node-v20.20.2-win-x64"
)
$localNode = $nodeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
$nodeExe = if ($localNode -and (Test-Path (Join-Path $localNode "node.exe"))) { Join-Path $localNode "node.exe" } else { "node" }
$npmCmd = if ($localNode -and (Test-Path (Join-Path $localNode "npm.cmd"))) { Join-Path $localNode "npm.cmd" } else { "npm" }
$localPython = Join-Path $env:LOCALAPPDATA "Python\bin\python.exe"
$pythonExe = if (Test-Path $localPython) { $localPython } elseif (Get-Command python -ErrorAction SilentlyContinue) { "python" } else { "py" }

Push-Location $projectRoot
try {
  if ($localNode -and (Test-Path $localNode)) {
    $env:Path = "$localNode;$env:Path"
  }
  & $npmCmd install
  & $nodeExe scripts/prisma-runner.mjs generate
  & $pythonExe scripts/bootstrap_db.py
  & $nodeExe scripts/prisma-runner.mjs db seed
}
finally {
  Pop-Location
}
