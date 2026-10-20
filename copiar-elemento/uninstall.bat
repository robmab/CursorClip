@echo off
rem Quita el ayudante de CursorClip y el .md temporal; la extensión vuelve al modo @ruta
set "HOST=com.copiar_elemento.helper"

reg delete "HKCU\Software\Google\Chrome\NativeMessagingHosts\%HOST%" /f >nul 2>&1
reg delete "HKCU\Software\BraveSoftware\Brave-Browser\NativeMessagingHosts\%HOST%" /f >nul 2>&1
if exist "%TEMP%\copiar-elemento" rmdir /s /q "%TEMP%\copiar-elemento"

echo Ayudante desinstalado.
pause
