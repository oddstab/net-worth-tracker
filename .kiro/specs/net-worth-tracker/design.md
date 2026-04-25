# 設計文件

## 系統架構

### 整體架構

Net Worth Tracker 是一個純前端的單頁應用（SPA），以 PWA 形式運行，無需後端伺服器。

```
┌─────────────────────────────────────────────────────┐
│                    瀏覽器 / PWA                       │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ Dashboard│  │ AssetList│  │   TrendChart     │  │
│  │  (圓餅圖) │  │ (資產清單)│  │   (趨勢折線圖)   │  │
│  └────┬─────┘  └────┬─────┘  └────────┬─────────┘  │
│       │              │                  │            │
│  ┌────▼──────────────▼──────────────────▼─────────┐ │
│  │              AppState (狀態管理)                 │ │
│  └────┬──────────────┬──────────────────┬─────────┘ │
│       │              │                  │            │
│  ┌────▼────┐  ┌──────▼──────┐  ┌───────▼─────────┐ │
│  │Storage  │  │PriceFetcher │  │ SnapshotManager │ │
│  │(本地儲存)│  │(價格抓取)   │  │ (快照管理)      │ │
│  └─────────┘  └─────────────┘  └─────────────────┘ │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │           Service Worker (離線快取)           │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
         │                        │
    ┌────▼────┐              ┌────▼────────┐
    │  TWSE   │              │  CoinGecko  │
    │  API    │              │  API        │
    └─────────┘              └─────────────┘
```

### 檔案結構

```
net-worth-tracker/
├── index.html              # 主頁面（SPA 入口）
├── manifest.json           # PWA Manifest
├── sw.js                   # Service Worker
├── css/
│   └── style.css           # 全域樣式（深色主題）
├── js/
│   ├── app.js              # 應用入口、路由、初始化
│   ├── state.js            # 全域狀態管理
│   ├── storage.js          # localStorage 讀寫封裝
│   ├── priceFetcher.js     # 台股 / 加密貨幣價格抓取
│   ├── snapshotManager.js  # 淨資產快照管理
│   ├── calculator.js       # 淨資產、小計、月增率計算
│   └── ui/
│       ├── dashboard.js    # 儀表板（4格數字 + 圓餅圖）
│       ├── assetList.js    # 資產清單（新增/編輯/刪除）
│       ├── trendChart.js   # 趨勢折線圖
│       ├── modal.js        # 新增/編輯 Modal
│       └── settings.js     # 設定頁（匯率、匯出/匯入）
└── icons/
    ├── icon-192.png
    └── icon-512.png
```

---

## 資料模型

### localStorage 鍵值結構

| 鍵名 | 型別 | 說明 |
|------|------|------|
| `nwt_assets` | `Asset[]` | 所有資產項目 |
| `nwt_liabilities` | `Liability[]` | 所有負債項目 |
| `nwt_exchange_rate` | `number` | USD/TWD 匯率 |
| `nwt_snapshots` | `Snapshot[]` | 淨資產歷史快照 |

### 型別定義

```typescript
type AssetCategory = 'investment' | 'liquid';
type AssetType = 'tw_stock' | 'crypto' | 'cash' | 'other';
type LiabilityCategory = 'credit' | 'pledge';
type Currency = 'TWD' | 'USD';

interface Asset {
  id: string;              // UUID
  name: string;            // 資產名稱（例：正二）
  symbol: string;          // 代號（例：00631L、BTC），選填
  category: AssetCategory; // 'investment' | 'liquid'
  type: AssetType;         // 用於決定價格抓取方式
  quantity: number;        // 持有數量（> 0）
  currency: Currency;      // 計價幣別
  pricePerUnit: number;    // 每單位價格（> 0）
  priceSource: 'auto' | 'manual'; // 價格來源
  lastPriceUpdate: string | null; // ISO 8601 時間戳
}

interface Liability {
  id: string;                    // UUID
  name: string;                  // 負債名稱
  category: LiabilityCategory;  // 'credit' | 'pledge'
  amount: number;                // 金額（> 0）
  currency: Currency;            // 計價幣別
}

interface Snapshot {
  date: string;      // ISO 8601 日期（YYYY-MM-DD）
  netWorth: number;  // 當時淨資產（TWD）
}

interface AppData {
  assets: Asset[];
  liabilities: Liability[];
  exchangeRate: number;
  snapshots: Snapshot[];
}
```

### 計算規則

