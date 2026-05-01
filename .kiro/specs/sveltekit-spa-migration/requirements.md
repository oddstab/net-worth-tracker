# 需求文件：SvelteKit SPA 遷移

## 簡介

將現有的 Net Worth Tracker（個人淨資產追蹤器）從原生 JavaScript 無框架架構，遷移至 SvelteKit 框架，以 SPA（Single Page Application）模式運行。遷移後的應用程式保留所有現有功能，不考慮 SEO，不需要 SSR（Server-Side Rendering）。應用程式支援多語言國際化（i18n），預設語言為繁體中文（zh-TW），另支援簡體中文（zh-CN）、日文（ja）、英文（en）、韓文（ko）。

## 詞彙表

- **SvelteKit_App**：使用 SvelteKit 框架重建後的 Net Worth Tracker 應用程式
- **SPA_Router**：SvelteKit 內建的客戶端路由器，負責頁面切換而不重新載入整頁
- **State_Store**：使用 Svelte 的 writable/derived store 實作的全域狀態管理模組
- **Storage_Service**：封裝 localStorage 讀寫的服務層，負責資料持久化
- **Price_Provider_Interface**：定義價格抓取的抽象介面（合約），所有價格提供者皆須實作此介面
- **Price_Provider_Registry**：負責註冊、管理與查詢已註冊 Price Provider 實例的服務模組
- **TWSE_Price_Provider**：實作 Price_Provider_Interface 的台股價格提供者，從 TWSE 即時 API 抓取價格
- **CoinGecko_Price_Provider**：實作 Price_Provider_Interface 的加密貨幣價格提供者，從 CoinGecko API 抓取價格
- **Price_Fetcher**：負責協調各 Price Provider 進行即時價格抓取的服務模組，透過 Price_Provider_Registry 取得對應的提供者
- **Search_Service**：提供台股與加密貨幣搜尋、詳細資訊查詢的服務模組
- **Snapshot_Manager**：負責每日淨資產快照的建立、篩選與自動快照功能的模組
- **Calculator**：負責淨資產計算、分類小計、月增率、貸款攤還等數學運算的純函式模組
- **Chart_Component**：使用 Chart.js 渲染圓餅圖與趨勢折線圖的 Svelte 元件
- **Modal_Component**：新增/編輯資產與負債的彈出視窗 Svelte 元件
- **Google_Sheets_Service**：與 Google Sheets API v4 整合的同步服務模組
- **Service_Worker**：負責離線快取策略的 PWA Service Worker
- **Asset**：資產項目，包含名稱、代號、類別、數量、幣別、單價等屬性
- **Liability**：負債項目，包含名稱、分類、金額、利率、期數等屬性
- **Snapshot**：每日淨資產快照，包含日期與淨資產金額
- **I18n_Service**：國際化服務模組，負責載入翻譯檔、切換語言、提供翻譯函式
- **Translation_File**：JSON 格式的翻譯檔案，每個支援語言各一份，包含所有使用者介面字串的鍵值對
- **Locale**：語言地區代碼，本系統支援 `zh-TW`（繁體中文）、`zh-CN`（簡體中文）、`ja`（日文）、`en`（英文）、`ko`（韓文）
- **Locale_Formatter**：根據當前 Locale 格式化數字（貨幣、百分比）與日期的工具模組

## 需求

### 需求 1：SvelteKit 專案初始化與 SPA 配置

**User Story:** 身為開發者，我希望專案使用 SvelteKit 框架建立並配置為純 SPA 模式，以便獲得現代化的開發體驗與元件化架構。

#### 驗收條件

1. THE SvelteKit_App SHALL 使用 SvelteKit 建立專案，並安裝 `@sveltejs/adapter-static` 作為建置適配器
2. THE SvelteKit_App SHALL 在 `svelte.config.js` 中配置 adapter-static 並設定 `fallback: 'index.html'` 以啟用 SPA 模式
3. THE SvelteKit_App SHALL 在根 layout 中設定 `export const ssr = false` 與 `export const prerender = false` 以停用 SSR 與預渲染
4. THE SvelteKit_App SHALL 使用 Vite 作為開發伺服器與建置工具
5. THE SvelteKit_App SHALL 在 `package.json` 中保留 Vitest 與 fast-check 作為測試依賴
6. THE SvelteKit_App SHALL 在 `app.html` 中設定 `lang="zh-TW"` 與相應的 meta 標籤

