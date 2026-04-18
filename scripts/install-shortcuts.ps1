$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$desktopPath = [Environment]::GetFolderPath("Desktop")
$startupPath = [Environment]::GetFolderPath("Startup")
$iconPath = Join-Path $env:SystemRoot "System32\SHELL32.dll"

$shell = New-Object -ComObject WScript.Shell

$desktopShortcut = $shell.CreateShortcut((Join-Path $desktopPath "RTPG Gestao.lnk"))
$desktopShortcut.TargetPath = "powershell.exe"
$desktopShortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$projectRoot\scripts\launch-rtpg.ps1`""
$desktopShortcut.WorkingDirectory = $projectRoot
$desktopShortcut.IconLocation = "$iconPath,220"
$desktopShortcut.Description = "Abrir RTPG Gestao"
$desktopShortcut.Save()

$startupShortcut = $shell.CreateShortcut((Join-Path $startupPath "RTPG Gestao Auto.lnk"))
$startupShortcut.TargetPath = "powershell.exe"
$startupShortcut.Arguments = "-NoProfile -WindowStyle Minimized -ExecutionPolicy Bypass -File `"$projectRoot\scripts\launch-rtpg.ps1`" -NoBrowser"
$startupShortcut.WorkingDirectory = $projectRoot
$startupShortcut.IconLocation = "$iconPath,220"
$startupShortcut.Description = "Iniciar RTPG Gestao automaticamente com o Windows"
$startupShortcut.Save()

Write-Output "Atalho criado na Area de Trabalho: $(Join-Path $desktopPath 'RTPG Gestao.lnk')"
Write-Output "Inicializacao automatica criada em: $(Join-Path $startupPath 'RTPG Gestao Auto.lnk')"
