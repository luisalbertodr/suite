# Empaqueta Style Dunasoft como carpeta portable VFP9 (+ SFX 7-Zip opcional).
#
# Uso (siempre con guion -StyleSource):
#   cd C:\Users\OportoW11\Suite\suite
#   .\scripts\build-style-portable.ps1 -StyleSource 'C:\Style-Dunasoft'
#   .\scripts\build-style-portable.ps1 -StyleSource 'Z:\Style-Dunasoft' -UseExportExe -SkipSfx
#   .\scripts\build-style-portable.ps1 -StyleSource 'C:\Style-Dunasoft' -OutputDir 'D:\Style-Portable'
#   .\scripts\build-style-portable.ps1 -InventoryOnly
#
# NO ejecutar con destino = origen (no empaquetar C:\Style-Dunasoft sobre si mismo).
# Variables opcionales:
#   $env:SUITE_STYLE_ROOT   — origen Style-Dunasoft
#   $env:VFP9_ROOT           — C:\Program Files (x86)\Microsoft Visual FoxPro 9

param(
    [string]$StyleSource = "",
    [string]$OutputDir = "",
    [string]$VfpRoot = "",
    [string]$ExportExe = "C:\Duna\Export\Duna.exe",
    [switch]$UseExportExe,
    [switch]$SkipDbf,
    [switch]$SkipSfx,
    [switch]$SfxExtractHere,
    [switch]$InventoryOnly,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

function Resolve-RepoRoot {
    if ($env:SUITE_REPO -and (Test-Path $env:SUITE_REPO)) {
        return (Resolve-Path $env:SUITE_REPO).Path
    }
    $scriptDir = $PSScriptRoot
    $parent = Split-Path -Parent $scriptDir
    if (Test-Path (Join-Path $scriptDir "vfp\IniciarStyle-portable.bat")) {
        return (Resolve-Path $scriptDir).Path
    }
    if ($parent -and (Test-Path (Join-Path $parent "vfp\IniciarStyle-portable.bat"))) {
        return (Resolve-Path $parent).Path
    }
    return $scriptDir
}

$RepoRoot = Resolve-RepoRoot
$VfpRepo = Join-Path $RepoRoot "vfp"

$Script:PortableLauncherBat = @'
@echo off
REM Style Dunasoft portable — raiz = carpeta de este .bat (STYLE_HOME)
setlocal
set "STYLE_HOME=%~dp0"
cd /d "%STYLE_HOME%"

set "DBCSCRIPT=%~dp0ensure-style-dbc.ps1"
if exist "%DBCSCRIPT%" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%DBCSCRIPT%" -StyleRoot "%CD%"
) else (
  if exist dbf\wedb.dbc if not exist wedb.dbc (
    mklink /H "wedb.dbc" "dbf\wedb.dbc" >nul 2>&1
    if errorlevel 1 copy /Y "dbf\wedb.dbc" "wedb.dbc" >nul
  )
  if exist dbf\WEDB.DCT if not exist WEDB.DCT (
    mklink /H "WEDB.DCT" "dbf\WEDB.DCT" >nul 2>&1
    if errorlevel 1 copy /Y "dbf\WEDB.DCT" "WEDB.DCT" >nul
  )
  if exist dbf\WEDB.DCX if not exist WEDB.DCX (
    mklink /H "WEDB.DCX" "dbf\WEDB.DCX" >nul 2>&1
    if errorlevel 1 copy /Y "dbf\WEDB.DCX" "WEDB.DCX" >nul
  )
)

if not exist SuiteSync.cfg (
  echo ERROR: falta SuiteSync.cfg en %CD%
  pause
  exit /b 1
)

if not exist Duna.exe (
  echo ERROR: falta Duna.exe en %CD%
  pause
  exit /b 1
)

if not exist dbf\wedb.dbc (
  echo AVISO: falta dbf\wedb.dbc — Style puede no arrancar.
)

if not exist Usuarios mkdir Usuarios 2>nul

echo Style portable: %CD%
echo Sync embebido en Duna.exe — log: Usuarios\_suite_sync.log
echo.

start "" /D "%STYLE_HOME%" "%STYLE_HOME%Duna.exe"
'@

