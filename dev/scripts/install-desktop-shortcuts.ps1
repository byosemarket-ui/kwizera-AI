# Create Desktop + Start Menu shortcuts for KWIZERA AI STUDIO.
# Points at the stable launcher (not a temp path). Re-run after relocating the repo.
# Usage: npm run install:shortcuts

$ErrorActionPreference = "Stop"
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$Launcher = Join-Path $PSScriptRoot "launch-kwizera-desktop.bat"
$Icon = Join-Path $ProjectRoot "electron\assets\icon.ico"
$Unpacked = Join-Path $ProjectRoot "release\win-unpacked\KWIZERA AI STUDIO.exe"

if (-not (Test-Path $Launcher)) {
    Write-Error "Launcher not found: $Launcher"
}

$TargetPath = $Launcher
$WorkingDir = $ProjectRoot
if (Test-Path $Unpacked) {
    $TargetPath = $Unpacked
    $WorkingDir = Split-Path $Unpacked -Parent
    Write-Host "Using packaged EXE: $Unpacked"
} else {
    Write-Host "Using stable launcher: $Launcher"
    Write-Host "(Pack with npm run desktop:pack for a standalone EXE shortcut target.)"
}

$Wsh = New-Object -ComObject WScript.Shell

function New-KwizeraShortcut([string]$Path, [string]$Description) {
    $dir = Split-Path $Path -Parent
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    $sc = $Wsh.CreateShortcut($Path)
    $sc.TargetPath = $TargetPath
    $sc.WorkingDirectory = $WorkingDir
    $sc.Description = $Description
    $sc.WindowStyle = 1
    if (Test-Path $Icon) {
        $sc.IconLocation = "$Icon,0"
    }
    $sc.Save()
    Write-Host "Created: $Path"
}

$Desktop = [Environment]::GetFolderPath("Desktop")
$StartMenu = Join-Path ([Environment]::GetFolderPath("StartMenu")) "Programs\KWIZERA AI STUDIO"

New-KwizeraShortcut (Join-Path $Desktop "KWIZERA AI STUDIO.lnk") "Launch KWIZERA AI STUDIO"
New-KwizeraShortcut (Join-Path $StartMenu "KWIZERA AI STUDIO.lnk") "Launch KWIZERA AI STUDIO"

Write-Host ""
Write-Host "  KWIZERA AI STUDIO shortcuts installed"
Write-Host "  Desktop + Start Menu → stable launcher / packaged EXE"
Write-Host "  After desktop:pack, re-run this script to point at the unpacked EXE."
Write-Host ""