### 需求 2：客戶端路由與頁面結構

**User Story:** 身為使用者，我希望應用程式提供流暢的頁面切換體驗，以便在儀表板、資產清單與設定頁之間快速導覽。

#### 驗收條件

1. THE SPA_Router SHALL 提供三個主要路由：`/`（儀表板）、`/assets`（資產清單）、`/settings`（設定）
2. THE SvelteKit_App SHALL 提供固定於頂部的導覽列，包含「儀表板」、「資產」、「設定」三個頁籤按鈕
3. WHEN 使用者點擊導覽列頁籤時，THE SPA_Router SHALL 切換至對應頁面而不重新載入整頁
4. THE SvelteKit_App SHALL 在導覽列中以視覺高亮標示當前所在頁面的頁籤
5. THE SvelteKit_App SHALL 使用共用的 `+layout.svelte` 元件包含導覽列、FAB 按鈕、Modal 容器與 Toast 通知

### 需求 3：全域狀態管理

**User Story:** 身為開發者，我希望使用 Svelte store 管理全域狀態，以便所有元件能響應式地接收資料更新。

#### 驗收條件

1. THE State_Store SHALL 使用 Svelte 的 `writable` store 管理資產陣列、負債陣列、匯率與快照陣列
2. THE State_Store SHALL 提供 `addAsset`、`updateAsset`、`removeAsset`、`addLiability`、`updateLiability`、`removeLiability`、`setExchangeRate` 等操作函式
3. WHEN 任何狀態變更發生時，THE State_Store SHALL 自動將變更的資料持久化至 localStorage
4. WHEN 應用程式啟動時，THE State_Store SHALL 從 localStorage 載入所有已儲存的資料
5. THE State_Store SHALL 在資產或負債變更後自動觸發每日快照更新
6. THE State_Store SHALL 使用 Svelte 的 `derived` store 提供計算後的衍生資料（如淨資產總額、分類小計）

### 需求 4：localStorage 資料持久化

**User Story:** 身為使用者，我希望所有資料儲存在本地裝置上，以便在不依賴伺服器的情況下保留資料。

#### 驗收條件

1. THE Storage_Service SHALL 使用與現有相同的 localStorage key 前綴 `nwt_`（`nwt_assets`、`nwt_liabilities`、`nwt_exchange_rate`、`nwt_snapshots`）
2. THE Storage_Service SHALL 提供 JSON 序列化與反序列化的讀寫封裝
3. IF localStorage 寫入失敗，THEN THE Storage_Service SHALL 拋出包含描述性訊息的錯誤
4. THE Storage_Service SHALL 提供 `exportData` 函式將所有資料序列化為 JSON 字串供下載
5. WHEN 使用者匯入 JSON 檔案時，THE Storage_Service SHALL 驗證資料結構包含 `assets`、`liabilities`、`exchangeRate`、`snapshots` 四個必要欄位
6. IF 匯入的 JSON 格式不符預期結構，THEN THE Storage_Service SHALL 拋出包含具體缺失欄位名稱的錯誤訊息
7. FOR ALL 有效的 AppState 物件，匯出後再匯入 SHALL 產生等價的物件（round-trip 屬性）

### 需求 5：儀表板頁面

**User Story:** 身為使用者，我希望在儀表板上一目了然地看到淨資產概況，以便快速掌握財務狀況。

#### 驗收條件

