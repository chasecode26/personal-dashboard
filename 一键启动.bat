@echo off
chcp 65001 >nul
cd /d "%~dp0app"
set "LOG=%~dp0启动日志.txt"
set "STEP=未知步骤"
> "%LOG%" echo [NEXUS] 启动日志 %DATE% %TIME%

if not exist "node_modules" goto install
goto checkdist

:install
echo [1/3] Installing dependencies...
>> "%LOG%" echo [1/3] npm install
call npm install
if not errorlevel 1 goto checkdist
set "STEP=npm install"
goto fail

:checkdist
node scripts\needs-build.cjs
if errorlevel 20 goto buildcheck_fail
if errorlevel 10 goto launch
echo [2/3] Building web assets...
>> "%LOG%" echo [2/3] npm run build:web
call npm run build:web
if not errorlevel 1 goto launch
set "STEP=npm run build:web"
goto fail

:buildcheck_fail
set "STEP=构建检查（needs-build）"
goto fail

:launch
echo Launching NEXUS dashboard...
>> "%LOG%" echo [3/3] 启动窗口
call npm run electron
if not errorlevel 1 goto end_ok
set "STEP=Electron 启动"
goto fail

:fail
>> "%LOG%" echo.
>> "%LOG%" echo ===== 启动失败：%STEP% =====
echo.
echo ===== 启动失败：%STEP% =====
echo 详细报错见「启动日志.txt」，或双击「一键启动.bat」在控制台查看完整输出。
rem 由 VBS 隐藏启动时控制台不可见，pause 会永久卡住，必须跳过
if defined NEXUS_HIDDEN goto fail_hidden
pause
:fail_hidden
exit /b 1

:end_ok
>> "%LOG%" echo 已退出 %TIME%
