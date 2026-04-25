# 實作計畫：Net Worth Tracker

## 概述

以純前端 PWA 架構實作個人資產追蹤器，採用模組化 JavaScript（ES Modules）。
實作順序：基礎架構 → 核心模組 → 價格抓取 → 快照管理 → UI 元件 → 主程式整合。
所有模組以 Vitest + fast-check 進行屬性測試與單元測試。

---

## 任務

- [x] 1. 建立專案基礎架構
  - 建立 `index.html`：SPA 入口，引入 CSS、Chart.js CDN、所有 JS 模組
  - 建立 `css/style.css`：深色主題全域樣式，響應式斷點（768px），觸控目標 ≥ 44×44px
  - 建立 `manifest.json`：PWA Manifest，包含應用名稱、圖示（192/512）、主題色、`display: standalone`
  - 建立 `sw.js`：Service Worker，App Shell Cache First 策略，API 請求 Network First
  - 建立 `icons/icon-192.png` 與 `icons/icon-512.png` 佔位圖示
  - 建立 `vitest.config.js` 與 `package.json`，安裝 `vitest`、`fast-check`、`@vitest/coverage-v8`
  - _需求：6.1, 6.2, 6.3, 6.4, 7.1, 7.2, 7.3, 7.4_

- [ ] 2. 實作 `js/storage.js`（本地儲存封裝）
  - [x] 2.1 實作 `storage.js` 核心讀寫函式
    - 實作 `saveAssets(assets)`、`loadAssets()`
    - 實作 `saveLiabilities(liabilities)`、`loadLiabilities()`
    - 實作 `saveExchangeRate(rate)`、`loadExchangeRate()`（預設值 31.5）
    - 實作 `saveSnapshots(snapshots)`、`loadSnapshots()`
    - 實作 `loadAllData()` 與 `saveAllData(appData)`
    - 所有函式需處理 localStorage 寫入失敗（try/catch）
    - _需求：1.3, 2.3, 3.3, 5.1, 5.2, 5.3, 9.6_

  - [ ]* 2.2 撰寫屬性測試：資產儲存往返一致性
    - **屬性 1：資產儲存往返一致性**
    - 使用 fast-check 生成任意合法 `Asset` 物件，驗證 `saveAssets` → `loadAssets` 深度相等
    - **驗證：需求 1.3, 5.1, 5.2**

  - [ ]* 2.3 撰寫屬性測試：資產刪除後不存在
    - **屬性 2：資產刪除後不存在**
    - 驗證 `saveAssets([...assets, target])` → 移除 target → `loadAssets()` 不含該 id
    - **驗證：需求 1.5**

  - [ ]* 2.4 撰寫屬性測試：JSON 匯出匯入往返一致性
    - **屬性 8：JSON 匯出匯入往返一致性**
    - 驗證 `importData(exportData(appData))` 深度相等於原始 `appData`
    - **驗證：需求 5.4, 5.5**

  - [ ]* 2.5 撰寫屬性測試：無效 JSON 匯入不破壞現有資料
    - **屬性 9：無效 JSON 匯入不破壞現有資料**
    - 使用 fast-check 生成任意非法 JSON 字串，驗證 `importData` 拋出錯誤且現有資料不變
    - **驗證：需求 5.6**

- [ ] 3. 實作 `js/calculator.js`（計算邏輯）
  - [x] 3.1 實作計算核心函式
    - 實作 `toTWD(item, exchangeRate)`：依幣別換算 TWD 值
    - 實作 `calculateAssetTWD(asset, rate)`：`quantity × pricePerUnit × rate（若 USD）`
    - 實作 `calculateTotals(assets, liabilities, rate)`：回傳 `{ investmentTotal, liquidTotal, totalAssets, creditTotal, pledgeTotal, totalLiabilities, netWorth }`
    - 實作 `calculateMonthlyGrowthRate(snapshots)`：本月 vs 上月同日快照
    - 實作 `calculatePieChartData(totals)`：回傳各類別金額與百分比
    - 實作 `validateQuantity(x)`、`validatePrice(x)`、`validateAmount(x)`、`validateExchangeRate(x)`
    - _需求：3.2, 4.1, 4.2, 4.3, 4.4, 8.1, 8.3, 8.5_

  - [ ]* 3.2 撰寫屬性測試：非正數輸入被拒絕
    - **屬性 3：非正數輸入被拒絕**
    - 使用 fast-check 生成 ≤ 0 的任意數值，驗證所有 validate 函式回傳 `false`
    - **驗證：需求 1.6, 2.6, 3.5**

  - [ ]* 3.3 撰寫屬性測試：USD 換算正確性
    - **屬性 4：USD 換算正確性**
    - 驗證 `calculateAssetTWD(usdAsset, rate) === quantity × pricePerUnit × rate`
    - **驗證：需求 3.2**

  - [ ]* 3.4 撰寫屬性測試：分類小計加總等於總計
    - **屬性 5：分類小計加總等於總計**
    - 驗證 `investmentTotal + liquidTotal === totalAssets` 且 `creditTotal + pledgeTotal === totalLiabilities`
    - **驗證：需求 4.2, 4.3**

  - [ ]* 3.5 撰寫屬性測試：淨資產計算正確性
    - **屬性 6：淨資產計算正確性**
    - 驗證 `calculateNetWorth` 等於 `sum(assets TWD) - sum(liabilities TWD)`
    - **驗證：需求 4.1**

  - [ ]* 3.6 撰寫屬性測試：圓餅圖比例正確性
    - **屬性 7：圓餅圖比例正確性**
    - 驗證 `sum(percentages) ≈ 100`（誤差 < 0.01%）
    - **驗證：需求 8.3, 8.5**