1. THE SvelteKit_App SHALL 在儀表板頂部顯示四格快速數字卡片：資產月增率、投資總額、淨資產、債務
2. WHEN 資產月增率為正值時，THE SvelteKit_App SHALL 以綠色顯示數值並加上 `+` 前綴
3. WHEN 資產月增率為負值時，THE SvelteKit_App SHALL 以紅色顯示數值
4. THE Chart_Component SHALL 使用 Chart.js 渲染 Doughnut 圓餅圖，顯示投資資產與債務的比例
5. THE Chart_Component SHALL 在圓餅圖中央顯示淨資產金額與今日漲跌幅百分比
6. THE Chart_Component SHALL 在圓餅圖旁顯示詳細圖例，包含投資資產與負債的明細項目、金額與百分比
7. THE Chart_Component SHALL 使用 Chart.js 渲染淨資產趨勢折線圖
8. THE SvelteKit_App SHALL 提供時間範圍篩選器（1週、1月、6月、1年、全部），篩選趨勢圖顯示的快照資料
9. WHEN 無快照資料時，THE SvelteKit_App SHALL 顯示「尚無資料」的提示訊息

### 需求 6：資產管理

**User Story:** 身為使用者，我希望能新增、編輯與刪除各類資產，以便完整記錄我的投資組合。

#### 驗收條件

1. THE SvelteKit_App SHALL 支援四種資產類型：台股（tw_stock）、加密貨幣（crypto）、現金（cash）、其他（other）
2. THE SvelteKit_App SHALL 支援兩種資產分類：投資資產（investment）與流動資產（liquid）
3. THE Modal_Component SHALL 提供新增資產表單，包含類型、分類、代號/搜尋、名稱、數量、幣別（TWD/USD）、每單位價格欄位
4. WHEN 使用者在代號欄位輸入文字時，THE Search_Service SHALL 在 200ms 防抖後顯示搜尋下拉選單
5. WHEN 使用者從搜尋下拉選單選擇項目時，THE Modal_Component SHALL 自動帶入代號、名稱，並在右側摘要面板顯示詳細資訊
6. THE Modal_Component SHALL 在摘要面板中顯示即時價格、漲跌幅、今日高低、成交量、ETF 或公司基本資料
7. WHEN 摘要面板載入即時價格後，THE Modal_Component SHALL 自動套用該價格至價格欄位
8. THE SvelteKit_App SHALL 將相同股票代號的多筆持股整合顯示，並提供展開/收合明細的功能
9. WHEN 使用者確認刪除資產時，THE SvelteKit_App SHALL 顯示自訂確認對話框而非瀏覽器原生 confirm
10. THE SvelteKit_App SHALL 在資產清單中按分類（投資資產）分組顯示，每組顯示小計金額

### 需求 7：負債管理

**User Story:** 身為使用者，我希望能管理各類負債並查看還款明細，以便掌握債務狀況。

#### 驗收條件

1. THE SvelteKit_App SHALL 支援五種負債分類：信貸（credit）、房貸（home_loan）、質押借款（pledge）、理財型房貸（mortgage）、其他（other）
2. THE Modal_Component SHALL 根據負債分類動態顯示對應的表單欄位
3. WHEN 負債分類為信貸或房貸時，THE Modal_Component SHALL 顯示金額、年利率、期數、起始日期、結束日期欄位
4. WHEN 負債分類為質押借款或理財型房貸時，THE Modal_Component SHALL 顯示核准額度、動用金額滑桿、年利率、動用日期欄位
5. THE Calculator SHALL 提供等額本息攤還（calculateLoanSchedule）與本金平均攤還（calculateEqualPrincipalSchedule）兩種計算方式
6. THE SvelteKit_App SHALL 在負債項目中提供展開/收合的還款明細表，包含每期還本、利息、月付、餘額、累計利息
7. THE SvelteKit_App SHALL 提供攤還方式切換按鈕，讓使用者在等額本息與本金平均攤還之間切換
8. WHEN 負債為循環型（質押/理財型房貸）時，THE SvelteKit_App SHALL 顯示計息天數計算器，可即時計算應繳利息

### 需求 8：即時價格抓取（Provider 抽象介面架構）

**User Story:** 身為開發者，我希望價格抓取功能透過抽象介面定義合約，並以可抽換的 Provider 實作具體 API 呼叫，以便未來能新增或替換價格來源而不修改現有程式碼。

