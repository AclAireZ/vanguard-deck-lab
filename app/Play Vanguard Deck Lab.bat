@echo off
rem Vanguard Deck Lab - opens the game in its own window (Microsoft Edge or Google Chrome app window, own profile, no browser bars)
setlocal
set "GAME=%~dp0game\VanguardDeckLab.html"
if not exist "%GAME%" (
  echo Game file not found: "%GAME%"
  pause
  exit /b 1
)
set "URL=file:///%GAME:\=/%"
set "PROF=%LOCALAPPDATA%\VanguardDeckLab\profile"
set "BR="
for %%P in ("%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" "%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe") do (
  if not defined BR if exist "%%~P" set "BR=%%~P"
)
if not defined BR (
  echo Microsoft Edge or Google Chrome is needed to run the game.
  pause
  exit /b 1
)
start "" "%BR%" --app="%URL%" --user-data-dir="%PROF%" --start-maximized --no-first-run --no-default-browser-check --disable-features=Translate --autoplay-policy=no-user-gesture-required
exit /b 0
