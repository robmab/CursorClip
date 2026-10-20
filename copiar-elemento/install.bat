@echo off
rem Registra el ayudante de CursorClip en Chrome y Brave (solo tu usuario, sin administrador)
rem Si mueves la carpeta de la extensión, vuelve a ejecutarlo
set "HOST=com.copiar_elemento.helper"
set "MANIFEST=%~dp0native\host.json"

reg add "HKCU\Software\Google\Chrome\NativeMessagingHosts\%HOST%" /ve /t REG_SZ /d "%MANIFEST%" /f >nul
reg add "HKCU\Software\BraveSoftware\Brave-Browser\NativeMessagingHosts\%HOST%" /ve /t REG_SZ /d "%MANIFEST%" /f >nul

echo Helper installed: %MANIFEST%
echo Go back to the extension options and click "Check again".
pause
