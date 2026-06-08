# Bloquea dominios Dunasoft en la VM Style (Win7) vía hosts.

# Complemento al unlock VFP: evita conexiones aunque algún formulario use httpasp del exe.

#

# Uso:

#   .\scripts\block-dunasoft-hosts-vm.ps1

#   .\scripts\block-dunasoft-hosts-vm.ps1 -Remove



param(

    [string]$VmHost = "192.168.99.119",

    [switch]$Remove

)



$ErrorActionPreference = "Stop"

$marker = "# Suite block Dunasoft"

$domains = @(

    "dunasoftpc.com",

    "www.dunasoftpc.com",

    "facebook.dunasoftpc.com",

    "styleonline.dunasoftpc.com",

    "centralreservas.dunasoftpc.com"

)



$remoteScript = @"

`$hostsPath = Join-Path `$env:windir 'System32\drivers\etc\hosts'

`$marker = '$marker'

`$domains = @('$($domains -join "','")')

`$lines = @(Get-Content `$hostsPath -ErrorAction SilentlyContinue)

`$filtered = `$lines | Where-Object { `$_ -notmatch [regex]::Escape(`$marker) }

if ('$($Remove.IsPresent)' -eq 'True') {

    `$filtered | Set-Content `$hostsPath -Encoding ASCII

    Write-Host 'Entradas Dunasoft eliminadas de hosts'

    exit 0

}

foreach (`$d in `$domains) {

    `$filtered += "127.0.0.1 `$d `$marker"

}

`$filtered | Set-Content `$hostsPath -Encoding ASCII

Write-Host 'Hosts Dunasoft bloqueados (127.0.0.1)'

"@



$share = "\\$VmHost\c$\Windows\Temp"

if (-not (Test-Path $share)) {

    throw "Sin acceso SMB a \\$VmHost\c$. Ejecuta copy-to-vm.ps1 o net use primero."

}

$tmp = Join-Path $share "suite-block-hosts.ps1"

Set-Content $tmp $remoteScript -Encoding UTF8

Write-Host "Script en $tmp" -ForegroundColor Green

Write-Host "En la VM (cmd como Admin): powershell -ExecutionPolicy Bypass -File C:\Windows\Temp\suite-block-hosts.ps1" -ForegroundColor Yellow

if ($Remove) {

    Write-Host "(El script eliminara las entradas si lo ejecutas con -Remove ya embebido)" -ForegroundColor Yellow

}

