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

$IdentityFile = Join-Path $env:USERPROFILE ".ssh\suite_deploy"
$SshOpts = @("-o", "ConnectTimeout=15", "-o", "ServerAliveInterval=10", "-o", "ServerAliveCountMax=3")
if (Test-Path $IdentityFile) {
  $SshOpts += @("-i", $IdentityFile, "-o", "IdentitiesOnly=yes")
}
$SshTarget = if ($env:SUITE_WEB_SSH_HOST) { $env:SUITE_WEB_SSH_HOST } else { "suite-web" }
# Fallback si el alias suite-web no está en ~/.ssh/config
if ($SshTarget -eq "suite-web") {
  # ssh -G puede escribir avisos a stderr; no deben abortar el script con $ErrorActionPreference Stop
  cmd /c "ssh -G suite-web >nul 2>&1"
  if ($LASTEXITCODE -ne 0) {
    $SshTarget = "root@192.168.99.112"
  }
}
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
  # Vite escribe warnings a stderr; con $ErrorActionPreference=Stop PowerShell
  # los trata como NativeCommandError aunque el build sea exit 0.
  $prevEap = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  npm run build
  $buildExit = $LASTEXITCODE
  $ErrorActionPreference = $prevEap
  if ($buildExit -ne 0) { throw "npm run build falló" }
}

$distDir = Join-Path $RepoRoot "dist"
if (-not (Test-Path $distDir)) {
  throw "No existe dist/. Ejecuta npm run build primero."
}

$indexPath = Join-Path $distDir "index.html"
if (-not (Test-Path $indexPath)) {
  throw "dist/index.html no encontrado. El build parece incompleto."
}

# Evita redesplegar un dist compilado sin los fixes de Safari/Chrome antiguos
# (p. ej. desde una feature branch que no tiene vite.config legacy al día).
function Test-LegacyBrowserBuild {
  param([string]$DistRoot)
  $index = Join-Path $DistRoot "index.html"
  $html = Get-Content $index -Raw -Encoding UTF8

  if ($html -notmatch 'suite-boot-error') {
    throw "dist/index.html sin overlay suite-boot-error. ¿Build desde main con index.html actualizado?"
  }
  if ($html -notmatch 'id="vite-legacy-polyfill"') {
    throw "dist/index.html sin vite-legacy-polyfill. Falta force-systemjs-for-all-browsers en vite.config.ts."
  }
  if ($html -notmatch 'id="vite-legacy-entry"') {
    throw "dist/index.html sin vite-legacy-entry. Rebuild con vite.config legacy."
  }
  # SystemJS-only: no deben quedar módulos de app (causan Script error. en Safari/Chrome viejos).
  if ($html -match 'type=["'']module["'']') {
    throw "dist/index.html aún tiene type=module. El rewrite SystemJS-only no se aplicó."
  }
  if ($html -match '\bnomodule\b') {
    throw "dist/index.html aún tiene nomodule. El rewrite SystemJS-only no se aplicó."
  }
  if ($html -match '<script[^>]*\scrossorigin') {
    throw "dist/index.html tiene crossorigin en <script> (enmascara errores como 'Script error.')."
  }

  $legacy = Get-ChildItem (Join-Path $DistRoot "assets") -Filter "index-legacy-*.js" -ErrorAction SilentlyContinue |
    Sort-Object Length -Descending |
    Select-Object -First 1
  if (-not $legacy) {
    throw "No hay assets/index-legacy-*.js. plugin-legacy no generó chunks."
  }

  # Muestreo: demasiados ?. reales indica targets Babel altos (Chrome 87+/Safari 14+).
  $sample = Get-Content $legacy.FullName -Raw -Encoding UTF8
  $optionalish = ([regex]::Matches($sample, '\w\?\.\w')).Count
  if ($optionalish -gt 50) {
    throw ("Bundle legacy {0} tiene {1} '?.' sin transpilar. Targets Babel deben ser Chrome >= 63 / Safari >= 11." -f $legacy.Name, $optionalish)
  }
  if ($sample -match '\(\?<[=!]') {
    throw ("Bundle legacy {0} contiene lookbehind (?<=)/(?<!). Incompatible con Safari <16.4." -f $legacy.Name)
  }
  if ($sample -match '\\p\{') {
    throw ("Bundle legacy {0} contiene \\p{{...}} unicode properties. Usa src/lib/unicodeText.ts." -f $legacy.Name)
  }

  Write-Host ("OK compat navegadores antiguos: {0} (?.~{1})" -f $legacy.Name, $optionalish) -ForegroundColor Green
}

Test-LegacyBrowserBuild -DistRoot $distDir

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
# Ignorar errores en morphoscan u otros ficheros protegidos; no abortar el deploy.
ssh @SshOpts $SshTarget "mkdir -p '$remoteRootEscaped' && find '$remoteRootEscaped' -mindepth 1 ! -name '.user.ini' ! -path '*/morphoscan*' -delete; true"
if ($LASTEXITCODE -ne 0) {
  Write-Host "Aviso: limpieza remota parcial; se continúa con la subida." -ForegroundColor Yellow
}

Write-Host "Subiendo dist/ -> ${SshTarget}:${RemoteRoot}/ ..." -ForegroundColor Green
& scp @SshOpts -r "$distDir/." "${SshTarget}:${RemoteRoot}/"
if ($LASTEXITCODE -ne 0) { throw "scp falló" }

Write-Host "Verificando permisos ..." -ForegroundColor Green
# aaPanel crea .user.ini con chattr +i; chmod -R falla ahí aunque el resto esté bien.
# Tras scp como root, sin chown/chmod nginx (www) devolvía 403 en /assets/*.
ssh @SshOpts $SshTarget "chown -R www:www '$remoteRootEscaped' 2>/dev/null; find '$remoteRootEscaped' ! -name '.user.ini' -exec chmod a+rX {} +"
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
