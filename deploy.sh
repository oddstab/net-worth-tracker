#!/bin/bash

echo "================================"
echo "Net Worth Tracker 部署腳本"
echo "================================"
echo

echo "請選擇部署方式:"
echo "1. GitHub Pages (需要先創建 GitHub 倉庫)"
echo "2. 本地測試服務器"
echo "3. 顯示部署指南"
echo

read -p "請輸入選項 (1-3): " choice

case $choice in
    1)
        echo
        echo "正在準備 GitHub Pages 部署..."
        echo "請確保您已經在 GitHub 創建了倉庫"
        echo
        read -p "請輸入您的 GitHub 用戶名: " username
        read -p "請輸入倉庫名稱 (預設: net-worth-tracker): " reponame
        
        if [ -z "$reponame" ]; then
            reponame="net-worth-tracker"
        fi
        
        echo
        echo "添加遠程倉庫..."
        git remote add origin https://github.com/$username/$reponame.git
        git branch -M main
        git push -u origin main
        
        echo
        echo "部署完成！"
        echo "請到 GitHub 倉庫設置中啟用 Pages"
        echo "您的應用將在: https://$username.github.io/$reponame/"
        ;;
    2)
        echo
        echo "啟動本地測試服務器..."
        echo "在瀏覽器中打開: http://localhost:8000"
        echo "按 Ctrl+C 停止服務器"
        echo
        
        # 嘗試不同的 HTTP 服務器
        if command -v python3 &> /dev/null; then
            python3 -m http.server 8000
        elif command -v python &> /dev/null; then
            python -m http.server 8000
        elif command -v npx &> /dev/null; then
            npx serve -s . -l 8000
        else
            echo "錯誤: 找不到 Python 或 Node.js"
            echo "請安裝 Python 或 Node.js 來運行本地服務器"
        fi
        ;;
    3)
        echo
        echo "正在打開部署指南..."
        if command -v xdg-open &> /dev/null; then
            xdg-open DEPLOYMENT.md
        elif command -v open &> /dev/null; then
            open DEPLOYMENT.md
        else
            cat DEPLOYMENT.md
        fi
        ;;
    *)
        echo "無效選項"
        ;;
esac