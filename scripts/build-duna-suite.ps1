# Build Duna.exe con VFP9 — delega en build-style-duna.ps1 (preparacion automatizada).
$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
& (Join-Path $RepoRoot "scripts\build-style-duna.ps1") @args
