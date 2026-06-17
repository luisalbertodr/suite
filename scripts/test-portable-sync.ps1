# Comprueba estado sync del portable Style (sin abrir VFP).
param(
    [string]$PortableRoot = ""
)

$ErrorActionPreference = "Stop"

if (-not $PortableRoot) {
    $PortableRoot = Join-Path (Split-Path -Parent $PSScriptRoot) "dist\style-portable\Style-Dunasoft-PC-Limpio"
}

$PortableRoot = [System.IO.Path]::GetFullPath($PortableRoot)

Write-Host "=== test-portable-sync ===" -ForegroundColor Cyan
Write-Host "Portable: $PortableRoot`n"

$checks = @(
    @{ n = "Duna.exe"; p = Join-Path $PortableRoot "Duna.exe" },
    @{ n = "SuiteSync.cfg"; p = Join-Path $PortableRoot "SuiteSync.cfg" },
    @{ n = "PROGS\suite_full_unlock.fxp"; p = Join-Path $PortableRoot "PROGS\suite_full_unlock.fxp" },
    @{ n = "PROGS\funciones.fxp"; p = Join-Path $PortableRoot "PROGS\funciones.fxp" },
    @{ n = "dbf\SuiteSync.cfg"; p = Join-Path $PortableRoot "dbf\SuiteSync.cfg" }
)

foreach ($c in $checks) {
    if (Test-Path $c.p) {
        Write-Host "[OK] $($c.n)" -ForegroundColor Green
    } else {
        Write-Host "[FALTA] $($c.n)" -ForegroundColor Red
    }
}

$log = Join-Path $PortableRoot "Usuarios\_suite_sync.log"
if (Test-Path $log) {
    $tail = Get-Content $log -Tail 20
    Write-Host "`n--- Log (ultimas 20) ---" -ForegroundColor Cyan
    $tail | ForEach-Object { Write-Host $_ }

    if ($tail -match "\[INIT-03\]") {
        Write-Host "`n[OK] Sync inicializada" -ForegroundColor Green
    } elseif ($tail -match "\[BOOT-06\]") {
        Write-Host "`n[PARCIAL] Unlock cargado desde FXP; falta INIT-03" -ForegroundColor Yellow
    } elseif ($tail -match "\[BOOT-07\]") {
        Write-Host "`n[FALLO] Sync no cargada - ejecutar DO activar_suite_sync.prg en VFP" -ForegroundColor Red
    }
} else {
    Write-Host "`n[SIN LOG] Arranca IniciarStyle.bat primero" -ForegroundColor Yellow
}

Write-Host "`n--- HTTP pull ---" -ForegroundColor Cyan
Push-Location $PortableRoot
try {
    & (Join-Path $PortableRoot "TestStyleSync.ps1")
} finally {
    Pop-Location
}
