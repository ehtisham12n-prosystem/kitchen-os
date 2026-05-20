@echo off
set NODE_ENV=development
set DB_HOST=127.0.0.1
set DB_PORT=3306
set DB_DATABASE=kitchenos
set DB_USERNAME=root
set DB_PASSWORD=admin123
set JWT_SECRET=KitchenOSJwtSecret12345678901234567890
set PORT=3000
cd /d D:\Antigravity\KitchenOS\backend
"C:\Program Files\nodejs\node.exe" dist\src\main.js > backend-live.log 2>&1
