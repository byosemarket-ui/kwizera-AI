# KWIZERA AI STUDIO — Persistent local development launcher
# Starts the dev server if not running, then opens Chrome to the dashboard.

$ErrorActionPreference = "Stop"
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$Port = if ($env:KWIZERA_DEV_PORT) { [int]$env:KWIZERA_DEV_PORT } else { 5173 }
$BindHost = "127.0.0.1"
$DashboardUrl = "http://${BindHost}:${Port}"
$LogDir = Join-Path $env:KWIZERA_STORAGE_ROOT "logs"
$LogFile = Join-Path $LogDir "dev-launcher.log"

if (-not $env:KWIZERA_STORAGE_ROOT) {
    $env:KWIZERA_STORAGE_ROOT = "D:\KWIZERA-AI-STUDIO"
}
$env:KWIZERA_PERSISTENT_MODE = "1"

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

function Write-Log([string]$Message) {
    $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Message"
    Add-Content -Path $LogFile -Value $line
    Write-Host $line
}

function Test-ServerRunning {
    try {
        $response = Invoke-WebRequest -Uri "$DashboardUrl/api/health" -UseBasicParsing -TimeoutSec 3
        return $response.StatusCode -eq 200
    } catch {
        return $false
    }
}

function Start-DevServer {
    Write-Log "Starting KWIZERA AI STUDIO persistent dev server..."
    $npmCmd = if (Get-Command npm.cmd -ErrorAction SilentlyContinue) { "npm.cmd" } else { "npm" }
    Start-Process -FilePath $npmCmd -ArgumentList "run", "dev" -WorkingDirectory $ProjectRoot -WindowStyle Minimized
}

function Open-Dashboard {
    Write-Log "Opening Chrome at $DashboardUrl"
    Start-Process "chrome" $DashboardUrl
}

Set-Location $ProjectRoot

if (Test-ServerRunning) {
    Write-Log "Server already running — reconnecting to existing session"
    Open-Dashboard
    exit 0
}

Start-DevServer

$attempts = 0
$maxAttempts = 90
while ($attempts -lt $maxAttempts) {
    Start-Sleep -Seconds 2
    $attempts++
    if (Test-ServerRunning) {
        Write-Log "Server ready after $($attempts * 2) seconds"
        Open-Dashboard
        exit 0
    }
}

Write-Log "ERROR: Server did not become ready within $($maxAttempts * 2) seconds"
exit 1
