# Build del frontend (Vite) y subida a la raíz del sitio en aaPanel.
# Requiere acceso SSH por clave (misma clave que deploy-edge-functions).
#
# Uso:
#   .\scripts\deploy-frontend.ps1
#   .\scripts\deploy-frontend.ps1 -SkipBuild
#   .\scripts\deploy-frontend.ps1 -Backup
#   .\scripts\deploy-frontend.ps1 -DryRun
#
# Variables opcionales:
#   $env:SUITE_WEB_SSH_HOST = "suite-web"
#   $env:SUITE_WEB_ROOT = "/www/wwwroot/suite.lipoout.com"
#   $env:SUITE_WEB_DOMAIN = "suite.lipoout.com"

param(
  [switch]$SkipBuild,
  [switch]$SkipUpload,
  [switch]$DryRun,
  [switch]$Backup,
  [switch]$SkipVerify
)

$ErrorActionPreference = "Stop"

$SshOpts = @("-o", "ConnectTimeout=15", "-o", "ServerAliveInterval=10", "-o", "ServerAliveCountMax=3")
$SshTarget = if ($env:SUITE_WEB_SSH_HOST) { $env:SUITE_WEB_SSH_HOST } else { "suite-web" }
$RemoteRoot = if ($env:SUITE_WEB_ROOT) {
  $env:SUITE_WEB_ROOT
} else {
  "/www/wwwroot/suite.lipoout.com"
}
$Domain = if ($env:SUITE_WEB_DOMAIN) { $env:SUITE_WEB_DOMAIN } else { "suite.lipoout.com" }

$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

function Test-SshKeyAuth {
  $null = ssh @SshOpts -o BatchMode=yes $SshTarget "echo ok" 2>&1
  return $LASTEXITCODE -eq 0
}

function Test-EnvFile {
  $envPath = Join-Path $RepoRoot ".env"
  if (-not (Test-Path $envPath)) {
    throw "No existe .env. Copia .env.example y rellena VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY."
  }
  $content = Get-Content $envPath -Raw
  if ($content -notmatch 'VITE_SUPABASE_URL\s*=\s*[^\s#]+') {
    throw "Falta VITE_SUPABASE_URL en .env"
  }
  if ($content -notmatch 'VITE_SUPABASE_ANON_KEY\s*=\s*[^\s#]+') {
    throw "Falta VITE_SUPABASE_ANON_KEY en .env"
  }
}

if (-not $SkipUpload -and -not $DryRun) {
  if (-not (Test-SshKeyAuth)) {
    Write-Host ""
    Write-Host "No hay acceso SSH por clave a $SshTarget." -ForegroundColor Yellow
    Write-Host "Configura la clave en el servidor aaPanel (192.168.99.112):" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  .\scripts\setup-ssh-deploy.ps1 -IncludeWeb" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "O manualmente:" -ForegroundColor Yellow
    Write-Host "  type `"$env:USERPROFILE\.ssh\suite_deploy.pub`" | ssh root@192.168.99.112 `"mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys`"" -ForegroundColor Cyan
    Write-Host ""
    exit 1
  }
}

if (-not $SkipBuild) {
  Test-EnvFile
  Write-Host "Compilando frontend (npm run build) ..." -ForegroundColor Green
  npm run build
  if ($LASTEXITCODE -ne 0) { throw "npm run build falló" }
}

$distDir = Join-Path $RepoRoot "dist"
if (-not (Test-Path $distDir)) {
  throw "No existe dist/. Ejecuta npm run build primero."
}

$indexPath = Join-Path $distDir "index.html"
if (-not (Test-Path $indexPath)) {
  throw "dist/index.html no encontrado. El build parece incompleto."
}

if ($DryRun) {
  Write-Host "DryRun: build OK, dist listo en $distDir" -ForegroundColor Green
  exit 0
}

if ($SkipUpload) {
  Write-Host "SkipUpload: build listo en $distDir" -ForegroundColor Green
  exit 0
}

$remoteRootEscaped = $RemoteRoot -replace "'", "'\\''"

if ($Backup) {
  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $backupPath = "${RemoteRoot}_backup_${stamp}"
  Write-Host "Backup remoto -> $backupPath ..." -ForegroundColor Green
  ssh @SshOpts $SshTarget "if [ -d '$remoteRootEscaped' ] && [ `"`$(ls -A '$remoteRootEscaped' 2>/dev/null)`" ]; then cp -a '$remoteRootEscaped' '$backupPath'; fi"
  if ($LASTEXITCODE -ne 0) { throw "Backup remoto falló" }
}

Write-Host "Limpiando $RemoteRoot ..." -ForegroundColor Green
ssh @SshOpts $SshTarget "mkdir -p '$remoteRootEscaped' && find '$remoteRootEscaped' -mindepth 1 ! -name '.user.ini' -delete"
if ($LASTEXITCODE -ne 0) { throw "No se pudo limpiar el directorio remoto" }

Write-Host "Subiendo dist/ -> ${SshTarget}:${RemoteRoot}/ ..." -ForegroundColor Green
& scp @SshOpts -r "$distDir/." "${SshTarget}:${RemoteRoot}/"
if ($LASTEXITCODE -ne 0) { throw "scp falló" }

Write-Host "Verificando permisos ..." -ForegroundColor Green
# aaPanel crea .user.ini con chattr +i; chmod -R falla ahí aunque el resto esté bien.
ssh @SshOpts $SshTarget "find '$remoteRootEscaped' ! -name '.user.ini' -exec chmod a+rX {} +"
if ($LASTEXITCODE -ne 0) {
  Write-Host "Aviso: chmod parcial (normal si existe .user.ini de aaPanel)." -ForegroundColor Yellow
}

if (-not $SkipVerify) {
  Write-Host "Comprobando https://${Domain}/ ..." -ForegroundColor Green
  try {
    $response = Invoke-WebRequest -Uri "https://${Domain}/" -Method Head -TimeoutSec 15 -UseBasicParsing
    if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) {
      Write-Host "HTTP $($response.StatusCode) OK" -ForegroundColor Green
    } else {
      Write-Host "Aviso: HTTP $($response.StatusCode). Revisa Nginx/SSL en aaPanel." -ForegroundColor Yellow
    }
  } catch {
    Write-Host "Aviso: no se pudo verificar https://${Domain}/ ($($_.Exception.Message))" -ForegroundColor Yellow
    Write-Host "Si el sitio es solo LAN, comprueba DNS/firewall o usa -SkipVerify." -ForegroundColor Yellow
  }
}

Write-Host ""
Write-Host "Frontend desplegado en https://${Domain}/" -ForegroundColor Green