#### 驗收條件

##### 8.1 Price Provider 介面定義

1. THE Price_Provider_Interface SHALL 定義以下合約方法：`fetchPrices(symbols)`（批次抓取價格）、`getProviderType()`（回傳提供者對應的資產類型）、`getName()`（回傳提供者名稱）
2. THE Price_Provider_Interface SHALL 規定 `fetchPrices` 方法接收 symbol 陣列，回傳 `Map<symbol, PriceResult>` 格式的結果，其中 PriceResult 包含 `price`、`currency`、`timestamp` 欄位
3. THE Price_Provider_Interface SHALL 規定每個實作者須提供 `isAvailable()` 方法，回傳布林值表示該提供者目前是否可用

##### 8.2 Provider 註冊與管理

4. THE Price_Provider_Registry SHALL 提供 `register(provider)` 方法，將實作 Price_Provider_Interface 的提供者註冊至系統
5. THE Price_Provider_Registry SHALL 提供 `getProviderByType(assetType)` 方法，依資產類型查詢對應的已註冊提供者
6. THE Price_Provider_Registry SHALL 提供 `getAllProviders()` 方法，回傳所有已註冊的提供者清單
7. IF 註冊的提供者未實作 Price_Provider_Interface 的所有必要方法，THEN THE Price_Provider_Registry SHALL 拋出包含缺失方法名稱的錯誤訊息

##### 8.3 TWSE 價格提供者（具體實作）

8. THE TWSE_Price_Provider SHALL 實作 Price_Provider_Interface，從 TWSE 即時 API（`mis.twse.com.tw`）抓取台股價格，依序嘗試上市（tse）與上櫃（otc）市場
9. THE TWSE_Price_Provider SHALL 在 `getProviderType()` 中回傳 `tw_stock`

##### 8.4 CoinGecko 價格提供者（具體實作）

10. THE CoinGecko_Price_Provider SHALL 實作 Price_Provider_Interface，從 CoinGecko API（`api.coingecko.com`）抓取加密貨幣的 TWD 與 USD 價格
11. THE CoinGecko_Price_Provider SHALL 在 `getProviderType()` 中回傳 `crypto`

##### 8.5 Price Fetcher 協調層

12. THE Price_Fetcher SHALL 透過 Price_Provider_Registry 取得對應的 Provider，而非直接耦合具體 API 實作
13. THE Price_Fetcher SHALL 對相同 symbol + type 的資產去重，避免重複 API 呼叫
14. IF API 呼叫失敗，THEN THE Price_Fetcher SHALL 使用指數退避機制，前 3 次失敗不退避，之後以 2 的冪次遞增延遲，最大退避 5 分鐘
15. THE SvelteKit_App SHALL 每 1 分鐘自動更新價格，每 10 分鐘強制更新一次
16. WHEN 價格更新成功時，THE SvelteKit_App SHALL 顯示 Toast 通知告知更新了幾個資產的價格

##### 8.6 搜尋快取與 CORS 處理

17. THE Search_Service SHALL 使用 TWSE openapi（`openapi.twse.com.tw`）的 STOCK_DAY_ALL 端點作為全市場股價快取，快取有效期 1 分鐘
18. IF 直連 API 被 CORS 阻擋，THEN THE Search_Service SHALL 自動透過 `corsproxy.io` 代理重試

##### 8.7 擴充性保證

19. WHEN 開發者新增一個新的 Price Provider 實作時，THE Price_Provider_Registry SHALL 允許透過 `register()` 方法加入，而無需修改 Price_Fetcher 或其他現有模組的程式碼（開放封閉原則）
20. FOR ALL 實作 Price_Provider_Interface 的 Provider，THE Price_Fetcher SHALL 以相同的流程呼叫 `fetchPrices` 方法取得價格（多型行為）

### 需求 9：每日快照與趨勢分析

**User Story:** 身為使用者，我希望應用程式自動記錄每日淨資產，以便追蹤長期財務趨勢。

