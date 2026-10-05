@echo off
setlocal EnableExtensions DisableDelayedExpansion
chcp 65001 >nul

REM 日本語: 起動場所に依存せず、空白や感嘆符を含むパスも引用して扱う。
REM English: Use the launcher's folder; quote paths and disable delayed expansion.
pushd "%~dp0"
if errorlevel 1 goto path_error

where node.exe >nul 2>&1
if errorlevel 1 goto node_missing
node.exe -e "process.exit(Number(process.versions.node.split('.')[0]) >= 24 ? 0 : 1)"
if errorlevel 1 goto node_version_error
where npm.cmd >nul 2>&1
if errorlevel 1 goto npm_missing
if not exist "package.json" goto files_missing
if not exist "package-lock.json" goto files_missing

REM 日本語: 初回だけ必要な依存関係を取得する。不完全な導入も再試行できる。
REM English: Install missing dependencies from the lockfile, including the Vite dev dependency.
if not exist "node_modules\" goto install_dependencies
if not exist "node_modules\vite\bin\vite.js" goto install_dependencies
if not exist "node_modules\phaser\package.json" goto install_dependencies
goto launch

:install_dependencies
echo.
echo Installing Game1 dependencies. Internet access is needed on first launch.
echo Please wait. This may take a few minutes.
call npm.cmd ci --include=dev
if errorlevel 1 goto install_error

:launch
echo.
echo Starting the local Game1 server.
echo Use the Local URL printed by Vite below.
echo Your default browser will open automatically.
echo Keep this window open while playing. Press Ctrl+C to stop the game server.
echo.
REM 日本語: 既存のdev設定を使い、接続先はこのコンピューター内に限定する。
REM English: Reuse the loopback-only dev script and let Vite open the browser.
call npm.cmd run dev -- --open
if errorlevel 1 goto launch_error
popd
endlocal
exit /b 0

:node_missing
echo.
echo ERROR: Node.js was not found. This game requires Node.js 24 or newer.
echo See the Windows setup section in README.md: https://nodejs.org/en/download
goto fail

:node_version_error
echo.
echo ERROR: Node.js 24 or newer is required. Your current version is:
node.exe --version
echo See README.md for setup instructions. This launcher does not install Node.js.
goto fail

:npm_missing
echo.
echo ERROR: npm.cmd was not found. Install Node.js with npm, then try again.
echo See the Windows setup section in README.md.
goto fail

:files_missing
echo.
echo ERROR: Game files are missing. Extract the entire ZIP before starting.
echo Keep start-game.bat beside package.json and package-lock.json.
goto fail

:install_error
echo.
echo ERROR: Dependency installation failed. Read the npm error above.
echo Check your connection and folder write access, then run this file again.
echo This launcher does not change network settings or request administrator access.
goto fail

:launch_error
echo.
echo ERROR: The game server stopped or could not start. Read the error above.
echo Follow the Vite error above before retrying.
echo If another Game1 window is open, use the Local URL printed in that window.
goto fail

:fail
echo.
echo Press any key to close this window.
pause >nul
popd
endlocal
exit /b 1

:path_error
echo.
echo ERROR: The game folder could not be opened. Extract the ZIP to a writable folder.
echo Press any key to close this window.
pause >nul
endlocal
exit /b 1
