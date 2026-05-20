@echo off
TITLE KitchenOS - Local Development Environment

echo ==========================================
echo    🍳 KitchenOS - Launching Services
echo ==========================================

:: Start Backend
echo [1/4] Starting Backend (NestJS)...
set NODE_ENV=development
set DB_HOST=127.0.0.1
set DB_PORT=3306
set DB_DATABASE=kitchenos
set DB_USERNAME=root
set DB_PASSWORD=admin123
set JWT_SECRET=KitchenOSJwtSecret12345678901234567890
set PORT=3000
cd backend
start "KitchenOS Backend" cmd /k "npm run start:dev"
cd ..

:: Start Frontend
echo [2/4] Starting Frontend (Web)...
cd frontend
start "KitchenOS Frontend" cmd /k "npm run dev"
cd ..

:: Start POS (Electron)
echo [3/4] Starting Offline POS (Electron)...
cd pos
start "KitchenOS POS" cmd /k "npm run electron:dev"
cd ..

:: Wait for services to warm up
echo [4/4] Preparing to open portals...
timeout /t 5 /nobreak > nul

:: Open Portals in Browser
echo Opening Nexus (System Admin)...
start http://localhost:5173/nexus
echo Opening Console (Operations)...
start http://localhost:5173/console

echo ==========================================
echo ✅ All services launched!
echo Backend:  http://localhost:3000
echo Frontend: http://localhost:5173
echo POS:      http://localhost:5190 (Electron Window)
echo ==========================================
pause
