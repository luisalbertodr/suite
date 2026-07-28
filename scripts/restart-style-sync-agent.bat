@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0restart_style_agent.ps1"
if errorlevel 1 pause