#### 驗收條件

1. THE Snapshot_Manager SHALL 在資產或負債變更後自動建立或更新當日快照
2. WHEN 當日已有快照時，THE Snapshot_Manager SHALL 覆蓋該快照的淨資產值而非新增
3. THE Snapshot_Manager SHALL 限制快照數量為最近 365 天
4. THE Calculator SHALL 計算真實月增率（與 30 天前快照比較，±3 天容差）
5. WHEN 無足夠歷史資料計算真實月增率時，THE Calculator SHALL 基於可用天數按比例推算估算月增率
6. THE Calculator SHALL 計算今日漲跌幅（與前一日快照比較，±3 天容差）
7. THE Snapshot_Manager SHALL 提供依時間範圍篩選快照的功能（1週、1月、6月、1年、全部）

### 需求 10：匯率管理與幣別轉換

**User Story:** 身為使用者，我希望能設定 USD/TWD 匯率，以便正確計算持有美元計價資產的台幣價值。

#### 驗收條件

1. THE SvelteKit_App SHALL 在設定頁提供 USD/TWD 匯率輸入欄位，預設值為 31.5
2. WHEN 使用者輸入新匯率並儲存時，THE State_Store SHALL 更新匯率並重新計算所有以 USD 計價的資產價值
3. IF 使用者輸入的匯率不是正數，THEN THE SvelteKit_App SHALL 顯示「匯率必須為正數」的錯誤訊息
4. THE Calculator SHALL 將 USD 計價的資產與負債乘以匯率轉換為 TWD

### 需求 11：資料匯出與匯入

**User Story:** 身為使用者，我希望能匯出與匯入資料，以便備份或在不同裝置間轉移資料。

#### 驗收條件

1. WHEN 使用者點擊匯出按鈕時，THE SvelteKit_App SHALL 將所有資料序列化為 JSON 並觸發檔案下載，檔名格式為 `net-worth-tracker-YYYY-MM-DD.json`
2. WHEN 使用者選擇 JSON 檔案匯入時，THE Storage_Service SHALL 驗證並載入資料，覆蓋現有資料
3. WHEN 匯入成功時，THE SvelteKit_App SHALL 顯示「資料已匯入」的 Toast 通知並重新渲染所有頁面
4. IF 匯入的 JSON 格式無效，THEN THE SvelteKit_App SHALL 顯示具體的錯誤訊息（如「缺少必要欄位 assets」）

### 需求 12：Google Sheets 整合

**User Story:** 身為使用者，我希望能將資產資料同步至 Google Sheets，以便在雲端備份與分析。

#### 驗收條件

1. THE Google_Sheets_Service SHALL 提供 Google API 金鑰與 OAuth 客戶端 ID 的設定介面
2. THE Google_Sheets_Service SHALL 支援 Google 帳戶登入與登出
3. WHEN 使用者已登入時，THE Google_Sheets_Service SHALL 提供「同步到 Google Sheets」、「從 Google Sheets 載入」、「創建新表格」三個操作
4. THE Google_Sheets_Service SHALL 在 Google Sheets 中建立「資產清單」與「歷史記錄」兩個工作表
5. THE SvelteKit_App SHALL 在設定頁顯示 Google 整合區塊，包含登入狀態、使用者資訊與操作按鈕

### 需求 13：PWA 與離線支援

**User Story:** 身為使用者，我希望應用程式可安裝為 PWA 並支援離線使用，以便在無網路環境下仍能查看資料。

#### 驗收條件

1. THE SvelteKit_App SHALL 提供 `manifest.json`，設定 `display: standalone`、`lang: zh-TW`、深色主題色
2. THE Service_Worker SHALL 對應用程式 shell 資源使用 Cache First 策略
3. THE Service_Worker SHALL 對外部 API 請求（TWSE、CoinGecko）使用 Network First 策略
4. WHEN 有新版本可用時，THE SvelteKit_App SHALL 顯示更新提示，讓使用者決定是否立即更新
5. THE Service_Worker SHALL 在啟用時清除舊版本的快取