- [x] 4. 實作 `js/state.js`（全域狀態管理）
  - 定義 `AppState` 物件：`{ assets, liabilities, exchangeRate, snapshots }`
  - 實作 `initState()`：從 `storage.js` 載入所有資料，空資料時以空陣列與預設匯率初始化
  - 實作 `getState()`、`setState(partial)` 與訂閱機制（observer pattern）
  - 實作 `addAsset(asset)`、`updateAsset(id, changes)`、`removeAsset(id)`
  - 實作 `addLiability(liability)`、`updateLiability(id, changes)`、`removeLiability(id)`
  - 實作 `setExchangeRate(rate)`
  - 每次狀態變更後自動呼叫 `storage.js` 持久化，並通知所有訂閱者重新渲染
  - _需求：1.3, 1.4, 1.5, 2.3, 2.4, 2.5, 3.3, 4.4, 5.1, 5.2_

- [ ] 5. 實作 `js/priceFetcher.js`（價格抓取）
  - [x] 5.1 實作台股與加密貨幣價格抓取
    - 實作 `fetchTWStockPrice(symbol)`：呼叫 TWSE API，解析 `msgArray[0].z`
    - 實作 `fetchCryptoPrice(symbol, currency)`：呼叫 CoinGecko API，使用 `CRYPTO_ID_MAP` 對照
    - 實作 `fetchAllPrices(assets)`：批次抓取所有 `tw_stock` 與 `crypto` 資產價格
    - 成功時更新 `pricePerUnit`、`priceSource='auto'`、`lastPriceUpdate`（ISO 8601）
    - 失敗時保留原有 `pricePerUnit`，不修改資產資料
    - 實作 `startPriceAutoRefresh(intervalMs = 300000)`：每 5 分鐘自動執行一次
    - _需求：10.1, 10.2, 10.3, 10.4, 10.5_

  - [ ] 5.2 撰寫屬性測試：價格抓取失敗時保留上次已知價格
    - **屬性 12：價格抓取失敗時保留上次已知價格**
    - Mock fetch 拋出錯誤，驗證 `asset.pricePerUnit` 在呼叫後不變
    - **驗證：需求 10.4**

  - [ ]* 5.3 撰寫屬性測試：手動價格覆蓋自動抓取價格
    - **屬性 13：手動價格覆蓋自動抓取價格**
    - 驗證 `setManualPrice(id, price)` 後 `pricePerUnit === price` 且 `priceSource === 'manual'`
    - **驗證：需求 10.6**

- [ ] 6. 實作 `js/snapshotManager.js`（快照管理）
  - [x] 6.1 實作快照核心邏輯
    - 實作 `takeSnapshot(netWorth)`：建立今日日期（YYYY-MM-DD）快照，若同日已有快照則覆蓋
    - 實作 `filterSnapshotsByRange(snapshots, range)`：支援 `'1w' | '1m' | '6m' | '1y' | 'all'`
    - 實作 `autoSnapshot(assets, liabilities, rate)`：計算淨資產後呼叫 `takeSnapshot`
    - 在 `state.js` 的 `addAsset`、`updateAsset`、`removeAsset`、`addLiability`、`updateLiability`、`removeLiability` 後自動呼叫 `autoSnapshot`
    - _需求：9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

  - [ ]* 6.2 撰寫屬性測試：快照時間範圍篩選正確性
    - **屬性 10：快照時間範圍篩選正確性**
    - 驗證 `filterSnapshotsByRange` 回傳的每筆快照日期均在指定範圍內
    - **驗證：需求 9.3, 9.4**

  - [ ]* 6.3 撰寫屬性測試：修改後自動建立快照
    - **屬性 11：修改後自動建立快照**
    - 驗證任意 `saveAsset / deleteAsset / saveLiability / deleteLiability` 操作後，快照數量 ≥ 操作前，且包含今日日期快照
    - **驗證：需求 9.1**

- [x] 7. 檢查點 — 確認核心模組測試全數通過
  - 執行 `vitest --run` 確認所有屬性測試與單元測試通過，如有問題請向使用者確認。

