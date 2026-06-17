# Setup + arranque + prueba sync del portable Style (automatizado).
param(
    [string]$PortableRoot = "",
    [string]$DunaExe = "",
    [int]$WaitSeconds = 25,
    [switch]$SkipStart
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot

if (-not $PortableRoot) {
    $PortableRoot = Join-Path $RepoRoot "dist\style-portable\Style-Dunasoft-PC-Limpio"
}
$PortableRoot = [System.IO.Path]::GetFullPath($PortableRoot)

Write-Host "=== run-portable-sync-test ===" -ForegroundColor Cyan
Write-Host "Portable: $PortableRoot"

# 1) Setup (Z: si esta montada)
    & (Join-Path $RepoRoot "scripts\setup-portable-sync-test.ps1") -PortableRoot $PortableRoot -DunaExe $DunaExe -LocalDunaOnly:($PortableRoot -like "C:\Duna\*")

# 2) Autostart sync via CONFIG.FPW + autosuite_sync.prg
$autosuiteSrc = Join-Path $RepoRoot "vfp\autosuite_sync.prg"
if (Test-Path $autosuiteSrc) {
    Copy-Item $autosuiteSrc (Join-Path $PortableRoot "autosuite_sync.prg") -Force
}
$configFpw = @"
STARTUP=autosuite_sync
RESOURCE=OFF
CODEPAGE=1252
"@
Set-Content -Path (Join-Path $PortableRoot "CONFIG.FPW") -Value $configFpw -Encoding ASCII

# 3) Cerrar Duna.exe previo del portable (solo ese path)
Get-Process -Name "Duna" -ErrorAction SilentlyContinue | ForEach-Object {
    try {
        $p = (Get-CimInstance Win32_Process -Filter "ProcessId=$($_.Id)" -ErrorAction SilentlyContinue).ExecutablePath
        if ($p -and $p.StartsWith($PortableRoot, [StringComparison]::OrdinalIgnoreCase)) {
            Write-Host "Cerrando Duna.exe previo (PID $($_.Id))" -ForegroundColor Yellow
            Stop-Process -Id $_.Id -Force
            Start-Sleep -Seconds 2
        }
    } catch {}
}

# 4) Arrancar Style
if (-not $SkipStart) {
    $launcher = Join-Path $PortableRoot "IniciarStyle.bat"
    if (-not (Test-Path $launcher)) { throw "Falta $launcher" }
    Write-Host "Arrancando Style portable..." -ForegroundColor Cyan
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "`"$launcher`"" -WorkingDirectory $PortableRoot
    Write-Host "Esperando ${WaitSeconds}s (login + startup sync)..." -ForegroundColor DarkGray
    Start-Sleep -Seconds $WaitSeconds
}

# 5) Probar HTTP + leer log
& (Join-Path $RepoRoot "scripts\test-portable-sync.ps1") -PortableRoot $PortableRoot

$log = Join-Path $PortableRoot "Usuarios\_suite_sync.log"
if (Test-Path $log) {
    $tail = Get-Content $log -Tail 30
    if ($tail -match "\[INIT-03\]") {
        Write-Host "`nRESULTADO: sync ACTIVA (INIT-03)" -ForegroundColor Green
        exit 0
    }
    if ($tail -match "CYCLE inicio|PUSH ok|PULL") {
        Write-Host "`nRESULTADO: sync en ciclo (revisar log)" -ForegroundColor Green
        exit 0
    }
    if ($tail -match "\[BOOT-07\]") {
        Write-Host "`nRESULTADO: sync NO cargada (BOOT-07)" -ForegroundColor Red
        exit 2
    }
}

Write-Host "`nRESULTADO: indeterminado — revisa log manualmente" -ForegroundColor Yellow
exit 1
