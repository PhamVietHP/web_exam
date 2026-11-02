@echo off
cd /d "%~dp0backend"
call npm install
call npm start
pause
