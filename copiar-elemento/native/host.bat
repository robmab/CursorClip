@echo off
rem Chrome arranca esto al copiar; todo el trabajo lo hace host.ps1
powershell -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -STA -File "%~dp0host.ps1"