### 需求 14：UI 設計與響應式佈局

**User Story:** 身為使用者，我希望應用程式在手機與桌面上都有良好的使用體驗。

#### 驗收條件

1. THE SvelteKit_App SHALL 使用深色主題，以 CSS 自訂屬性定義設計 token（背景色、文字色、強調色等）
2. THE SvelteKit_App SHALL 在手機上（< 768px）使用單欄佈局，快速數字卡片為 2×2 網格
3. THE SvelteKit_App SHALL 在平板上（≥ 768px）將快速數字卡片擴展為 4 欄，圓餅圖改為左右並排佈局
4. THE SvelteKit_App SHALL 在桌面上（≥ 1024px）將儀表板改為雙欄網格佈局
5. THE SvelteKit_App SHALL 確保所有互動元素的最小觸控目標為 44px
6. THE SvelteKit_App SHALL 提供 FAB（浮動操作按鈕）用於快速新增資產或負債
7. THE SvelteKit_App SHALL 使用底部滑入動畫顯示 Modal（手機），居中顯示（桌面）
8. THE SvelteKit_App SHALL 支援 `prefers-reduced-motion` 媒體查詢，在使用者偏好減少動畫時停用動畫效果

### 需求 15：淨資產計算引擎

**User Story:** 身為開發者，我希望計算邏輯以純函式實作並與 UI 分離，以便進行單元測試與屬性測試。

#### 驗收條件

1. THE Calculator SHALL 以純函式實作，不依賴任何 Svelte 或 DOM API
2. THE Calculator SHALL 計算資產 TWD 值：`quantity × pricePerUnit × (currency === 'USD' ? exchangeRate : 1)`
3. THE Calculator SHALL 計算分類小計：投資總額、流動資產、各類負債小計
4. THE Calculator SHALL 計算淨資產：`資產總計 - 債務總計`
5. THE Calculator SHALL 提供輸入驗證函式：`validateQuantity`、`validatePrice`、`validateAmount`、`validateExchangeRate`，驗證輸入為有限正數
6. THE Calculator SHALL 計算圓餅圖資料：標籤、金額與百分比
7. FOR ALL 有效的資產與負債組合，THE Calculator SHALL 確保淨資產等於資產總計減去債務總計（不變量屬性）
8. FOR ALL 正數的數量與價格，THE Calculator SHALL 確保計算出的 TWD 值為正數（不變量屬性）

### 需求 16：貸款攤還計算

**User Story:** 身為使用者，我希望能查看貸款的詳細還款計畫，以便了解每期應還金額與總利息。

#### 驗收條件

1. THE Calculator SHALL 提供等額本息攤還計算，公式為 `P × r × (1+r)^n / ((1+r)^n - 1)`，其中 P 為本金、r 為月利率、n 為期數
2. THE Calculator SHALL 提供本金平均攤還計算，每期固定還本金額為 `P / n`
3. THE Calculator SHALL 在最後一期調整還款金額以確保餘額歸零
4. FOR ALL 有效的貸款參數（正數本金、非負利率、正整數期數），THE Calculator SHALL 確保所有期數的還本加總等於原始本金（不變量屬性）
5. FOR ALL 有效的貸款參數，THE Calculator SHALL 確保最後一期的餘額為零（不變量屬性）

### 需求 17：搜尋下拉與摘要面板

**User Story:** 身為使用者，我希望在新增資產時能搜尋股票或加密貨幣並查看詳細資訊，以便做出正確的輸入。

#### 驗收條件

1. THE Search_Service SHALL 支援台股搜尋：精確代號匹配、代號前綴匹配、名稱包含匹配，最多回傳 10 筆結果
2. THE Search_Service SHALL 支援加密貨幣搜尋：從預定義的 20 種主流幣種中搜尋
3. THE Modal_Component SHALL 支援鍵盤導覽搜尋下拉選單（↑↓ 選擇、Enter 確認、Escape 關閉）
4. WHEN 選擇台股時，THE Modal_Component SHALL 在摘要面板顯示即時價格、漲跌幅、近一月漲幅、今日高低、成交量、ETF 資訊或公司基本資料
5. WHEN 選擇加密貨幣時，THE Modal_Component SHALL 在摘要面板顯示 TWD 與 USD 價格、24 小時漲跌幅、市值、幣種簡介

