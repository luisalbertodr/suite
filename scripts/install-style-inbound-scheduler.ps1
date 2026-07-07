# Task Scheduler: ejecutar suite_inbound_worker.prg cada N s (oculto, sin dialogos SAFETY).
#
# Uso:
#   .\scripts\install-style-inbound-scheduler.ps1
#   .\scripts\install-style-inbound-scheduler.ps1 -IntervalSec 60
#   .\scripts\install-style-inbound-scheduler.ps1 -StyleRoot "\\192.168.99.16\c$\Style-Dunasoft" -VmHost "192.168.99.16"
#
param(
    [string]$StyleRoot = "C:\Duna\Style-Suite-Test",
    [string]$TaskName = "SuiteStyleInboundWorker",
    [int]$IntervalSec = 60,
    [string]$VmHost = "",
    [switch]$RegisterScheduledTask
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$VfpExe = Join-Path ${env:ProgramFiles(x86)} "Microsoft Visual FoxPro 9\vfp9.exe"

# En la VM Style la ruta local es C:\Style-Dunasoft; desde el PC desplegamos por SMB.
$VmLocalRoot = "C:\Style-Dunasoft"
if ($VmHost) {
    $StyleRoot = "\\$VmHost\c$\Style-Dunasoft"
    $TaskStyleRoot = $VmLocalRoot
    $TaskVfpExe = $VfpExe
} else {
    $StyleRoot = $StyleRoot
    $TaskStyleRoot = $StyleRoot
    $TaskVfpExe = $VfpExe
}
$StyleRoot = [IO.Path]::GetFullPath($StyleRoot.TrimEnd('\'))
$TaskStyleRoot = $TaskStyleRoot.TrimEnd('\')

if (-not (Test-Path $VfpExe) -and -not $VmHost) {
    throw "VFP9 no instalado en esta máquina (necesario para generar el .bat en local)"
}
if ($IntervalSec -lt 60) {
    Write-Warning "Task Scheduler minimo ~60s; usando IntervalSec=60"
    $IntervalSec = 60
}

$worker = Join-Path $StyleRoot "PROGS\suite_inbound_worker_sync.prg"
if (-not (Test-Path $worker)) {
    Copy-Item (Join-Path $RepoRoot "vfp\suite_inbound_worker.prg") $worker -Force
} else {
    Copy-Item (Join-Path $RepoRoot "vfp\suite_inbound_worker.prg") $worker -Force
}

$oncePrg = Join-Path $StyleRoot "PROGS\_inbound_once.prg"
$onceSrc = Join-Path (Split-Path -Parent $PSScriptRoot) "vfp\_inbound_once.prg"
if (Test-Path $onceSrc) {
    $once = Get-Content $onceSrc -Raw -Encoding UTF8
    $once = $once -replace 'C:\\Duna\\Style-Suite-Test\\', ($TaskStyleRoot + '\')
} else {
    $once = @"
LOCAL lcWorker
SET SAFETY OFF
SET ESCAPE OFF
SET NOTIFY OFF
ON ERROR DO InboundOnceError
_SCREEN.Visible = .F.
PUBLIC pcSuiteStyleRoot
pcSuiteStyleRoot = "$TaskStyleRoot\"
SET DEFAULT TO (pcSuiteStyleRoot)
lcWorker = pcSuiteStyleRoot + "PROGS\suite_inbound_worker_sync.prg"
IF .NOT. FILE(lcWorker)
   QUIT
ENDIF
SET PROCEDURE TO (lcWorker) ADDITIVE
IF TYPE("SuiteInboundWorkerRun") = "U"
   QUIT
ENDIF
DO SuiteInboundWorkerRun
QUIT
"@
}
Set-Content -Path $oncePrg -Value $once -Encoding ASCII

$runner = Join-Path $StyleRoot "run_inbound_worker.bat"
$bat = @"
@echo off
rem pushd mapea UNC a unidad temporal (cd /d falla con \\server\share)
pushd "%~dp0"
set "STYLE_HOME=%~dp0"
set SUITE_INBOUND_HEADLESS=1
set "VFP="
if exist "%STYLE_HOME%runtime\vfp9\vfp9.exe" set "VFP=%STYLE_HOME%runtime\vfp9\vfp9.exe"
if not defined VFP if exist "C:\Program Files (x86)\Microsoft Visual FoxPro 9\vfp9.exe" set "VFP=C:\Program Files (x86)\Microsoft Visual FoxPro 9\vfp9.exe"
if not defined VFP if exist "C:\Program Files\Microsoft Visual FoxPro 9\vfp9.exe" set "VFP=C:\Program Files\Microsoft Visual FoxPro 9\vfp9.exe"
if defined VFP9_HOME if exist "%VFP9_HOME%\vfp9.exe" set "VFP=%VFP9_HOME%\vfp9.exe"
if not defined VFP (
  echo ERROR: No se encuentra vfp9.exe
  echo Copia runtime: .\scripts\deploy-vfp9-runtime-vm.ps1 desde el PC de desarrollo
  popd
  exit /b 1
)
"%VFP%" "PROGS\_inbound_once.prg"
set EXITCODE=%ERRORLEVEL%
popd
exit /b %EXITCODE%
"@
Set-Content -Path $runner -Value $bat -Encoding ASCII

$vbs = Join-Path $StyleRoot "run_inbound_worker_hidden.vbs"
# Ruta relativa al .vbs: evita UNC embebido si se despliega por SMB (popup SAFETY en VFP).
$vbsContent = @"
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
batPath = fso.BuildPath(fso.GetParentFolderName(WScript.ScriptFullName), "run_inbound_worker.bat")
sh.Run Chr(34) & batPath & Chr(34), 0, True
"@
Set-Content -Path $vbs -Value $vbsContent -Encoding ASCII

$intervalMin = [Math]::Max(1, [int][Math]::Ceiling($IntervalSec / 60.0))

if ($RegisterScheduledTask) {
    $taskVbs = Join-Path $TaskStyleRoot "run_inbound_worker_hidden.vbs"
    $action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "//B `"$taskVbs`"" -WorkingDirectory $TaskStyleRoot
    $trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) `
        -RepetitionInterval (New-TimeSpan -Minutes $intervalMin) `
        -RepetitionDuration (New-TimeSpan -Days 3650)
    $settings = New-ScheduledTaskSettingsSet `
        -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
        -MultipleInstances Queue -ExecutionTimeLimit (New-TimeSpan -Minutes 3) `
        -Hidden

    if ($VmHost) {
        Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings `
            -User "SYSTEM" -RunLevel Highest -Force -CimSession (New-CimSession -ComputerName $VmHost)
        Write-Host "OK Task $TaskName en VM $VmHost cada ~$($intervalMin) min (oculto)" -ForegroundColor Green
    } else {
        Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Force
        Write-Host "OK Task $TaskName local cada ~$($intervalMin) min (oculto, sin ventana CMD/VFP)" -ForegroundColor Green
    }
} else {
    Write-Host "Sin tarea programada (modo event-driven: el agente Node dispara el worker al escribir JSON)" -ForegroundColor Cyan
    Write-Host "  Para registrar cron VFP: -RegisterScheduledTask" -ForegroundColor DarkGray
}
