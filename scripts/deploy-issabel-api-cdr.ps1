# Despliega scripts/issabel/api_cdr.php en Issabel conservando token y credenciales DB.
# Uso:
#   $env:SUITE_ISSABEL_SSH_PASSWORD = '...'
#   .\scripts\deploy-issabel-api-cdr.ps1
#   .\scripts\deploy-issabel-api-cdr.ps1 -Host 192.168.99.36 -User root

param(
    [string]$IssabelHost = '192.168.99.36',
    [string]$User = 'root',
    [string]$Password = $env:SUITE_ISSABEL_SSH_PASSWORD,
    [string]$RemotePath = '/var/www/html_api/api_cdr.php',
    [string]$ApplyScriptUrl = 'http://192.168.99.110:9876/apply-api_cdr.sh'
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
script = pathlib.Path(sys.argv[4]).read_text(encoding='utf-8')
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
& $venvPython $tmpPy $IssabelHost $User $Password $applySh
if ($LASTEXITCODE -ne 0) {
    throw "Despliegue en Issabel falló (exit $LASTEXITCODE)"
}

Write-Host "Despliegue completado en ${User}@${IssabelHost}:${RemotePath}"
