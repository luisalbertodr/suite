# Normaliza el ultimo build VFP a Duna.exe (+ Duna2.exe copia de trabajo).
$ErrorActionPreference = "Stop"
$Export = "C:\Duna\Export"

function Get-LatestBuildExe {
    param([string]$Root)
    $names = @("mscomctl.exe", "Duna2.exe", "DunaNew.exe", "Duna.exe")
    $items = foreach ($n in $names) {
        $p = Join-Path $Root $n
        if (Test-Path $p) { Get-Item $p }
    }
    if (-not $items) { return $null }
    return ($items | Sort-Object LastWriteTime -Descending | Select-Object -First 1)
}

$src = Get-LatestBuildExe $Export
if (-not $src) {
    throw "No hay mscomctl.exe / Duna2.exe / Duna.exe en $Export. Build: DO PROGS\VfpBuildProject.prg"
}

$dst = Join-Path $Export "Duna.exe"
$dst2 = Join-Path $Export "Duna2.exe"
$di = if (Test-Path $dst) { Get-Item $dst } else { $null }

if ($di -and $src.FullName -eq $di.FullName) {
    Write-Host "Duna.exe ya es el build mas reciente ($($src.Name))." -ForegroundColor Green
    exit 0
}

if ($di -and $src.LastWriteTime -le $di.LastWriteTime -and $src.Length -eq $di.Length -and $src.Name -eq "Duna.exe") {
    Write-Host "Duna.exe ya esta al dia." -ForegroundColor Green
    exit 0
}

Copy-Item $src.FullName $dst -Force
if ($src.FullName -ne $dst2) {
    Copy-Item $src.FullName $dst2 -Force
}
Write-Host ("OK build {0} -> Duna.exe" -f $src.Name) -NoNewline
if ($src.FullName -ne $dst2) { Write-Host " + Duna2.exe" -NoNewline }
Write-Host ("  {0} bytes  {1}" -f (Get-Item $dst).Length, (Get-Item $dst).LastWriteTime) -ForegroundColor Green
