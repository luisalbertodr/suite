# Despliega el launcher RDP estable al thin client de recepción (192.168.99.14).
# Uso (desde la raíz del repo, PowerShell):
#   .\scripts\recepcion-thinclient\deploy-to-recepcion.ps1
#   .\scripts\recepcion-thinclient\deploy-to-recepcion.ps1 -HostName 192.168.99.14 -User recepcion
#
# Requiere SSH al MacBook Mint de recepción. Si no hay clave, pedirá password.

[CmdletBinding()]
param(
  [string]$HostName = $(if ($env:SUITE_RECEPCION_SSH_HOST) { $env:SUITE_RECEPCION_SSH_HOST } else { '192.168.99.14' }),
  [string]$User = $(if ($env:SUITE_RECEPCION_SSH_USER) { $env:SUITE_RECEPCION_SSH_USER } else { 'recepcion' }),
  [string]$IdentityFile = $(if ($env:SUITE_RECEPCION_SSH_KEY) { $env:SUITE_RECEPCION_SSH_KEY } else { '' })
)

$ErrorActionPreference = 'Stop'
$Dir = if (Test-Path (Join-Path $PSScriptRoot 'rdp-recepcion.sh')) {
  $PSScriptRoot
} else {
  Join-Path (Get-Location).Path 'scripts\recepcion-thinclient'
}

$sshTarget = "${User}@${HostName}"
$sshArgs = @()
if ($IdentityFile -and (Test-Path $IdentityFile)) {
  $sshArgs += @('-i', $IdentityFile)
}
$sshArgs += @('-o', 'StrictHostKeyChecking=accept-new', '-o', 'ConnectTimeout=8')

Write-Host "Subiendo scripts a ${sshTarget}:/tmp ..."
& scp @sshArgs `
  (Join-Path $Dir 'rdp-recepcion.sh') `
  (Join-Path $Dir 'Recepcion.desktop') `
  (Join-Path $Dir 'install-on-recepcion.sh') `
  (Join-Path $Dir 'patch-remmina-sound.py') `
  "${sshTarget}:/tmp/"

Write-Host "Instalando en el thin client..."
& ssh @sshArgs $sshTarget 'bash /tmp/install-on-recepcion.sh'

Write-Host @"

Listo. En recepción: cerrar la sesión FreeRDP actual y abrir de nuevo el icono «Recepción».
Log: ~/.local/share/rdp-recepcion.log
Si sigue congelando en Wi-Fi: RDP_NETWORK=wan en el Exec del .desktop
"@
