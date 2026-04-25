# Net Worth Tracker 部署指南

這個 PWA 應用程式可以通過多種方式部署，讓您在手機上使用。

## 方案 1: GitHub Pages (推薦 - 免費)

1. **創建 GitHub 倉庫**
   - 登入 GitHub.com
   - 點擊 "New repository"
   - 倉庫名稱：`net-worth-tracker`
   - 設為 Public
   - 不要初始化 README

2. **推送代碼到 GitHub**
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/net-worth-tracker.git
   git branch -M main
   git push -u origin main
   ```

3. **啟用 GitHub Pages**
   - 進入倉庫設置 (Settings)
   - 找到 "Pages" 選項
   - Source 選擇 "Deploy from a branch"
   - Branch 選擇 "main" 和 "/ (root)"
   - 點擊 Save

4. **訪問您的應用**
   - URL: `https://YOUR_USERNAME.github.io/net-worth-tracker/`
   - 通常需要等待 5-10 分鐘生效

## 方案 2: Netlify (免費)

1. **訪問 Netlify.com**
2. **拖拽部署**
   - 將整個 `net-worth-tracker` 文件夾拖到 Netlify 的部署區域
   - 或者連接 GitHub 倉庫自動部署

## 方案 3: Vercel (免費)

1. **訪問 Vercel.com**
2. **導入項目**
   - 連接 GitHub 帳戶
   - 選擇 `net-worth-tracker` 倉庫
   - 點擊 Deploy

## 方案 4: Firebase Hosting (免費)

1. **安裝 Firebase CLI**
   ```bash
   npm install -g firebase-tools
   ```

2. **初始化項目**
   ```bash
   firebase login
   firebase init hosting
   ```

3. **部署**
   ```bash
   firebase deploy
   ```

## PWA 功能

部署後，您的應用程式將支持：

- **離線使用**: Service Worker 緩存資源
- **安裝到主屏幕**: 在手機瀏覽器中點擊"添加到主屏幕"
- **響應式設計**: 自動適配手機和桌面
- **深粉色主題**: 現代化的視覺設計

## 手機使用步驟

1. 在手機瀏覽器中打開部署的 URL
2. 點擊瀏覽器菜單中的"添加到主屏幕"或"安裝應用"
3. 應用圖標將出現在手機桌面
4. 點擊圖標即可像原生應用一樣使用

## 注意事項

- 數據存儲在瀏覽器本地 (localStorage)
- 清除瀏覽器數據會丟失資料
- 建議定期導出數據備份
- HTTPS 是 PWA 功能的必要條件（部署平台都提供）