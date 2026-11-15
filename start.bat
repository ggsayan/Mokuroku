@echo off
rem Double-click to start Mokuroku and open it in your default browser.
cd /d "%~dp0"
start "" http://127.0.0.1:9153
node server.js
pause
