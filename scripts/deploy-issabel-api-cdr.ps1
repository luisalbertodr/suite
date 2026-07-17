# Despliega scripts/issabel/api_cdr.php en Issabel.
# Actualiza conservando token/credenciales si ya existe; en instalación nueva crea el fichero.
# Uso:
#   $env:SUITE_ISSABEL_SSH_PASSWORD = '...'
#   $env:ISSABEL_API_TOKEN = '...'   # recomendado en instalación nueva (mismo valor que Supabase)
#   .\scripts\deploy-issabel-api-cdr.ps1
#   .\scripts\deploy-issabel-api-cdr.ps1 -Host 192.168.99.36 -User root

param(
    [string]$IssabelHost = '192.168.99.36',
    [string]$User = 'root',
    [string]$Password = $env:SUITE_ISSABEL_SSH_PASSWORD,
    [string]$ApiToken = $env:ISSABEL_API_TOKEN,
    [string]$RemotePath = '/var/www/html_api/api_cdr.php'
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path $PSScriptRoot -Parent
$genPy = Join-Path $repoRoot 'tmp\gen_apply_api_cdr.py'
$applySh = Join-Path $repoRoot 'tmp\apply-api_cdr.sh'

if (-not (Test-Path $genPy)) {
    throw "Falta $genPy"
}

& python $genPy | Out-Null
if (-not (Test-Path $applySh)) {
    throw "No se generó $applySh"
}

if (-not $Password) {
    throw 'Define SUITE_ISSABEL_SSH_PASSWORD o pasa -Password'
}

$py = @"
import paramiko, pathlib, sys
host = sys.argv[1]
user = sys.argv[2]
password = sys.argv[3]
api_token = sys.argv[4]
script_path = sys.argv[5]
script = pathlib.Path(script_path).read_text(encoding='utf-8')
if api_token:
    script = f"export SUITE_ISSABEL_API_TOKEN={api_token!r}\n" + script
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(host, username=user, password=password, look_for_keys=False, allow_agent=False, timeout=20)
stdin, stdout, stderr = client.exec_command('bash -s')
stdin.write(script)
stdin.channel.shutdown_write()
out = stdout.read().decode('utf-8', errors='replace')
err = stderr.read().decode('utf-8', errors='replace')
code = stdout.channel.recv_exit_status()
client.close()
print(out, end='')
if err.strip():
    print('STDERR:', err, file=sys.stderr)
sys.exit(code)
"@

$tmpPy = Join-Path $env:TEMP "deploy_issabel_api_cdr.py"
Set-Content -Path $tmpPy -Value $py -Encoding UTF8

$venvPython = Join-Path $repoRoot '.venv\Scripts\python.exe'
if (-not (Test-Path $venvPython)) {
    $venvPython = 'python'
}

& $venvPython -m pip install paramiko -q 2>$null
& $venvPython $tmpPy $IssabelHost $User $Password $ApiToken $applySh
if ($LASTEXITCODE -ne 0) {
    Write-Host "Salida remota anterior (si la hay) debería indicar la causa (fichero inexistente, httpd, MySQL...)." -ForegroundColor Yellow
    throw "Despliegue en Issabel falló (exit $LASTEXITCODE)"
}

Write-Host "Despliegue completado en ${User}@${IssabelHost}:${RemotePath}"
