# Install KWIZERA AI STUDIO persistent dev environment to start at Windows logon.
# Run once: npm run install:startup

$ErrorActionPreference = "Stop"
$TaskName = "KWIZERA-AI-STUDIO-Dev"
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$Launcher = Join-Path $PSScriptRoot "launch-persistent.bat"

if (-not (Test-Path $Launcher)) {
    Write-Error "Launcher not found: $Launcher"
}

$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

$Action = New-ScheduledTaskAction -Execute $Launcher -WorkingDirectory $ProjectRoot
$Trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$Settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Hours 0)

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $Action `
    -Trigger $Trigger `
    -Settings $Settings `
    -Description "KWIZERA AI STUDIO — Persistent local development environment (offline, localhost only)" `
    -RunLevel Limited | Out-Null

Write-Host ""
Write-Host "  KWIZERA AI STUDIO — Windows auto-start installed"
Write-Host "  Task name: $TaskName"
Write-Host "  Starts at Windows logon, opens localhost dashboard"
Write-Host "  Storage: D:\KWIZERA-AI-STUDIO"
Write-Host ""
Write-Host "  To remove: npm run uninstall:startup"
Write-Host ""
