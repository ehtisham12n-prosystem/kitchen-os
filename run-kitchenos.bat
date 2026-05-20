@echo off
setlocal

set ROOT=D:\Antigravity\KitchenOS

set NODE_ENV=development
set DB_HOST=127.0.0.1
set DB_PORT=3306
set DB_DATABASE=kitchenos
set DB_USERNAME=root
set DB_PASSWORD=admin123
set JWT_SECRET=KitchenOSJwtSecret12345678901234567890
set PORT=3000

set VITE_API_BASE_URL=http://127.0.0.1:3000/v1

echo Starting backend...
start "KitchenOS Backend" cmd /k "cd /d %ROOT%\backend && npm run start:dev"

echo Starting frontend...
start "KitchenOS Frontend" cmd /k "cd /d %ROOT%\frontend && npm run dev -- --host 127.0.0.1 --port 5173"

echo Starting POS app...
start "KitchenOS POS" cmd /k "cd /d %ROOT%\pos-app && npm run dev -- --host 127.0.0.1 --port 5174"

echo.
echo Backend:  http://127.0.0.1:3000/v1
echo Frontend: http://127.0.0.1:5173
echo POS App:  http://127.0.0.1:5174
pause