# DLLs VFP9 habituales (se completan con las encontradas en origen / VFP9).
$Script:VfpRuntimeNames = @(
    "vfp9r.dll",
    "vfp9t.dll",
    "vfp9resn.dll",
    "vfp9k.dll",
    "vfp9enu.dll",
    "vfp9esp.dll",
    "msvcr71.dll",
    "msvcp71.dll",
    "gdiplus.dll",
    "vfpoledb.dll"
)

$Script:StyleCopyExcludeDirs = @(
    ".git",
    "__pycache__",
    "node_modules"
)

function Resolve-StyleSourcePath {
    param([string]$Explicit)
    $candidates = @()
    if ($Explicit) { $candidates += $Explicit.TrimEnd('\') }
    if ($env:SUITE_STYLE_ROOT) { $candidates += $env:SUITE_STYLE_ROOT.TrimEnd('\') }
    $candidates += @(
        "Z:\Style-Dunasoft",
        "C:\Style-Dunasoft",
        "\\192.168.99.119\c$\Style-Dunasoft"
    )
    foreach ($c in ($candidates | Select-Object -Unique)) {
        if ($c -and (Test-Path $c)) {
            return (Resolve-Path $c).Path
        }
    }
    throw @"
No se encuentra Style-Dunasoft. Rutas probadas:
  $($candidates -join "`n  ")
Monta Z:\Style-Dunasoft o pasa -StyleSource
"@
}

function Resolve-VfpRootPath {
    param([string]$Explicit)
    if ($Explicit -and (Test-Path $Explicit)) {
        return (Resolve-Path $Explicit).Path
    }
    if ($env:VFP9_ROOT -and (Test-Path $env:VFP9_ROOT)) {
        return (Resolve-Path $env:VFP9_ROOT).Path
    }
    $default = "${env:ProgramFiles(x86)}\Microsoft Visual FoxPro 9"
    if (Test-Path $default) { return (Resolve-Path $default).Path }
    return $null
}

function Find-SevenZip {
    $paths = @(
        "${env:ProgramFiles}\7-Zip\7z.exe",
        "${env:ProgramFiles(x86)}\7-Zip\7z.exe"
    )
    foreach ($p in $paths) {
        if (Test-Path $p) { return (Resolve-Path $p).Path }
    }
    $cmd = Get-Command 7z.exe -ErrorAction SilentlyContinue
    if ($cmd -and $cmd.Source -and (Test-Path $cmd.Source)) {
        return (Resolve-Path $cmd.Source).Path
    }
    return $null
}

function Find-SfxModule {
    param([string]$SevenZipExe)
    $sevenDir = Split-Path -Parent $SevenZipExe
    if (-not $sevenDir) { return $null }
    foreach ($name in @("7zSD.sfx", "7z.sfx", "7zCon.sfx")) {
        $candidate = Join-Path $sevenDir $name
        if (Test-Path $candidate) {
            return (Resolve-Path $candidate).Path
        }
    }
    return $null
}

function Test-SamePath {
    param([string]$A, [string]$B)
    if (-not $A -or -not $B) { return $false }
    try {
        $pa = [System.IO.Path]::GetFullPath($A).TrimEnd('\')
        $pb = [System.IO.Path]::GetFullPath($B).TrimEnd('\')
        return $pa.Equals($pb, [StringComparison]::OrdinalIgnoreCase)
    } catch {
        return $false
    }
}

function Get-DefaultOutputDir {
    param(
        [string]$StyleRoot,
        [string]$RepoRoot
    )
    $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $launcherInRepo = Join-Path $RepoRoot "vfp\IniciarStyle-portable.bat"
    if (Test-Path $launcherInRepo) {
        return Join-Path $RepoRoot "dist\style-portable\Style-Dunasoft-Portable-$stamp"
    }
    $parent = Split-Path -Parent $StyleRoot
    if (-not $parent) { $parent = $env:TEMP }
    return Join-Path $parent "Style-Dunasoft-Portable-$stamp"
}

function Get-StyleRuntimeInventory {
    param(
        [string]$SourceRoot,
        [string]$VfpInstall
    )
    $found = @{}
    $missing = @()

    foreach ($name in $Script:VfpRuntimeNames) {
        $src = $null
        $from = $null
        $c1 = Join-Path $SourceRoot $name
        if (Test-Path $c1) {
            $src = $c1
            $from = "Style"
        } elseif ($VfpInstall) {
            $c2 = Join-Path $VfpInstall $name
            if (Test-Path $c2) {
                $src = $c2
                $from = "VFP9"
            }
        }
        if ($src) {
            $fi = Get-Item $src
            $found[$name] = [ordered]@{
                Source = $src
                From   = $from
                Bytes  = $fi.Length
                Modified = $fi.LastWriteTime.ToString("o")
            }
        } else {
            $missing += $name
        }
    }

    $extraDlls = Get-ChildItem -Path $SourceRoot -Filter "*.dll" -File -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -notin $found.Keys } |
        ForEach-Object {
            $found[$_.Name] = [ordered]@{
                Source   = $_.FullName
                From     = "Style-extra"
                Bytes    = $_.Length
                Modified = $_.LastWriteTime.ToString("o")
            }
        }

    $ocx = @()
    foreach ($dir in @($SourceRoot, "${env:windir}\SysWOW64")) {
        if (-not (Test-Path $dir)) { continue }
        Get-ChildItem -Path $dir -Filter "*.ocx" -File -ErrorAction SilentlyContinue | ForEach-Object {
            $ocx += [ordered]@{
                Name = $_.Name
                Path = $_.FullName
                Bytes = $_.Length
            }
        }
    }
    $ocx = $ocx | Sort-Object Name -Unique

    return [ordered]@{
        Dlls    = $found
        Missing = $missing
        Ocx     = $ocx
    }
}

function Write-InventoryReport {
    param(
        [string]$Path,
        [hashtable]$Inventory,
        [string]$SourceRoot,
        [string]$VfpInstall
    )
    $report = [ordered]@{
        GeneratedAt = (Get-Date).ToString("o")
        StyleSource = $SourceRoot
        VfpRoot     = $VfpInstall
        DllCount    = $Inventory.Dlls.Count
        MissingDlls = $Inventory.Missing
        Dlls        = $Inventory.Dlls
        Ocx         = $Inventory.Ocx
        Notes       = @(
            "OCX pueden requerir registro COM (regsvr32) si Style falla con OLE 0x80040154.",
            "wedb.dbc debe permanecer en dbf\ (escritura en disco real)."
        )
    }
    $json = $report | ConvertTo-Json -Depth 6
    if (-not $DryRun) {
        $dir = Split-Path -Parent $Path
        if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
        Set-Content -Path $Path -Value $json -Encoding UTF8
    }
    return $report
}

function Copy-StyleTree {
    param(
        [string]$SourceRoot,
        [string]$DestRoot,
        [switch]$NoDbf
    )
    if (Test-SamePath $SourceRoot $DestRoot) {
        throw @"
OutputDir es la misma carpeta que StyleSource ($SourceRoot).
No copies Style sobre si mismo. Ejemplo:
  .\build-style-portable.ps1 -StyleSource 'C:\Style-Dunasoft' -OutputDir 'D:\Style-Dunasoft-Portable'
O ejecuta desde el repo:
  cd C:\Users\OportoW11\Suite\suite
  .\scripts\build-style-portable.ps1 -StyleSource 'C:\Style-Dunasoft'
"@
    }

    if (-not $DryRun) {
        New-Item -ItemType Directory -Path $DestRoot -Force | Out-Null
    }

    $destLeaf = Split-Path -Leaf $DestRoot
    $robocopyArgs = @(
        $SourceRoot,
        $DestRoot,
        "/E",
        "/R:2",
        "/W:2",
        "/NFL", "/NDL", "/NJH", "/NJS", "/NC", "/NS",
        "/XF", "Duna.exe.bak-*", "build-style-portable.ps1", "runtime-inventory.json"
    )
    foreach ($xd in $Script:StyleCopyExcludeDirs) {
        $robocopyArgs += "/XD"
        $robocopyArgs += $xd
    }
    if ($destLeaf) {
        $robocopyArgs += "/XD"
        $robocopyArgs += $destLeaf
    }
    if ($NoDbf) {
        $robocopyArgs += "/XD"
        $robocopyArgs += "dbf"
    }

    if ($DryRun) {
        Write-Host "[DryRun] robocopy $($robocopyArgs -join ' ')" -ForegroundColor DarkGray
        return
    }

    & robocopy @robocopyArgs | Out-Null
    if ($LASTEXITCODE -ge 8) {
        throw "robocopy fallo (exit $LASTEXITCODE)"
    }
}

function Install-PortableRuntime {
    param(
        [string]$DestRoot,
        [hashtable]$Inventory
    )
    foreach ($entry in $Inventory.Dlls.GetEnumerator()) {
        $dest = Join-Path $DestRoot $entry.Key
        if ($DryRun) {
            Write-Host ("[DryRun] DLL " + $entry.Key + " desde " + $entry.Value.Source) -ForegroundColor DarkGray
            continue
        }
        Copy-Item $entry.Value.Source $dest -Force
    }
}

function Remove-EmbeddedFallbacks {
    param([string]$DestRoot)
    $remove = @(
        "PROGS\suite_full_unlock.fxp",
        "PROGS\suite_full_unlock.prg",
        "PROGS\general.fxp",
        "suite_full_unlock.fxp",
        "suite_full_unlock.prg",
        "general.fxp"
    )
    foreach ($rel in $remove) {
        $p = Join-Path $DestRoot $rel
        if (-not (Test-Path $p)) { continue }
        if ($DryRun) {
            Write-Host "[DryRun] eliminar fallback $rel" -ForegroundColor DarkGray
        } else {
            Remove-Item $p -Force
            Write-Host "Eliminado fallback: $rel" -ForegroundColor Yellow
        }
    }
}

function Install-PortableLauncher {
    param([string]$DestRoot)
    $dest = Join-Path $DestRoot "IniciarStyle.bat"
    $candidates = @(
        (Join-Path $VfpRepo "IniciarStyle-portable.bat"),
        (Join-Path $PSScriptRoot "IniciarStyle-portable.bat")
    )
    $src = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1

    if ($DryRun) {
        Write-Host "[DryRun] launcher portable -> IniciarStyle.bat" -ForegroundColor DarkGray
        return
    }
    if ($src) {
        Copy-Item $src $dest -Force
    } else {
        Set-Content -Path $dest -Value $Script:PortableLauncherBat -Encoding ASCII
        Write-Host "Launcher generado embebido -> IniciarStyle.bat" -ForegroundColor Cyan
    }
}

function Clear-RootDbcCopies {
    param([string]$DestRoot)
    foreach ($name in @("wedb.dbc", "WEDB.DCT", "WEDB.DCX")) {
        $p = Join-Path $DestRoot $name
        if (-not (Test-Path $p)) { continue }
        if ($DryRun) {
            Write-Host "[DryRun] eliminar $name en raiz" -ForegroundColor DarkGray
        } else {
            Remove-Item $p -Force
            Write-Host "Eliminado $name en raiz (dbc solo en dbf\)" -ForegroundColor Yellow
        }
    }
}

function New-StylePortableSfx {
    param(
        [string]$PortableDir,
        [string]$SfxPath,
        [switch]$ExtractHere
    )
    if (-not $PortableDir -or -not (Test-Path $PortableDir)) {
        Write-Host "AVISO: carpeta portable invalida - omitiendo SFX." -ForegroundColor Yellow
        return $false
    }
    if (-not $SfxPath) {
        Write-Host "AVISO: ruta SFX vacia - omitiendo SFX." -ForegroundColor Yellow
        return $false
    }

    $sevenZip = Find-SevenZip
    if (-not $sevenZip) {
        Write-Host "AVISO: 7-Zip no instalado - omitiendo SFX. Instala 7-Zip o usa -SkipSfx." -ForegroundColor Yellow
        return $false
    }

    $sfxModule = Find-SfxModule -SevenZipExe $sevenZip
    if (-not $sfxModule) {
        Write-Host "AVISO: no hay modulo SFX (7zSD.sfx / 7z.sfx) junto a $sevenZip - omitiendo SFX." -ForegroundColor Yellow
        return $false
    }

    $sfxDir = Split-Path -Parent $SfxPath
    if ($sfxDir -and -not (Test-Path $sfxDir)) {
        if (-not $DryRun) {
            New-Item -ItemType Directory -Path $sfxDir -Force | Out-Null
        }
    }

    $useInstallerSfx = (Split-Path -Leaf $sfxModule).Equals("7zSD.sfx", [StringComparison]::OrdinalIgnoreCase)

    if ($DryRun) {
        Write-Host "[DryRun] SFX $SfxPath (modulo $sfxModule)" -ForegroundColor DarkGray
        return $true
    }

    try {
        if ($useInstallerSfx) {
            $staging = Join-Path ([System.IO.Path]::GetTempPath()) ("style-portable-" + [guid]::NewGuid().ToString("N"))
            $archive = Join-Path $staging "payload.7z"
            $config = Join-Path $staging "config.txt"
            New-Item -ItemType Directory -Path $staging -Force | Out-Null

            $extractPath = if ($ExtractHere) { ".\\Style-Dunasoft-Portable" } else { "%LOCALAPPDATA%\\Style-Dunasoft" }
            $configText = @"
;!@Install@!UTF-8!
Title="Style Dunasoft Portable"
BeginPrompt="Extraer Style Dunasoft en:`n$extractPath"
ExtractPathText="Carpeta:"
InstallPath="$extractPath"
GUIMode="2"
RunProgram="IniciarStyle.bat"
;!@InstallEnd@!
"@
            & $sevenZip a -t7z -mx=5 $archive (Join-Path $PortableDir "*") | Out-Null
            if ($LASTEXITCODE -ne 0) { throw "7z archive fallo (exit $LASTEXITCODE)" }
            if (-not (Test-Path $archive)) { throw "No se creo el archivo 7z intermedio" }

            Set-Content -Path $config -Value $configText -Encoding UTF8
            if (-not (Test-Path $config)) { throw "No se creo config SFX" }

            $combined = [System.IO.File]::ReadAllBytes($sfxModule) +
                [System.IO.File]::ReadAllBytes($config) +
                [System.IO.File]::ReadAllBytes($archive)
            [System.IO.File]::WriteAllBytes($SfxPath, $combined)
        } else {
            if (Test-Path $SfxPath) { Remove-Item $SfxPath -Force }
            $sfxArg = "-sfx$sfxModule"
            & $sevenZip a -t7z -mx=5 $sfxArg $SfxPath (Join-Path $PortableDir "*") | Out-Null
            if ($LASTEXITCODE -ne 0) { throw "7z SFX fallo (exit $LASTEXITCODE)" }
            Write-Host "SFX simple (sin auto-arranque). Tras extraer, ejecuta IniciarStyle.bat" -ForegroundColor Yellow
        }

        if (-not (Test-Path $SfxPath)) { throw "No se genero $SfxPath" }
        $fi = Get-Item $SfxPath
        Write-Host ("SFX OK: {0}  ({1:N0} bytes)" -f $SfxPath, $fi.Length) -ForegroundColor Green
        return $true
    } catch {
        Write-Host ("AVISO: SFX no generado: " + $_.Exception.Message) -ForegroundColor Yellow
        Write-Host "Usa -SkipSfx o instala 7-Zip completo desde https://www.7-zip.org/" -ForegroundColor Yellow
        return $false
    } finally {
        if ($useInstallerSfx -and $staging -and (Test-Path $staging)) {
            Remove-Item $staging -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
}

# --- main ---

Write-Host "=== build-style-portable ===" -ForegroundColor Cyan

$styleRoot = Resolve-StyleSourcePath -Explicit $StyleSource
$vfpInstall = Resolve-VfpRootPath -Explicit $VfpRoot

Write-Host "Origen:  $styleRoot" -ForegroundColor Cyan
Write-Host "VFP9:    $(if ($vfpInstall) { $vfpInstall } else { '(no encontrado - solo DLLs del origen)' })" -ForegroundColor Cyan

$inventory = Get-StyleRuntimeInventory -SourceRoot $styleRoot -VfpInstall $vfpInstall
$manifestPath = if ($OutputDir) {
    Join-Path $OutputDir "runtime-inventory.json"
} else {
    Join-Path $RepoRoot "dist\style-portable\runtime-inventory.json"
}

$report = Write-InventoryReport -Path $manifestPath -Inventory $inventory -SourceRoot $styleRoot -VfpInstall $vfpInstall

Write-Host ""
Write-Host "Runtime DLLs: $($inventory.Dlls.Count) encontradas" -ForegroundColor Green
if ($inventory.Missing.Count -gt 0) {
    Write-Host ("Faltan (revisar en PC origen): " + ($inventory.Missing -join ", ")) -ForegroundColor Yellow
}
if ($inventory.Ocx.Count -gt 0) {
    Write-Host ("OCX detectados: " + (($inventory.Ocx | ForEach-Object { $_.Name }) -join ", ")) -ForegroundColor Cyan
}

if ($InventoryOnly) {
    if (-not $DryRun) {
        Write-Host "Inventario: $manifestPath" -ForegroundColor Green
    }
    exit 0
}

if (-not $OutputDir) {
    $OutputDir = Get-DefaultOutputDir -StyleRoot $styleRoot -RepoRoot $RepoRoot
}
$OutputDir = [System.IO.Path]::GetFullPath($OutputDir)

if (Test-SamePath $styleRoot $OutputDir) {
    throw "OutputDir no puede ser StyleSource. Pasa -OutputDir 'D:\Style-Dunasoft-Portable' o deja el valor por defecto."
}

Write-Host ""
Write-Host "Destino: $OutputDir" -ForegroundColor Cyan
Write-Host "Repo:    $RepoRoot" -ForegroundColor DarkGray
if ($SkipDbf) {
    Write-Host "AVISO: -SkipDbf - sin carpeta dbf\ (solo prueba de runtime)" -ForegroundColor Yellow
}

Copy-StyleTree -SourceRoot $styleRoot -DestRoot $OutputDir -NoDbf:$SkipDbf

if ($UseExportExe) {
    if (-not (Test-Path $ExportExe)) {
        throw "No existe $ExportExe (compila con build-duna-suite.ps1)"
    }
    Write-Host ("Duna.exe desde " + $ExportExe) -ForegroundColor Green
    if (-not $DryRun) {
        Copy-Item $ExportExe (Join-Path $OutputDir "Duna.exe") -Force
    }
}

Install-PortableRuntime -DestRoot $OutputDir -Inventory $inventory
Install-PortableLauncher -DestRoot $OutputDir
Clear-RootDbcCopies -DestRoot $OutputDir
Remove-EmbeddedFallbacks -DestRoot $OutputDir

if (-not $DryRun) {
    New-Item -ItemType Directory -Path (Join-Path $OutputDir "Usuarios") -Force -ErrorAction SilentlyContinue | Out-Null
    $report | ConvertTo-Json -Depth 6 | Set-Content (Join-Path $OutputDir "runtime-inventory.json") -Encoding UTF8
}

if (-not (Test-Path (Join-Path $OutputDir "Duna.exe")) -and -not $DryRun) {
    throw "Falta Duna.exe en $OutputDir"
}
if (-not $SkipDbf -and -not (Test-Path (Join-Path $OutputDir "dbf\wedb.dbc")) -and -not $DryRun) {
    Write-Host "AVISO: falta dbf\wedb.dbc en destino" -ForegroundColor Red
}
if (-not (Test-Path (Join-Path $OutputDir "SuiteSync.cfg")) -and -not $DryRun) {
    Write-Host "AVISO: falta SuiteSync.cfg - copia manual antes de distribuir" -ForegroundColor Red
}

Write-Host ""
Write-Host "Carpeta portable lista." -ForegroundColor Green
Write-Host "  Arranque: $OutputDir\IniciarStyle.bat" -ForegroundColor Cyan

if (-not $SkipSfx) {
    $sfxPath = Join-Path (Split-Path -Parent $OutputDir) ("Style-Dunasoft-Portable-" + (Get-Date -Format "yyyyMMdd-HHmmss") + ".exe")
    New-StylePortableSfx -PortableDir $OutputDir -SfxPath $sfxPath -ExtractHere:$SfxExtractHere | Out-Null
}

Write-Host @"

Validacion en PC sin VFP9 instalado:
  1. Copiar/descomprimir carpeta o ejecutar SFX
  2. IniciarStyle.bat
  3. Log: Usuarios\_suite_sync.log - buscar [BOOT-04]

"@ -ForegroundColor Cyan
