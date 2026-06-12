# Diagnóstico sync Style → Suite. Ejecutar en C:\Style-Dunasoft (o Z:\Style-Dunasoft).
$root = if ($PSScriptRoot) { $PSScriptRoot } else { Get-Location }
Set-Location $root

$traceHelp = @{
    '[BOOT-00]' = 'general.prg arrancó; intenta cargar unlock'
    '[BOOT-01]' = 'SuiteStartSyncIfReady llamado'
    '[BOOT-02]' = 'SuiteApplyFullUnlock ejecutado (o no disponible)'
    '[BOOT-03]' = 'unlock ya estaba cargado'
    '[BOOT-04]' = 'OK: suite_full_unlock embebido en duna.exe'
    '[BOOT-05]' = 'exe sin Suite_SyncInit; probando PROGS\'
    '[BOOT-06]' = 'cargando suite_full_unlock desde fichero externo'
    '[BOOT-06E]' = 'fichero externo falló al cargar'
    '[BOOT-07]' = 'FALLO: no hay suite_full_unlock en exe ni PROGS\'
    '[BOOT-08]' = 'sync ya activa (no re-inicia)'
    '[BOOT-09]' = 'llamando Suite_SyncInit'
    '[INIT-01]' = 'Suite_SyncInit entrada'
    '[INIT-02]' = 'FALLO: falta SuiteSync.cfg'
    '[INIT-03]' = 'cfg leída OK'
    '[INIT-04]' = 'FALLO: SYNC_URL o SYNC_TOKEN vacíos'
    '[INIT-05]' = 'primer ciclo pull/push'
    '[INIT-06]' = 'timer periódico activo'
    '[INIT-06E]' = 'timer no arrancó'
    'CYCLE inicio' = 'ciclo sync en curso'
    'CYCLE fin' = 'ciclo sync terminado'
    'HTTP error' = 'fallo red/SSL al llamar Supabase'
}

Write-Host "=== Diagnóstico sync Suite ===" -ForegroundColor Cyan
Write-Host "Carpeta: $root`n"

$checks = @(
    @{ Name = 'duna.exe'; Path = Join-Path $root 'duna.exe' },
    @{ Name = 'SuiteSync.cfg'; Path = Join-Path $root 'SuiteSync.cfg' },
    @{ Name = 'PROGS\general.fxp'; Path = Join-Path $root 'PROGS\general.fxp' },
    @{ Name = 'PROGS\funciones.fxp'; Path = Join-Path $root 'PROGS\funciones.fxp' },
    @{ Name = 'PROGS\suite_full_unlock.fxp'; Path = Join-Path $root 'PROGS\suite_full_unlock.fxp' },
    @{ Name = 'PROGS\suite_full_unlock.prg'; Path = Join-Path $root 'PROGS\suite_full_unlock.prg' }
)

foreach ($c in $checks) {
    if (Test-Path $c.Path) {
        $fi = Get-Item $c.Path
        Write-Host "[OK] $($c.Name) ($($fi.Length) bytes, $($fi.LastWriteTime))" -ForegroundColor Green
    } else {
        Write-Host "[FALTA] $($c.Name)" -ForegroundColor $(if ($c.Name -match 'suite_full_unlock') { 'Yellow' } else { 'Red' })
    }
}

$log = Join-Path $root 'Usuarios\_suite_sync.log'
if (Test-Path $log) {
    Write-Host "`n=== Últimas 25 líneas del log ===" -ForegroundColor Cyan
    $lines = Get-Content $log -Tail 25
    $lines | ForEach-Object { Write-Host $_ }

    $lastTrace = $lines | Where-Object { $_ -match '\[(BOOT|INIT|MANUAL)-' } | Select-Object -Last 1
    if ($lastTrace) {
        $code = ([regex]::Matches($lastTrace, '\[(BOOT|INIT|MANUAL)-[^\]]+\]') | ForEach-Object { $_.Value }) | Select-Object -First 1
        if ($code -and $traceHelp.ContainsKey($code)) {
            Write-Host "`nÚltima fase: $code" -ForegroundColor Cyan
            Write-Host "  → $($traceHelp[$code])" -ForegroundColor White
        }
    }

    if ($lines -notmatch 'INIT-03|INIT ok') {
        Write-Host "`n[PROBLEMA] La sync no llegó a INIT-03 (cfg OK). Revisa fases BOOT arriba." -ForegroundColor Red
    }
    if ($lines -match 'BOOT-07') {
        Write-Host "[PROBLEMA] suite_full_unlock no está en el exe. ReFox Replace o copiar PROGS\suite_full_unlock.fxp" -ForegroundColor Red
    }
    if ($lines -match 'INIT-02|INIT-04') {
        Write-Host "[PROBLEMA] SuiteSync.cfg incompleto o mal ubicado" -ForegroundColor Red
    }
} else {
    Write-Host "`n[SIN LOG] Usuarios\_suite_sync.log no existe" -ForegroundColor Red
    Write-Host "  → general.prg del exe NO ejecutó SuiteBootstrapLog (exe viejo sin parche)" -ForegroundColor Yellow
    Write-Host "  → o Style no arrancó desde la carpeta con Usuarios\" -ForegroundColor Yellow
}

$cfgPath = Join-Path $root 'SuiteSync.cfg'
if (Test-Path $cfgPath) {
    $cfg = @{}
    Get-Content $cfgPath | ForEach-Object {
        if ($_ -match '^\s*([^#=]+)=(.*)$') { $cfg[$matches[1].Trim()] = $matches[2].Trim() }
    }
    if (-not $cfg['SYNC_URL'] -or -not $cfg['SYNC_TOKEN']) {
        Write-Host "`n[ERROR] SuiteSync.cfg sin SYNC_URL o SYNC_TOKEN" -ForegroundColor Red
    } else {
        Write-Host "`nProbando red (stylegetreservas)..." -ForegroundColor Cyan
        try {
            $body = "id=$($cfg['SYNC_TOKEN'])&tag=stylegetreservas"
            $r = Invoke-WebRequest -Uri $cfg['SYNC_URL'] -Method POST -ContentType 'application/x-www-form-urlencoded' -Body $body -UseBasicParsing -TimeoutSec 30
            Write-Host "HTTP $($r.StatusCode) — red OK ($($r.Content.Length) bytes)" -ForegroundColor Green
        } catch {
            Write-Host "Red/SSL falló: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
}

Write-Host "`nEn VFP (ventana Style): ? Suite_SyncDiag()" -ForegroundColor Yellow
Write-Host "Ctrl+F5 = reiniciar sync manual | Ctrl+F6 = parar timer" -ForegroundColor Yellow
