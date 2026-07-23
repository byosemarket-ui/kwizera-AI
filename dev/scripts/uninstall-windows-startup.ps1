# Remove KWIZERA AI STUDIO Windows auto-start task.

$ErrorActionPreference = "Stop"
$TaskName = "KWIZERA-AI-STUDIO-Dev"

$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "Removed scheduled task: $TaskName"
} else {
    Write-Host "No scheduled task found: $TaskName"
}
