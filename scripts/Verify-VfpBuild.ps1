# Analiza logs/ERR tras build VFP9. Entregable Style: Duna.exe
param(
    [string]$ExportRoot = "C:\Duna\Export",
    [datetime]$MinExeTime = (Get-Date).AddHours(-24)
)

$ErrorActionPreference = "Stop"
$fail = @()

function Log-HasMatch {
    param([string[]]$Lines, [string]$Pattern)
    return [bool]($Lines | Where-Object { $_ -match $Pattern } | Select-Object -First 1)
}

function Test-ErrFile {
    param([string]$Path, [switch]$AllowContaUndefined)
    if (-not (Test-Path $Path)) { return }
    $size = (Get-Item $Path).Length
    if ($size -le 0) { return }
    $body = Get-Content $Path -Raw -ErrorAction SilentlyContinue
    if ($body -match 'COMPILE \(lcTempPrg\) TO') {
        $script:fail += "$Path : COMPILE (var) TO invalido"
        return
    }
    if ($body -match 'CLOSE PROJECT ALL') {
        $script:fail += "$Path : CLOSE PROJECT ALL invalido en VFP9"
        return
    }
    if ($AllowContaUndefined -and ($body -notmatch 'Error in line')) {
        if (($body -match 'Application CONTA - Undefined') -or ($body -match 'Unknown _MESSAGEBOX')) { return }
    }
    $script:fail += "$Path ($size bytes): $(($body -split "`n" | Select-Object -First 2) -join ' | ')"
}

$progs = Join-Path $ExportRoot "PROGS"
@(
    (Join-Path $progs "general.ERR"),
    (Join-Path $progs "funciones.ERR"),
    (Join-Path $progs "suite_full_unlock.ERR")
) | ForEach-Object { Test-ErrFile $_ }

Test-ErrFile (Join-Path $ExportRoot "mscomctl.ERR") -AllowContaUndefined

$log = Join-Path $ExportRoot "build_mscomctl.log"
if (-not (Test-Path $log)) {
    $fail += "Falta build_mscomctl.log"
} else {
    $lines = Get-Content $log
    $lines | Where-Object { $_ -match '^(ERROR:|ABORT:)' } | ForEach-Object {
        if ($_ -match 'ActiveProject no disponible') {
            $fail += "build: cierra Project Manager y ejecuta DO PROGS\VfpBuildProject.prg en VFP"
        } else {
            $fail += "build_mscomctl.log: $_"
        }
    }
    if (-not (Log-HasMatch $lines 'COMPILE general OK')) {
        $fail += "build_mscomctl.log: no compilo general.prg"
    }
    if (-not (Log-HasMatch $lines 'Reparar proyecto OK')) {
        $fail += "build_mscomctl.log: falta BUILD en VFP (DO PROGS\VfpBuildProject.prg)"
    }
    if (-not (Log-HasMatch $lines 'BUILD PROJECT fin')) {
        $fail += "build_mscomctl.log: BUILD PROJECT no finalizo"
    }
    if (-not (Log-HasMatch $lines 'Duna.exe OK')) {
        $fail += "build_mscomctl.log: falta copia a Duna.exe"
    }
}

$mscomctl = Join-Path $ExportRoot "mscomctl.exe"
$duna = Join-Path $ExportRoot "Duna.exe"

if (-not (Test-Path $duna)) {
    $fail += "Falta Duna.exe"
} elseif ((Get-Item $duna).LastWriteTime -lt $MinExeTime) {
    $fail += "Duna.exe no actualizado (fecha $((Get-Item $duna).LastWriteTime)) - ejecuta DO PROGS\VfpBuildProject.prg en VFP"
}

if ($fail.Count -gt 0) {
    Write-Host "=== BUILD FALLIDO ===" -ForegroundColor Red
    $fail | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
    exit 1
}

Write-Host "=== BUILD OK ===" -ForegroundColor Green
if (Test-Path $mscomctl) {
    Write-Host ("mscomctl.exe  {0} bytes  {1}" -f (Get-Item $mscomctl).Length, (Get-Item $mscomctl).LastWriteTime)
}
Write-Host ("Duna.exe        {0} bytes  {1}" -f (Get-Item $duna).Length, (Get-Item $duna).LastWriteTime)
exit 0
