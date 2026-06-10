# Ejecutar EN LA VM Style (119) para comprobar red + token.
#   cd C:\Style-Dunasoft
#   powershell -ExecutionPolicy Bypass -File C:\Style-Dunasoft\TestStyleSync.ps1

$cfgPath = Join-Path (Get-Location) "SuiteSync.cfg"
if (-not (Test-Path $cfgPath)) {
    Write-Host "ERROR: no existe SuiteSync.cfg en $(Get-Location)" -ForegroundColor Red
    exit 1
}

$cfg = @{}
Get-Content $cfgPath | ForEach-Object {
    if ($_ -match '^\s*([^#=]+)=(.*)$') {
        $cfg[$matches[1].Trim()] = $matches[2].Trim()
    }
}

$url = $cfg['SYNC_URL']
$token = $cfg['SYNC_TOKEN']
if (-not $url -or -not $token) {
    Write-Host "ERROR: SYNC_URL o SYNC_TOKEN vacios en SuiteSync.cfg" -ForegroundColor Red
    exit 1
}

Write-Host "Probando $url ..." -ForegroundColor Cyan
try {
    $body = "id=$token&tag=stylegetreservas"
    $resp = Invoke-WebRequest -Uri $url -Method POST -ContentType "application/x-www-form-urlencoded" -Body $body -UseBasicParsing -TimeoutSec 30
    Write-Host "HTTP $($resp.StatusCode)" -ForegroundColor Green
    $len = $resp.Content.Length
    Write-Host "Respuesta: $len bytes (XML con citas pendientes o <raiz/> vacio)"
    if ($len -lt 200) { Write-Host $resp.Content }
} catch {
    Write-Host "FALLO red/SSL: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
