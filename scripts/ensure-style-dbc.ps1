# wedb canonico en dbf\. Build nuevo (general.prg): OPEN dbf\wedb, sin wedb.* en raiz.
# -LegacyTableLinks: solo exe.bak sin bootstrap (enlaza wedb + tablas a raiz). STYLE_LEGACY=1 en bat.
param(
    [string]$StyleRoot = "",
    [string]$VmHost = "192.168.99.16",
    [switch]$RemoveRootCopies,
    [switch]$RemoveWedbRootOnly,
    [switch]$LegacyTableLinks
)

$ErrorActionPreference = "Stop"

function Resolve-StyleRootPath {
    param(
        [string]$Preferred = "",
        [string]$VmHost = "192.168.99.16"
    )

    $candidates = @()
    if ($Preferred) { $candidates += $Preferred.TrimEnd('\') }
    if ($env:SUITE_STYLE_ROOT) { $candidates += $env:SUITE_STYLE_ROOT.TrimEnd('\') }
    if ($env:STYLE_HOME) { $candidates += $env:STYLE_HOME.TrimEnd('\') }
    $candidates += @(
        "Z:\Style-Dunasoft",
        "C:\Style-Dunasoft",
        "\\$VmHost\c$\Style-Dunasoft"
    )
    $candidates = $candidates | Select-Object -Unique

    foreach ($c in $candidates) {
        if (-not $c) { continue }
        $dbc = Join-Path $c "dbf\wedb.dbc"
        if (Test-Path $dbc) {
            return (Get-Item $c).FullName
        }
    }

    throw @"
No se encuentra Style-Dunasoft (dbf\wedb.dbc). Rutas probadas:
  $($candidates -join "`n  ")

Monta la unidad Z: a la VM Style o usa ruta UNC accesible, por ejemplo:
  net use Z: \\$VmHost\C$ /persistent:yes
  .\scripts\ensure-style-dbc.ps1 -StyleRoot "\\$VmHost\c$\Style-Dunasoft" -RemoveWedbRootOnly

Tambien puedes definir `$env:SUITE_STYLE_ROOT antes de ejecutar.
"@
}

$StyleRoot = Resolve-StyleRootPath -Preferred $StyleRoot -VmHost $VmHost
Write-Host "StyleRoot: $StyleRoot" -ForegroundColor DarkGray
$DbfDir = Join-Path $StyleRoot "dbf"
$srcDbc = Join-Path $DbfDir "wedb.dbc"

if (-not (Test-Path $srcDbc)) {
    throw "No existe $srcDbc"
}

function Link-OrCopyFile {
    param([string]$Src, [string]$Dst)
    if (Test-Path $Dst) { return "exists" }
    if (-not (Test-Path $Src)) { return "missing" }
    try {
        $null = New-Item -ItemType HardLink -Path $Dst -Target $Src -ErrorAction Stop
        return "link"
    } catch {
        Copy-Item $Src $Dst -Force
        return "copy"
    }
}

if ($RemoveWedbRootOnly) {
    foreach ($name in @("wedb.dbc", "WEDB.DCT", "WEDB.DCX")) {
        $rootCopy = Join-Path $StyleRoot $name
        if (Test-Path $rootCopy) {
            Remove-Item $rootCopy -Force
            Write-Host "Eliminado $rootCopy" -ForegroundColor Yellow
        }
    }
    Write-Host "OK: wedb.* raiz eliminado (usar dbf\wedb)" -ForegroundColor Green
    return
}

if ($RemoveRootCopies) {
    foreach ($name in @("wedb.dbc", "WEDB.DCT", "WEDB.DCX")) {
        $rootCopy = Join-Path $StyleRoot $name
        if (Test-Path $rootCopy) {
            Remove-Item $rootCopy -Force
            Write-Host "Eliminado $rootCopy" -ForegroundColor Yellow
        }
    }
    Get-ChildItem $DbfDir -File | Where-Object {
        $_.Extension -match '^\.(dbf|cdx|fpt)$'
    } | ForEach-Object {
        $rootCopy = Join-Path $StyleRoot $_.Name
        if (Test-Path $rootCopy) {
            Remove-Item $rootCopy -Force -ErrorAction SilentlyContinue
            Write-Host "Eliminado enlace tabla $rootCopy" -ForegroundColor Yellow
        }
    }
    Write-Host "OK: enlaces raiz eliminados (canonico dbf\)" -ForegroundColor Green
    return
}

$stats = @{ link = 0; copy = 0; exists = 0 }
foreach ($name in @("wedb.dbc", "WEDB.DCT", "WEDB.DCX")) {
    $src = Join-Path $DbfDir $name
    if (-not (Test-Path $src)) { continue }
    $r = Link-OrCopyFile -Src $src -Dst (Join-Path $StyleRoot $name)
    if ($r -eq "link") { Write-Host "Enlace $(Join-Path $StyleRoot $name)" -ForegroundColor Green; $stats.link++ }
    elseif ($r -eq "copy") { Write-Host "Copiado $(Join-Path $StyleRoot $name)" -ForegroundColor Cyan; $stats.copy++ }
    else { $stats.exists++ }
}

if ($LegacyTableLinks) {
    Get-ChildItem $DbfDir -File | Where-Object {
        $_.Extension -match '^\.(dbf|cdx|fpt)$'
    } | ForEach-Object {
        $dst = Join-Path $StyleRoot $_.Name
        $r = Link-OrCopyFile -Src $_.FullName -Dst $dst
        switch ($r) {
            "link" { $stats.link++ }
            "copy" { $stats.copy++ }
            "exists" { $stats.exists++ }
        }
    }
}

Write-Host ("OK: {0} enlaces, {1} copias, {2} ya existian (LegacyTableLinks={3})" -f $stats.link, $stats.copy, $stats.exists, $LegacyTableLinks.IsPresent) -ForegroundColor Green
