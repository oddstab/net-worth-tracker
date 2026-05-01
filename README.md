# Net Worth Tracker

> 個人資產追蹤器 — 免費、開源的漸進式網頁應用（PWA），所有資料儲存於本地裝置，不傳送至任何伺服器。

🔗 **Live Demo**: [https://oddstab.github.io/net-worth-tracker/](https://oddstab.github.io/net-worth-tracker/)

## Features

### 資產管理
- **台股（TWSE/OTC）** — 即時股價自動更新，支援代號搜尋
- **加密貨幣** — 透過 CoinGecko API 取得即時價格
- **現金與其他資產** — 手動輸入管理
- **多筆持股整合** — 相同代號自動合併顯示，展開可見個別明細

### 負債管理
- **信貸 / 房貸** — 本息平均攤還 & 本金平均攤還計算
- **質押借款** — 擔保維持率、可承受跌幅、再質押維持率即時計算
- **理財型房貸** — 動用金額滑桿、計息天數計算器
- **還款明細表** — 展開可見每期還本、利息、餘額

### 儀表板
- **淨資產總覽** — 四格快速數字卡片（淨資產、投資總額、負債、月增率）
- **資產配置圓餅圖** — 投資資產 vs 債務比例，hover 顯示個別持股明細
- **資產趨勢折線圖** — 1 週 / 1 月 / 6 月 / 1 年 / 全部 / 自訂範圍
- **每日盈虧日曆** — 月曆格式顯示每日淨資產變化，正值綠色、負值紅色

### 股票質押計算
- 擔保維持率即時計算（130% 斷頭線）
- 可承受跌幅精確到小數點兩位
- 再質押維持率（借款再投入後的維持率）
- 借款金額滑桿 + 維持率快捷按鈕 + 自訂輸入
- 質押負債自動關聯，刪除股票時驗證維持率

### 計算工具箱
- **報酬率計算** — 總報酬、CAGR、算術/幾何平均報酬
- **期貨與槓桿** — 槓桿倍率、距離斷頭跌幅、追繳金額
- **股票質押** — 擔保維持率、斷頭價格、再質押報酬率
- **再平衡** — 資產偏離度與買賣建議

### 多語言支援（i18n）
- 繁體中文（zh-TW）
- 簡體中文（zh-CN）
- English（en）
- 日本語（ja）
- 한국어（ko）

### PWA & 離線支援
- 可安裝至手機主畫面
- Service Worker 快取策略（Cache First + Network First）
- 離線可用

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | SvelteKit 2 (SPA mode, adapter-static) |
| Language | JavaScript (ES Modules) |
| Styling | CSS Custom Properties (Dark/Light theme) |
| Charts | Chart.js 4 |
| Icons | Inline SVG (跨裝置一致) |
| State | Svelte writable stores + Observer pattern |
| Storage | localStorage (nwt_* keys) |
| APIs | TWSE (台股即時), CoinGecko (加密貨幣) |
| Testing | Vitest + fast-check (property-based) |
| Deploy | GitHub Pages via GitHub Actions |

## Getting Started

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run tests
npm test
```

## Project Structure

```
src/
├── app.css                    # Global styles (CSS custom properties)
├── app.html                   # HTML template
├── components/
│   ├── Icon.svelte            # Unified SVG icon component
│   ├── NavBar.svelte          # Desktop + mobile capsule navigation
│   ├── FAB.svelte             # Floating action button
│   ├── Toast.svelte           # Toast notifications
│   ├── ConfirmDialog.svelte   # Confirmation dialog
│   ├── assets/                # Asset/Liability list & item components
│   ├── dashboard/             # PieChart, TrendChart, PnlCalendar, QuickStats
│   ├── modals/                # Asset, Liability, Pledge modals
│   └── settings/              # Settings page components
├── lib/
│   ├── i18n/                  # Language files (zh-TW, en, zh-CN, ja, ko)
│   ├── price/                 # Price fetching (TWSE, CoinGecko)
│   ├── services/              # i18n, storage, snapshot, search, Google Sheets
│   ├── stores/                # Svelte writable stores
│   └── utils/                 # Calculator, scroll lock
├── routes/
│   ├── +layout.svelte         # Root layout (NavBar, FAB, swipe navigation)
│   ├── +page.svelte           # Dashboard
│   ├── assets/+page.svelte    # Asset & liability list
│   ├── tools/+page.svelte     # Calculator tools
│   └── settings/+page.svelte  # Settings
└── static/
    ├── manifest.json           # PWA manifest
    ├── sw.js                   # Service worker
    └── icons/                  # PWA icons
```

## License

MIT
