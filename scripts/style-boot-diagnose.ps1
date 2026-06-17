# Diagnostico autonomo arranque Style Dunasoft
# Uso: .\scripts\style-boot-diagnose.ps1 [-StyleRoot 'C:\Duna\Style-Suite-Test']
param(
    [string]$StyleRoot = "C:\Duna\Style-Suite-Test"
)

$ErrorActionPreference = "Continue"
$StyleRoot = [IO.Path]::GetFullPath($StyleRoot)
$Usuarios = Join-Path $StyleRoot "Usuarios"
$TraceLog = Join-Path $Usuarios "style_boot_trace.log"
$ReportDir = Join-Path $StyleRoot "Usuarios\diag_reports"
$Vfp = "${env:ProgramFiles(x86)}\Microsoft Visual FoxPro 9\vfp9.exe"
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$Report = Join-Path $ReportDir "report-$Stamp.txt"

New-Item -ItemType Directory -Path $Usuarios -Force | Out-Null
New-Item -ItemType Directory -Path $ReportDir -Force | Out-Null

function Write-Report([string]$Line) {
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $msg = "[$ts] $Line"
    Add-Content -Path $Report -Value $msg -Encoding UTF8
    Write-Host $msg
}

function Save-Screenshot([string]$Path) {
    try {
        Add-Type -AssemblyName System.Windows.Forms
        Add-Type -AssemblyName System.Drawing
        $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
        $bmp = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        $g.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
        $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
        $g.Dispose(); $bmp.Dispose()
        return $true
    } catch {
        Write-Report "Screenshot fallo: $($_.Exception.Message)"
        return $false
    }
}

function Stop-StyleProcesses {
    Get-Process -Name "Duna2","Duna","vfp9","mscomctl" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
}

Write-Report "=== style-boot-diagnose ==="
Write-Report "StyleRoot: $StyleRoot"

# Inventario
$checks = @(
    "Duna2.exe", "Duna.exe", "IniciarStyle.bat", "SuiteSync.cfg", "EMPRESA.DBF",
    "dbf\wedb.dbc", "PROGS\funciones.fxp", "PROGS\general.fxp", "PROGS\suite_full_unlock.prg",
    "PROGS\clases.prg", "PROGS\trace_general_boot.prg", "vcx\licencias.vcx", "vcx\pellib.vcx"
)
foreach ($c in $checks) {
    $ok = Test-Path (Join-Path $StyleRoot $c)
    Write-Report ("  {0,-35} {1}" -f $c, $(if ($ok) { "OK" } else { "FALTA" }))
}

# Limpiar log trace
if (Test-Path $TraceLog) { Remove-Item $TraceLog -Force }
"=== bat pre-launch $(Get-Date) ===" | Set-Content $TraceLog -Encoding ASCII

# --- Fase 1: simulacion VFP (trace_general_boot.prg) ---
Write-Report "--- Fase 1: trace_general_boot.prg ---"
if (-not (Test-Path $Vfp)) {
    Write-Report "VFP9 no instalado en $Vfp"
} else {
    Stop-StyleProcesses
    $launcher = Join-Path $StyleRoot "PROGS\_vfp_run_trace.prg"
    @"
SET DEFAULT TO $StyleRoot
CD $StyleRoot
DO PROGS\trace_general_boot.prg
"@ | Set-Content $launcher -Encoding ASCII

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $Vfp
    $psi.Arguments = "`"$launcher`""
    $psi.WorkingDirectory = $StyleRoot
    $psi.UseShellExecute = $false
    $p = [System.Diagnostics.Process]::Start($psi)
    $null = $p.WaitForExit(120000)
    if (-not $p.HasExited) {
        Write-Report "trace_general_boot timeout - matando vfp9"
        Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
    } else {
        Write-Report "trace_general_boot exit=$($p.ExitCode)"
    }
    if (Test-Path $TraceLog) {
        Write-Report "--- style_boot_trace.log (fase 1) ---"
        Get-Content $TraceLog | ForEach-Object { Write-Report "  $_" }
    } else {
        Write-Report "Sin style_boot_trace.log tras fase 1"
    }
}

# --- Fase 2: IniciarStyle.bat + Duna2.exe ---
Write-Report "--- Fase 2: IniciarStyle.bat ---"
Stop-StyleProcesses
$shotBefore = Join-Path $ReportDir "before-$Stamp.png"
Save-Screenshot $shotBefore | Out-Null

$bat = Join-Path $StyleRoot "IniciarStyle.bat"
if (-not (Test-Path $bat)) {
    Write-Report "FALTA IniciarStyle.bat"
} else {
    $proc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "`"$bat`"" -WorkingDirectory $StyleRoot -PassThru
    Start-Sleep -Seconds 3

  $running = @()
  foreach ($n in @("Duna2","Duna","vfp9","mscomctl")) {
    $running += Get-Process -Name $n -ErrorAction SilentlyContinue
  }
  Write-Report ("Procesos tras 3s: " + ($(if ($running) { ($running | ForEach-Object { $_.Name + ":" + $_.Id }) -join ", " } else { "(ninguno)" })))

  # Esperar ventana o cierre
  $deadline = (Get-Date).AddSeconds(25)
  $captured = $false
  while ((Get-Date) -lt $deadline) {
    $vfp = Get-Process -Name "vfp9" -ErrorAction SilentlyContinue
    $duna = Get-Process -Name "Duna2","Duna" -ErrorAction SilentlyContinue
    if ($vfp -and -not $captured) {
      Start-Sleep -Seconds 1
      $shotVfp = Join-Path $ReportDir "vfp-ide-$Stamp.png"
      if (Save-Screenshot $shotVfp) {
        Write-Report "Captura IDE VFP: $shotVfp"
        $captured = $true
      }
    }
    if ($duna) {
      $titles = $duna | ForEach-Object { $_.MainWindowTitle } | Where-Object { $_ }
      if ($titles) { Write-Report ("Ventana Style: " + ($titles -join ' | ')) }
    }
    if (-not $vfp -and -not $duna) { break }
    Start-Sleep -Seconds 2
  }

  $shotAfter = Join-Path $ReportDir "after-$Stamp.png"
  if (Save-Screenshot $shotAfter) { Write-Report "Captura final: $shotAfter" }

  # Logs
  $syncLog = Join-Path $Usuarios "_suite_sync.log"
  if (Test-Path $syncLog) {
    $mtime = (Get-Item $syncLog).LastWriteTime
    Write-Report "suite_sync.log mtime=$mtime"
    Get-Content $syncLog -Tail 15 | ForEach-Object { Write-Report "  sync: $_" }
  } else {
    Write-Report "suite_sync.log no creado/actualizado"
  }
  if (Test-Path $TraceLog) {
    $tail = Get-Content $TraceLog -Tail 20
    if ($tail) {
      Write-Report "--- style_boot_trace.log (fase 2 tail) ---"
      $tail | ForEach-Object { Write-Report "  $_" }
    }
  }
  $startupTrace = Join-Path $Usuarios "startup_trace.log"
  if (Test-Path $startupTrace) {
    Write-Report "--- startup_trace.log ---"
    Get-Content $startupTrace -Tail 5 | ForEach-Object { Write-Report "  $_" }
  }

  Stop-StyleProcesses
}

Write-Report "=== FIN reporte: $Report ==="
Write-Host ""
Write-Host "Reporte: $Report" -ForegroundColor Cyan
Get-ChildItem $ReportDir -Filter "*$Stamp*" | ForEach-Object {
    Write-Host ('  ' + $_.FullName) -ForegroundColor DarkGray
}
