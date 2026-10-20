@echo off
title tabone - Local Wi-Fi Mobile Hub
cd /d "%~dp0"
echo ====================================================
echo  tabone - Local Wi-Fi Mobile Hub
echo ====================================================
echo.
python -c "import socket; s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM); s.connect(('8.8.8.8', 80)); ip = s.getsockname()[0]; s.close(); print(f'>>> Phone URL: http://{ip}:8080/web/\n\n[!] Make sure your phone is connected to the same Wi-Fi.\n[!] In extension Settings, set Viewer URL to: http://{ip}:8080/web/\n[!] Keep this window open while scanning.\n');"
python -m http.server 8080
pause