### 需求 18：Toast 通知系統

**User Story:** 身為使用者，我希望在操作完成後收到簡短的回饋通知。

#### 驗收條件

1. THE SvelteKit_App SHALL 提供全域 Toast 通知元件，支援 success 與 error 兩種樣式
2. WHEN Toast 顯示後，THE SvelteKit_App SHALL 在 2.5 秒後自動隱藏
3. THE SvelteKit_App SHALL 在以下操作後顯示 Toast：匯率更新、資料匯出、資料匯入、價格更新、快取清除

### 需求 19：測試策略

**User Story:** 身為開發者，我希望核心計算邏輯有完整的測試覆蓋，以便確保遷移後的正確性。

#### 驗收條件

1. THE SvelteKit_App SHALL 使用 Vitest 作為測試框架，配置 jsdom 環境
2. THE SvelteKit_App SHALL 使用 fast-check 對 Calculator 模組進行屬性測試
3. THE Calculator SHALL 通過以下屬性測試：淨資產不變量（資產總計 - 債務總計）、TWD 轉換正數不變量、貸款還本加總等於本金、貸款最終餘額為零
4. THE Storage_Service SHALL 通過 round-trip 屬性測試：exportData 後 importData 產生等價物件
5. THE Snapshot_Manager SHALL 通過冪等性測試：對同一天重複建立快照不增加快照數量

### 需求 20：現有資料相容性

**User Story:** 身為使用者，我希望遷移後的應用程式能直接讀取現有的 localStorage 資料，以便無縫切換而不遺失任何資料。

#### 驗收條件

1. THE SvelteKit_App SHALL 使用與現有應用程式相同的 localStorage key（`nwt_assets`、`nwt_liabilities`、`nwt_exchange_rate`、`nwt_snapshots`）
2. THE SvelteKit_App SHALL 能正確解析現有應用程式儲存的 Asset 資料結構（包含 id、name、symbol、category、type、quantity、currency、pricePerUnit、priceSource、lastPriceUpdate）
3. THE SvelteKit_App SHALL 能正確解析現有應用程式儲存的 Liability 資料結構（包含 id、name、category、amount、currency、interestRate、terms、startDate、endDate、creditLine、drawdownDate）
4. THE SvelteKit_App SHALL 能正確解析現有應用程式儲存的 Snapshot 資料結構（包含 date、netWorth）
5. WHEN 應用程式首次啟動且 localStorage 中已有資料時，THE SvelteKit_App SHALL 正確載入並顯示所有現有資料

### 需求 21：診斷與維護工具

**User Story:** 身為使用者，我希望能診斷股價更新問題並手動觸發更新，以便排除價格抓取異常。

#### 驗收條件

1. THE SvelteKit_App SHALL 在設定頁提供「清除快取」按鈕，清除股價快取並強制重新載入
2. THE SvelteKit_App SHALL 在設定頁提供「手動更新股價」按鈕，立即執行一次價格更新
3. WHEN 手動更新進行中時，THE SvelteKit_App SHALL 將按鈕設為停用狀態並顯示「更新中...」文字

### 需求 22：國際化（i18n）多語言支援

**User Story:** 身為使用者，我希望能切換應用程式的顯示語言，以便使用我熟悉的語言操作。

#### 驗收條件

##### 22.1 支援語言與預設語言

1. THE I18n_Service SHALL 支援以下五種語言：繁體中文（zh-TW）、簡體中文（zh-CN）、日文（ja）、英文（en）、韓文（ko）
2. THE I18n_Service SHALL 以繁體中文（zh-TW）作為預設語言，以維持與現有版本的向後相容性
3. WHEN 應用程式首次啟動且 localStorage 中無語言設定時，THE I18n_Service SHALL 使用 zh-TW 作為當前語言