- [x] 8. 實作 `js/ui/modal.js`（新增/編輯 Modal）
  - 實作 `openAssetModal(asset = null)`：開啟新增或編輯資產 Modal
  - 實作 `openLiabilityModal(liability = null)`：開啟新增或編輯負債 Modal
  - Modal 表單欄位：名稱、代號（選填）、分類、類型、數量、幣別、每單位價格
  - 負債 Modal 欄位：名稱、分類、金額、幣別
  - 實作表單驗證：呼叫 `calculator.js` 的 validate 函式，顯示欄位錯誤提示
  - 儲存時呼叫 `state.js` 的 `addAsset` / `updateAsset` / `addLiability` / `updateLiability`
  - 實作 `closeModal()`，點擊背景或取消按鈕關閉
  - _需求：1.1, 1.2, 1.6, 2.1, 2.2, 2.6_

- [x] 9. 實作 `js/ui/assetList.js`（資產清單）
  - 實作 `renderAssetList(state)`：依分類（投資資產、流動資產）渲染資產清單
  - 實作 `renderLiabilityList(state)`：依分類（信貸、質押借款）渲染負債清單
  - 每個項目顯示：名稱、持有數量/金額、TWD 換算值、最後價格更新時間
  - 每個項目提供編輯（呼叫 `openAssetModal`）與刪除（呼叫 `state.removeAsset`）按鈕
  - 渲染各分類小計（TWD）
  - 訂閱 `state.js` 狀態變更，自動重新渲染
  - _需求：1.4, 1.5, 2.4, 2.5, 4.2, 4.3, 4.4, 4.5, 10.5_

- [x] 10. 實作 `js/ui/dashboard.js`（儀表板）
  - 實作 `renderQuickStats(state)`：渲染 4 格快速數字（資產月增率、投資總額、流動資產、債務）
  - 實作 `renderPieChart(state)`：使用 Chart.js 繪製圓餅圖（投資資產、流動資產、債務比例）
  - 圓餅圖中央顯示淨資產（TWD）金額
  - 圓餅圖下方顯示圖例（類別名稱、TWD 金額、佔比百分比）
  - 當所有值為零時顯示「尚無資料」佔位符
  - 訂閱 `state.js` 狀態變更，自動更新所有數值與圖表
  - _需求：4.1, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

- [x] 11. 實作 `js/ui/trendChart.js`（趨勢折線圖）
  - 實作 `renderTrendChart(snapshots, range)`：使用 Chart.js 繪製淨資產折線圖
  - 實作時間範圍篩選器 UI：1週、1月、6月、1年、全部
  - 切換時間範圍時呼叫 `filterSnapshotsByRange` 並重新渲染圖表
  - 無資料時顯示「該時間範圍內無資料」提示訊息
  - 訂閱 `state.js` 快照變更，自動更新圖表
  - _需求：9.2, 9.3, 9.4, 9.5_

- [x] 12. 實作 `js/ui/settings.js`（設定頁）
  - 實作匯率設定介面：顯示目前匯率，提供輸入欄位與儲存按鈕
  - 儲存時呼叫 `validateExchangeRate` 驗證，失敗時顯示錯誤提示並保留原有匯率
  - 實作「匯出資料」按鈕：呼叫 `exportData()`，觸發 JSON 檔案下載
  - 實作「匯入資料」按鈕：開啟檔案選擇器，讀取 JSON 後呼叫 `importData()`
  - 匯入失敗時顯示錯誤訊息，保留現有資料
  - _需求：3.1, 3.2, 3.3, 3.4, 3.5, 5.4, 5.5, 5.6_

- [x] 13. 實作 `js/app.js`（主應用程式整合）
  - 實作應用初始化：呼叫 `initState()`，載入所有本地資料
  - 實作頁籤導覽：儀表板、資產清單、設定（切換顯示對應 UI 區塊）
  - 初始化時呼叫 `fetchAllPrices` 並啟動 `startPriceAutoRefresh`
  - 渲染所有 UI 元件（dashboard、assetList、trendChart）
  - 實作 FAB（浮動新增按鈕），點擊後開啟 `openAssetModal()`
  - 實作 Service Worker 註冊：`navigator.serviceWorker.register('/sw.js')`
  - 空資料時顯示引導提示（「點擊 + 新增第一筆資產」）
  - _需求：5.2, 5.3, 6.1, 6.2, 6.3, 6.4, 7.1, 7.2, 7.3, 7.4_

- [x] 14. 最終檢查點 — 確認所有測試通過
  - 執行 `vitest --run` 確認全部測試通過，如有問題請向使用者確認。

---

## 備註

- 標有 `*` 的子任務為選填，可跳過以加速 MVP 開發
- 每個任務均標註對應需求編號以確保可追溯性
- 屬性測試對應設計文件中的 13 個正確性屬性（屬性 1–13）
- 屬性測試使用 `fast-check` 生成任意輸入，單元測試驗證具體範例與邊界條件
- 檢查點確保每個階段的增量驗證
