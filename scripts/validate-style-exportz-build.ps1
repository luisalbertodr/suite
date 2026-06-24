# Valida build ExportZ: tamano exe, log sync, ausencia de FXP problematicos.
param(
    [string]$TestRoot = "C:\Duna\Style-Suite-Test",
    [string]$ExportRoot = "C:\Duna\ExportZ",
    [long]$MaxExeBytes = 34000000,
    [long]$MinExeBytes = 28000000
)

$ErrorActionPreference = "Stop"
$TestRoot = [IO.Path]::GetFullPath($TestRoot.TrimEnd('\'))
$ExportRoot = [IO.Path]::GetFullPath($ExportRoot.TrimEnd('\'))

$fail = 0
function Test-Check([bool]$Ok, [string]$Msg) {
    if ($Ok) { Write-Host "  OK $Msg" -ForegroundColor Green }
    else { Write-Host "  FAIL $Msg" -ForegroundColor Red; $script:fail++ }
}

Write-Host ""
Write-Host "=== validate-style-exportz-build ===" -ForegroundColor Cyan

foreach ($root in @($ExportRoot, $TestRoot)) {
    $duna = Join-Path $root "Duna.exe"
    if (Test-Path $duna) {
        $fi = Get-Item $duna
        Test-Check ($fi.Length -ge $MinExeBytes -and $fi.Length -le $MaxExeBytes) `
            ("Duna.exe $root : {0:N0} bytes (objetivo {1:N0}-{2:N0})" -f $fi.Length, $MinExeBytes, $MaxExeBytes)
    } else {
        Test-Check $false "Falta Duna.exe en $root"
    }
}

$badFxp = @(
    (Join-Path $TestRoot "PROGS\suite_full_unlock.fxp"),
    (Join-Path $TestRoot "PROGS\suite_full_unlock.FXP"),
    (Join-Path $TestRoot "PROGS\funciones.fxp"),
    (Join-Path $TestRoot "PROGS\funciones.FXP"),
    (Join-Path $TestRoot "PROGS\general.fxp"),
    (Join-Path $TestRoot "PROGS\general.FXP")
)
foreach ($p in $badFxp) {
    Test-Check (-not (Test-Path $p)) "Sin $p"
}

$log = Join-Path $TestRoot "Usuarios\_suite_sync.log"
if (Test-Path $log) {
    $content = Get-Content $log -Raw -ErrorAction SilentlyContinue
    foreach ($code in @("[BOOT-00]", "[BOOT-04]", "[BOOT-06]", "[INIT-03]")) {
        $found = $content -match [regex]::Escape($code)
        if ($code -eq "[BOOT-04]" -and -not $found) {
            $found = $content -match '\[BOOT-06\]'
        }
        Test-Check $found "Log contiene $code (o BOOT-06)"
    }
    if ($content -match "1732|nombre de clase") {
        Test-Check $false "Log menciona error 1732"
    }
} else {
    Write-Host "  INFO Sin log aun - arranca IniciarStyle.bat y vuelve a ejecutar" -ForegroundColor Yellow
}

$cfg = Join-Path $TestRoot "SuiteSync.cfg"
Test-Check (Test-Path $cfg) "SuiteSync.cfg en test"
$vcx = Join-Path $TestRoot "vcx\pellib.vcx"
Test-Check (Test-Path $vcx) "vcx\pellib.vcx en test"

Write-Host ""
if ($fail -eq 0) {
    Write-Host ("Validacion OK ({0} fallos)" -f $fail) -ForegroundColor Green
    exit 0
}
Write-Host ("Validacion con {0} fallo(s) - revisa build y arranque" -f $fail) -ForegroundColor Red
exit 1
