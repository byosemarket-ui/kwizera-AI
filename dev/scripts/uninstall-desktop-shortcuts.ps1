# Remove Desktop + Start Menu shortcuts created by install-desktop-shortcuts.ps1

$ErrorActionPreference = "Continue"
$Desktop = [Environment]::GetFolderPath("Desktop")
$StartMenu = Join-Path ([Environment]::GetFolderPath("StartMenu")) "Programs\KWIZERA AI STUDIO"

$paths = @(
    (Join-Path $Desktop "KWIZERA AI STUDIO.lnk"),
    (Join-Path $StartMenu "KWIZERA AI STUDIO.lnk")
)

foreach ($p in $paths) {
    if (Test-Path $p) {
        Remove-Item $p -Force
        Write-Host "Removed: $p"
    }
}

if (Test-Path $StartMenu) {
    $left = Get-ChildItem $StartMenu -ErrorAction SilentlyContinue
    if (-not $left -or $left.Count -eq 0) {
        Remove-Item $StartMenu -Force -ErrorAction SilentlyContinue
    }
}

Write-Host "Shortcut uninstall complete."
