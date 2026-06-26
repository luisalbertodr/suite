# Instala tareas programadas sync (agente Node + worker inbound). Ejecutar como administrador si falla.
# Uso: clic derecho -> Ejecutar con PowerShell como administrador
param(
    [string]$StyleRoot = "C:\Duna\Style-Suite-Test"
)
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
& (Join-Path $here "deploy-style-sync-runtime.ps1") -StyleRoot $StyleRoot -InstallTasks
Write-Host ""
Write-Host "Si ves 'Acceso denegado', vuelve a ejecutar este script como administrador." -ForegroundColor Yellow
