@echo off
echo ================================
echo Net Worth Tracker 部署腳本
echo ================================
echo.

echo 請選擇部署方式:
echo 1. GitHub Pages (需要先創建 GitHub 倉庫)
echo 2. 本地測試服務器
echo 3. 顯示部署指南
echo.

set /p choice="請輸入選項 (1-3): "

if "%choice%"=="1" goto github
if "%choice%"=="2" goto local
if "%choice%"=="3" goto guide
goto end

:github
echo.
echo 正在準備 GitHub Pages 部署...
echo 請確保您已經在 GitHub 創建了倉庫
echo.
set /p username="請輸入您的 GitHub 用戶名: "
set /p reponame="請輸入倉庫名稱 (預設: net-worth-tracker): "

if "%reponame%"=="" set reponame=net-worth-tracker

echo.
echo 添加遠程倉庫...
git remote add origin https://github.com/%username%/%reponame%.git
git branch -M main
git push -u origin main

echo.
echo 部署完成！
echo 請到 GitHub 倉庫設置中啟用 Pages
echo 您的應用將在: https://%username%.github.io/%reponame%/
goto end

:local
echo.
echo 啟動本地測試服務器...
echo 在瀏覽器中打開: http://localhost:8000
echo 按 Ctrl+C 停止服務器
echo.
python -m http.server 8000
goto end

:guide
echo.
echo 正在打開部署指南...
start DEPLOYMENT.md
goto end

:end
echo.
pause