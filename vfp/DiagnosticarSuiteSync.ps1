# Ejecutar en la VM Style (C:\Style-Dunasoft) para diagnosticar por qué no arranca la sync.
$root = if ($PSScriptRoot) { $PSScriptRoot } else { Get-Location }
Set-Location $root

Write-Host "=== Diagnóstico sync Suite ===" -ForegroundColor Cyan
Write-Host "Carpeta: $root"

$checks = @(
    @{ Name = "duna.exe"; Path = Join-Path $root "duna.exe" },
    @{ Name = "SuiteSync.cfg"; Path = Join-Path $root "SuiteSync.cfg" },
    @{ Name = "suite_full_unlock.prg (fallback)"; Path = Join-Path $root "suite_full_unlock.prg" },
    @{ Name = "PROGS\suite_full_unlock.fxp"; Path = Join-Path $root "PROGS\suite_full_unlock.fxp" },
    @{ Name = "PROGS\suite_full_unlock.prg"; Path = Join-Path $root "PROGS\suite_full_unlock.prg" }
)

foreach ($c in $checks) {
    if (Test-Path $c.Path) {
        $fi = Get-Item $c.Path
        Write-Host "[OK] $($c.Name) ($($fi.Length) bytes, $($fi.LastWriteTime))" -ForegroundColor Green
    } else {
        Write-Host "[FALTA] $($c.Name)" -ForegroundColor Red
    }
}

$obsolete = Join-Path $root "suite_reservas_sync.prg"
if (Test-Path $obsolete) {
    Write-Host "[AVISO] Existe suite_reservas_sync.prg obsoleto — borrarlo" -ForegroundColor Yellow
}

$log = Join-Path $root "Usuarios\_suite_sync.log"
if (Test-Path $log) {
    Write-Host "`n=== Últimas líneas del log ===" -ForegroundColor Cyan
    Get-Content $log -Tail 15
} else {
    Write-Host "`n[SIN LOG] Usuarios\_suite_sync.log no existe — suite_full_unlock no llegó a ejecutarse" -ForegroundColor Red
}

$cfgPath = Join-Path $root "SuiteSync.cfg"
if (Test-Path $cfgPath) {
    $cfg = @{}
    Get-Content $cfgPath | ForEach-Object {
        if ($_ -match '^\s*([^#=]+)=(.*)$') { $cfg[$matches[1].Trim()] = $matches[2].Trim() }
    }
    if (-not $cfg['SYNC_URL'] -or -not $cfg['SYNC_TOKEN']) {
        Write-Host "[ERROR] SuiteSync.cfg sin SYNC_URL o SYNC_TOKEN" -ForegroundColor Red
    } else {
        Write-Host "`nProbando red (stylegetreservas)..." -ForegroundColor Cyan
        try {
            $body = "id=$($cfg['SYNC_TOKEN'])&tag=stylegetreservas"
            $r = Invoke-WebRequest -Uri $cfg['SYNC_URL'] -Method POST -ContentType "application/x-www-form-urlencoded" -Body $body -UseBasicParsing -TimeoutSec 30
            Write-Host "HTTP $($r.StatusCode) — red OK" -ForegroundColor Green
        } catch {
            Write-Host "Red/SSL falló: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
}

Write-Host "`nSi falta suite_full_unlock.fxp: copia desde C:\Duna\Export\PROGS o ejecuta activar_suite_sync.prg en VFP." -ForegroundColor Yellow
