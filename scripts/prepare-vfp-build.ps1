# Build Duna.exe con VFP9 (sin ReFox)
$ErrorActionPreference = "Stop"
& (Join-Path (Split-Path -Parent $PSScriptRoot) "scripts\build-duna-suite.ps1")
