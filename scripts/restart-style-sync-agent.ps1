# Reinicia style-sync-agent: mata el Node que bloquea agent-run.log, espera, y arranca de nuevo.
$ErrorActionPreference = 'Stop'
$AgentDir = 'C:\Style-Dunasoft\style-sync-agent'
$LogFile  = Join-Path $AgentDir 'agent-run.log'
$NodeExe  = Join-Path $AgentDir 'runtime\node.exe'

if (-not (Test-Path $NodeExe)) {
    Write-Error "No existe $NodeExe"
    exit 1
}

$procs = Get-CimInstance Win32_Process -Filter "name='node.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -match 'style-sync-agent.*dist[/\\]index\.js' }

if ($procs) {
    Write-Host "Deteniendo $($procs.Count) proceso(s) del agente..."
    foreach ($p in $procs) {
        Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
        Write-Host "  PID $($p.ProcessId) terminado"
    }
} else {
    Write-Host "No habia proceso del agente en ejecucion."
}

# Liberar el handle de agent-run.log (el error que viste)
$deadline = (Get-Date).AddSeconds(15)
while ((Get-Date) -lt $deadline) {
    try {
        $fs = [System.IO.File]::Open($LogFile, [System.IO.FileMode]::Append, [System.IO.FileAccess]::Write, [System.IO.FileShare]::Read)
        $fs.Close()
        break
    } catch {
        Start-Sleep -Milliseconds 500
    }
}

$stamp = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffZ')
Add-Content -Path $LogFile -Value "[$stamp] === agent restart (plan2009_poll) ==="

Set-Location $AgentDir
$arg = '--max-old-space-size=8192 dist/index.js >> agent-run.log 2>&1'
Start-Process -FilePath 'cmd.exe' -ArgumentList "/c `"$NodeExe`" $arg" -WorkingDirectory $AgentDir -WindowStyle Hidden

Start-Sleep -Seconds 4
$alive = Get-CimInstance Win32_Process -Filter "name='node.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -match 'style-sync-agent.*dist[/\\]index\.js' } |
    Select-Object -First 1

if ($alive) {
    Write-Host "OK Agente reiniciado (PID $($alive.ProcessId))." -ForegroundColor Green
    Write-Host "Comprueba el log: $LogFile" -ForegroundColor Cyan
    exit 0
}

Write-Error "El agente no arranco. Revisa $LogFile"
exit 1
