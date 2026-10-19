@echo off
rem Puts a "Vanguard Deck Lab" shortcut with the game icon on the desktop
setlocal
set "HERE=%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$w = New-Object -ComObject WScript.Shell; $d = [Environment]::GetFolderPath('Desktop'); $s = $w.CreateShortcut((Join-Path $d 'Vanguard Deck Lab.lnk')); $s.TargetPath = '%HERE%Play Vanguard Deck Lab.bat'; $s.WorkingDirectory = '%HERE%'; $s.IconLocation = '%HERE%game\vg.ico'; $s.WindowStyle = 7; $s.Description = 'Vanguard D Deck Lab'; $s.Save()"
if errorlevel 1 (
  echo Could not create the shortcut.
  pause
  exit /b 1
)
echo Shortcut "Vanguard Deck Lab" is on your desktop.
timeout /t 3 >nul
