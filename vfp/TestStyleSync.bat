@echo off
setlocal EnableDelayedExpansion
REM Prueba red + token sync. Ejecutar en C:\Style-Dunasoft
cd /d "%~dp0"

if not exist SuiteSync.cfg (
  echo ERROR: falta SuiteSync.cfg en %CD%
  pause
  exit /b 1
)

set "SYNC_URL="
set "SYNC_TOKEN="

REM findstr tolera BOM/encoding mejor que for /f directo sobre el fichero
for /f "usebackq tokens=1,* delims==" %%A in (`findstr /i /r "^SYNC_URL" SuiteSync.cfg`) do (
  if not defined SYNC_URL (
    set "v=%%B"
    if "!v!"=="" set "v=%%A"
    call :Trim v
    set "SYNC_URL=!v!"
  )
)
for /f "usebackq tokens=1,* delims==" %%A in (`findstr /i /r "^SYNC_TOKEN" SuiteSync.cfg`) do (
  if not defined SYNC_TOKEN (
    set "v=%%B"
    if "!v!"=="" set "v=%%A"
    call :Trim v
    set "SYNC_TOKEN=!v!"
  )
)

REM Fallback: lineas tipo "SYNC_URL=https://..." sin parsear por =
if not defined SYNC_URL (
  for /f "usebackq delims=" %%L in (`findstr /i "SYNC_URL" SuiteSync.cfg`) do (
    set "line=%%L"
    set "line=!line:*SYNC_URL=!"
    set "line=!line:*sync_url=!"
    call :Trim line
    if not defined SYNC_URL set "SYNC_URL=!line!"
  )
)
if not defined SYNC_TOKEN (
  for /f "usebackq delims=" %%L in (`findstr /i "SYNC_TOKEN" SuiteSync.cfg`) do (
    set "line=%%L"
    set "line=!line:*SYNC_TOKEN=!"
    set "line=!line:*sync_token=!"
    call :Trim line
    if not defined SYNC_TOKEN set "SYNC_TOKEN=!line!"
  )
)

REM Si hay basura antes de https (BOM, espacios, = suelto), recortar
if not "!SYNC_URL:https=!"=="!SYNC_URL!" (
  set "SYNC_URL=https!SYNC_URL:*https=!"
)
for /f "tokens=* delims==" %%U in ("!SYNC_URL!") do set "SYNC_URL=%%U"
call :Trim SYNC_URL

if not defined SYNC_URL (
  echo ERROR: no se pudo leer SYNC_URL de SuiteSync.cfg
  echo Contenido del fichero:
  type SuiteSync.cfg
  echo.
  echo Consejo: guarda SuiteSync.cfg como ANSI o UTF-8 sin BOM. Formato: SYNC_URL=https://...
  pause
  exit /b 1
)
if not defined SYNC_TOKEN (
  echo ERROR: no se pudo leer SYNC_TOKEN de SuiteSync.cfg
  type SuiteSync.cfg
  pause
  exit /b 1
)

echo URL: !SYNC_URL!
echo Token: !SYNC_TOKEN:~0,8!...
echo.

where curl.exe >nul 2>&1
if errorlevel 1 (
  echo curl.exe no encontrado, probando con PowerShell...
  powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$u='!SYNC_URL!'; $t='!SYNC_TOKEN!'; $b=\"id=$t&tag=stylegetreservas\"; try { $r=Invoke-WebRequest -Uri $u -Method POST -ContentType 'application/x-www-form-urlencoded' -Body $b -UseBasicParsing -TimeoutSec 30; Write-Host ('HTTP ' + $r.StatusCode); Write-Host ('Bytes: ' + $r.Content.Length); if ($r.Content.Length -lt 200) { $r.Content } } catch { Write-Host ('FALLO: ' + $_.Exception.Message); exit 1 }"
  pause
  exit /b !ERRORLEVEL!
)

curl.exe -s -w "\nHTTP_CODE:%%{http_code}\n" -X POST "!SYNC_URL!" -H "Content-Type: application/x-www-form-urlencoded" -d "id=!SYNC_TOKEN!&tag=stylegetreservas" -o "%TEMP%\style_sync_test.xml"
if errorlevel 1 (
  echo FALLO curl. Codigo: !ERRORLEVEL!
  pause
  exit /b 1
)

for %%F in ("%TEMP%\style_sync_test.xml") do echo Respuesta: %%~zF bytes
findstr /i "<raiz/>" "%TEMP%\style_sync_test.xml" >nul && echo Cola vacia ^(raiz vacio^) || echo Hay citas pendientes en cola
echo.
echo Si HTTP_CODE:200 y hay bytes, la VM llega a Suite.
pause
exit /b 0

:Trim
set "x=!%1!"
for /f "tokens=* delims= " %%T in ("!x!") do set "x=%%T"
if defined x if "!x:~-1!"==" " set "x=!x:~0,-1!"
set "%1=!x!"
exit /b 0