```
資產TWD值 = quantity × pricePerUnit × (currency === 'USD' ? exchangeRate : 1)
投資總額   = sum(assets where category === 'investment' 的 TWD值)
流動資產   = sum(assets where category === 'liquid' 的 TWD值)
資產總計   = 投資總額 + 流動資產
債務總計   = sum(liabilities 的 TWD值)
淨資產     = 資產總計 - 債務總計
資產月增率 = (本月最新快照淨資產 - 上月同日快照淨資產) / |上月同日快照淨資產| × 100%
```

---

## 介面設計

### 頁面佈局（手機版，< 768px）

```
┌─────────────────────┐
│  Net Worth Tracker  │  ← 頂部導覽列
│  [儀表板] [資產] [設定]│
├─────────────────────┤
│  +4,827.82%  NT$3.78M│  ← 4格快速數字
│  NT$64,183  NT$1.83M │
├─────────────────────┤
│     資產配置          │
│   ┌─────────┐        │
│   │  圓餅圖  │  圖例  │
│   │ 淨資產   │ ● 投資 │
│   │ 2.02M   │ ● 流動 │
│   └─────────┘ ● 債務 │
├─────────────────────┤
│     資產趨勢          │
│  [1週][1月][6月][1年]│
│   ┌─────────────┐   │
│   │   折線圖     │   │
│   └─────────────┘   │
├─────────────────────┤
│  投資資產 NT$3,780,526│  ← 資產清單
│  ├ 正二  NT$3,766,252│
│  └ BTC   NT$14,274  │
│  流動資產 NT$64,183  │
│  └ USDT  NT$64,183  │
│  債務    NT$1,827,005│
│  ├ 信貸  NT$1,187,005│
│  └ 質押  NT$640,000  │
├─────────────────────┤
│         [+]          │  ← 新增按鈕（FAB）
└─────────────────────┘
```

### 新增/編輯 Modal

```
┌─────────────────────┐
│  新增資產             │
│  名稱: [________]   │
│  代號: [________]   │  ← 選填，用於自動抓價
│  分類: [投資▼][流動] │
│  類型: [台股▼]       │  ← 台股/加密貨幣/現金/其他
│  數量: [________]   │
│  幣別: [TWD▼][USD]  │
│  價格: [________]   │
│  最後更新: 2026-04-25│
│  [取消]    [儲存]    │
└─────────────────────┘
```

---

## API 整合設計

### 台股價格（TWSE）

```javascript
// 端點
const TWSE_API = 'https://mis.twse.com.tw/stock/api/getStockInfo.jsp';

// 請求範例（00631L）
GET https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=tse_00631L.tw&json=1&delay=0

// 回應欄位
{
  "msgArray": [{
    "z": "28.44",   // 最新成交價
    "n": "元大台灣50正2", // 名稱
    "c": "00631L"   // 代號
  }]
}

// 抓取邏輯
async function fetchTWStockPrice(symbol: string): Promise<number | null>
```

**注意**：TWSE API 僅在台股交易時間（週一至週五 09:00–13:30）回傳即時價格，盤後回傳收盤價。

### 加密貨幣價格（CoinGecko）

```javascript
// 端點
const COINGECKO_API = 'https://api.coingecko.com/api/v3/simple/price';

// 請求範例（BTC，換算 TWD）
GET https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=twd

// 回應
{ "bitcoin": { "twd": 2443703 } }

// 常用 ID 對照
const CRYPTO_ID_MAP = {
  'BTC': 'bitcoin',
  'ETH': 'ethereum',
  'USDT': 'tether',
  'BNB': 'binancecoin'
};

async function fetchCryptoPrice(symbol: string, currency: 'TWD' | 'USD'): Promise<number | null>
```

**限制**：CoinGecko 免費 API 每分鐘限制 10–30 次請求，App 啟動時抓取一次，之後每 5 分鐘自動更新。

### 價格抓取流程

```
App 啟動
  └→ 讀取 localStorage
  └→ 對每個 type === 'tw_stock' 的資產呼叫 fetchTWStockPrice()
  └→ 對每個 type === 'crypto' 的資產呼叫 fetchCryptoPrice()
  └→ 成功 → 更新 pricePerUnit、priceSource='auto'、lastPriceUpdate
  └→ 失敗 → 保留原有 pricePerUnit，顯示上次更新時間
  └→ 每 5 分鐘重複執行
```

---

## Service Worker 快取策略