##### 22.2 翻譯檔案與字串外部化

4. THE I18n_Service SHALL 為每種支援語言提供獨立的 Translation_File（JSON 格式），包含所有使用者介面字串的鍵值對
5. THE Translation_File SHALL 涵蓋所有使用者可見的字串，包含頁面標題、導覽列標籤、按鈕文字、表單標籤、錯誤訊息、Toast 通知訊息、確認對話框文字與提示文字
6. THE I18n_Service SHALL 提供 `t(key)` 翻譯函式，接收翻譯鍵並回傳當前語言對應的翻譯字串
7. THE I18n_Service SHALL 支援帶參數的翻譯字串（插值），格式為 `t(key, { param: value })`，用於動態內容（如「已更新 {count} 個資產的價格」）
8. IF 翻譯鍵在當前語言的 Translation_File 中不存在，THEN THE I18n_Service SHALL 回退至 zh-TW 的對應翻譯字串
9. IF 翻譯鍵在 zh-TW 的 Translation_File 中也不存在，THEN THE I18n_Service SHALL 回傳該翻譯鍵本身作為顯示文字

##### 22.2a 繁體中文與簡體中文在地化規範

10. THE zh-CN Translation_File SHALL 為獨立撰寫的在地化翻譯，而非從 zh-TW 進行簡繁字元轉換
11. THE zh-CN Translation_File SHALL 使用大陸慣用詞彙而非直接將繁體用詞轉為簡體字，例如：繁體「新增」對應簡體「添加」、繁體「訊息」對應簡體「信息」、繁體「設定」對應簡體「设置」、繁體「匯率」對應簡體「汇率」、繁體「儀表板」對應簡體「仪表盘」
12. THE zh-TW Translation_File 與 zh-CN Translation_File SHALL 各自維護獨立的翻譯檔案，禁止使用自動簡繁轉換工具產生其中任一版本
13. FOR ALL 翻譯鍵，zh-TW 與 zh-CN 的翻譯值 SHALL 反映各自地區的慣用語法與用詞習慣（在地化不變量）

##### 22.3 語言切換與持久化

10. THE SvelteKit_App SHALL 在設定頁提供語言選擇器，列出所有支援語言的原生名稱：繁體中文、简体中文、日本語、English、한국어
11. WHEN 使用者選擇新語言時，THE I18n_Service SHALL 立即切換當前語言並重新渲染所有使用者介面字串，無需重新載入頁面
12. WHEN 使用者選擇新語言時，THE I18n_Service SHALL 將語言代碼儲存至 localStorage（key 為 `nwt_locale`）
13. WHEN 應用程式啟動時，THE I18n_Service SHALL 從 localStorage 讀取已儲存的語言代碼並套用
14. WHEN 語言切換時，THE SvelteKit_App SHALL 更新 `<html>` 元素的 `lang` 屬性為對應的語言代碼

##### 22.4 數字與日期格式本地化

15. THE Locale_Formatter SHALL 使用 `Intl.NumberFormat` 根據當前 Locale 格式化貨幣金額（千分位分隔符、小數位數）
16. THE Locale_Formatter SHALL 使用 `Intl.NumberFormat` 根據當前 Locale 格式化百分比數值
17. THE Locale_Formatter SHALL 使用 `Intl.DateTimeFormat` 根據當前 Locale 格式化日期顯示
18. WHEN 語言切換時，THE Locale_Formatter SHALL 立即以新的 Locale 重新格式化所有已顯示的數字與日期

##### 22.5 翻譯完整性與品質保證

19. FOR ALL 支援的 Locale，THE Translation_File SHALL 包含與 zh-TW 翻譯檔相同的所有翻譯鍵（完整性不變量）
20. FOR ALL 包含插值參數的翻譯鍵，每種語言的 Translation_File SHALL 保留相同的參數佔位符（如 `{count}`、`{name}`）
21. FOR ALL 有效的翻譯鍵，切換語言後再切回原語言 SHALL 顯示與切換前相同的翻譯字串（round-trip 屬性）
