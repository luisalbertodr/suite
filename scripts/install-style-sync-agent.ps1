# Task Scheduler: mantener style-sync-agent Node en ejecucion (arranque al logon + cada 5 min).
param(
    [string]$StyleRoot = "C:\Duna\Style-Suite-Test",
    [string]$TaskName = "SuiteStyleSyncAgent",
    [string]$AgentDir = ""
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
if (-not $AgentDir) {
    $AgentDir = Join-Path $RepoRoot "style-sync-agent"
}

$AgentDir = [IO.Path]::GetFullPath($AgentDir)
$StyleRoot = [IO.Path]::GetFullPath($StyleRoot.TrimEnd('\'))

Push-Location $AgentDir
npm run build 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { throw "npm run build fallo en $AgentDir" }
Pop-Location

$runner = Join-Path $StyleRoot "run_style_sync_agent.bat"
$bat = @"
@echo off
cd /d "$AgentDir"
powershell -NoProfile -Command "`$p=Get-CimInstance Win32_Process -Filter \"name='node.exe'\" -EA SilentlyContinue | Where-Object { `$_.CommandLine -match 'dist[/\\]index\.js' } | Select-Object -First 1; if(`$p){exit 0}else{exit 1}"
if %ERRORLEVEL%==0 exit /b 0
start /B node --max-old-space-size=8192 dist/index.js >> agent-run.log 2>&1
"@
Set-Content -Path $runner -Value $bat -Encoding ASCII

$vbs = Join-Path $StyleRoot "run_style_sync_agent_hidden.vbs"
$vbsContent = @"
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = "$AgentDir"
sh.Run Chr(34) & "$runner" & Chr(34), 0, False
"@
Set-Content -Path $vbs -Value $vbsContent -Encoding ASCII

$tr = 'wscript.exe //B "' + $vbs + '"'
$registered = $false
try {
    $action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "//B `"$vbs`"" -WorkingDirectory $AgentDir
    $triggerBoot = New-ScheduledTaskTrigger -AtLogOn
    $triggerRepeat = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) `
        -RepetitionInterval (New-TimeSpan -Minutes 5) `
        -RepetitionDuration (New-TimeSpan -Days 3650)
    $settings = New-ScheduledTaskSettingsSet `
        -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
        -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 2) `
        -Hidden
    Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger @($triggerBoot, $triggerRepeat) -Settings $settings -Force -ErrorAction Stop | Out-Null
    $registered = $true
    Write-Host "OK Task $TaskName (Register-ScheduledTask)" -ForegroundColor Green
} catch {
    Write-Warning "Register-ScheduledTask: $($_.Exception.Message)"
}

if (-not $registered) {
    schtasks /Delete /TN $TaskName /F 2>$null | Out-Null
    schtasks /Delete /TN "${TaskName}Repeat" /F 2>$null | Out-Null
    $null = schtasks /Create /TN $TaskName /TR $tr /SC MINUTE /MO 5 /IT /F 2>&1
    $q = schtasks /Query /TN $TaskName 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "OK Task $TaskName (schtasks cada 5 min, usuario actual)" -ForegroundColor Green
    } else {
        Write-Warning "No se pudo registrar tarea. Usa IniciarStyle.bat al arrancar Style."
    }
}

Start-Process wscript.exe -ArgumentList "//B `"$vbs`"" -WindowStyle Hidden
Start-Sleep -Seconds 2
Write-Host "Agente v0.2.2 en $AgentDir (Style: $StyleRoot)" -ForegroundColor Cyan