```javascript
// sw.js 快取策略

// App Shell（Cache First）
const APP_SHELL = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/app.js',
  // ... 所有本地 JS 檔案
  'https://cdn.jsdelivr.net/npm/chart.js'  // Chart.js CDN
];

// API 請求（Network First，失敗時不快取）
// TWSE 和 CoinGecko API 不快取，失敗時使用 localStorage 的上次價格
```

---

## 正確性屬性（Property-Based Testing）

以下屬性使用 **fast-check** + **Vitest** 進行驗證。

### 屬性 1：資產儲存往返一致性
```
∀ asset ∈ ValidAsset:
  saveAsset(asset); loadAssets() 包含 asset
  且 loadAssets().find(a => a.id === asset.id) 深度相等於 asset
```

### 屬性 2：資產刪除後不存在
```
∀ asset ∈ ValidAsset:
  saveAsset(asset); deleteAsset(asset.id)
  → loadAssets().every(a => a.id !== asset.id)
```

### 屬性 3：非正數輸入被拒絕
```
∀ x ∈ (-∞, 0]:
  validateQuantity(x) === false
  validatePrice(x) === false
  validateAmount(x) === false
  validateExchangeRate(x) === false
```

### 屬性 4：USD 換算正確性
```
∀ asset ∈ USDAsset, rate ∈ PositiveNumber:
  calculateTWD(asset, rate) === asset.quantity × asset.pricePerUnit × rate
```

### 屬性 5：分類小計加總等於總計
```
∀ assets ∈ Asset[]:
  investmentTotal + liquidTotal === totalAssets
  且 creditTotal + pledgeTotal === totalLiabilities
```

### 屬性 6：淨資產計算正確性
```
∀ assets ∈ Asset[], liabilities ∈ Liability[], rate ∈ PositiveNumber:
  calculateNetWorth(assets, liabilities, rate) ===
    sum(assets.map(a => toTWD(a, rate))) - sum(liabilities.map(l => toTWD(l, rate)))
```

### 屬性 7：圓餅圖比例正確性
```
∀ data ∈ PieChartData:
  sum(data.values) > 0 →
    sum(data.percentages) ≈ 100 (誤差 < 0.01%)
```

### 屬性 8：JSON 匯出匯入往返一致性
```
∀ appData ∈ AppData:
  importData(exportData(appData)) 深度相等於 appData
```

### 屬性 9：無效 JSON 匯入不破壞現有資料
```
∀ invalidJSON ∈ InvalidJSON, existingData ∈ AppData:
  importData(invalidJSON) 拋出錯誤
  且 loadAllData() 深度相等於 existingData（資料未被修改）
```

### 屬性 10：快照時間範圍篩選正確性
```
∀ snapshots ∈ Snapshot[], range ∈ TimeRange:
  filterSnapshots(snapshots, range).every(s =>
    isWithinRange(s.date, range) === true
  )
```

### 屬性 11：修改後自動建立快照
```
∀ operation ∈ {saveAsset, deleteAsset, saveLiability, deleteLiability}:
  snapshotsBefore = loadSnapshots()
  operation(...)
  snapshotsAfter = loadSnapshots()
  → snapshotsAfter.length >= snapshotsBefore.length
  且 snapshotsAfter 包含今日日期的快照
```

### 屬性 12：價格抓取失敗時保留上次已知價格
```
∀ asset ∈ Asset with pricePerUnit = p:
  fetchPrice() 拋出錯誤
  → asset.pricePerUnit === p（價格未被修改）
```

### 屬性 13：手動價格覆蓋自動抓取價格
```
∀ asset ∈ Asset, manualPrice ∈ PositiveNumber:
  setManualPrice(asset.id, manualPrice)
  → loadAsset(asset.id).pricePerUnit === manualPrice
  且 loadAsset(asset.id).priceSource === 'manual'
```

---

## 錯誤處理策略

| 情境 | 處理方式 |
|------|----------|
| API 請求失敗（網路錯誤） | 保留上次價格，顯示「離線」標示 |
| API 回傳無效資料 | 保留上次價格，顯示最後更新時間 |
| localStorage 寫入失敗 | 顯示錯誤提示，不更新 UI |
| JSON 匯入格式錯誤 | 顯示錯誤訊息，保留現有資料 |
| 輸入驗證失敗 | 顯示欄位錯誤提示，阻止儲存 |
| 圓餅圖資料全為零 | 顯示「尚無資料」佔位符 |
