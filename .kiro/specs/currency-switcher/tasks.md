# 實作計畫：貨幣切換功能（Currency Switcher）

## 概述

本計畫將貨幣切換功能拆解為漸進式的實作步驟。核心策略為**由底層向上**：先建立 store 與服務層，再修改 UI 元件，最後整合測試。所有金額換算僅在 `localeFormatter.js` 的 `formatCurrency()` 中進行，底層資料與計算邏輯不受影響。

## 任務

- [x] 1. 擴展 storage 服務與建立新 store
  - [x] 1.1 擴展 `src/lib/services/storage.js`，新增顯示貨幣與匯率對照表的讀寫函式
    - 在 `KEYS` 常數中新增 `DISPLAY_CURRENCY: 'nwt_display_currency'` 和 `EXCHANGE_RATE_MAP: 'nwt_exchange_rate_map'`
    - 新增 `saveDisplayCurrency(currency)` / `loadDisplayCurrency()` 函式，預設值為 `'TWD'`
    - 新增 `saveExchangeRateMap(rateMap)` / `loadExchangeRateMap()` 函式，預設值為 `{ USD: 31.5, CNY: 4.35, JPY: 0.21, KRW: 0.023 }`
    - 確保 `loadDisplayCurrency()` 在 localStorage 損壞時回退至 `'TWD'`
    - 確保 `loadExchangeRateMap()` 在 localStorage 損壞時回退至預設匯率
    - _需求：2.1, 2.2, 2.3, 3.4_

  - [x] 1.2 建立 `src/lib/stores/displayCurrency.js` — 顯示貨幣 store
    - 匯出 `SUPPORTED_CURRENCIES` 常數陣列：`['TWD', 'USD', 'CNY', 'JPY', 'KRW']`
    - 匯出 `CURRENCY_NAMES` 對照表：`{ TWD: '新台幣', USD: '美元', CNY: '人民幣', JPY: '日圓', KRW: '韓元' }`
    - 建立 writable store，啟動時從 `loadDisplayCurrency()` 讀取初始值
    - `set()` 時同步持久化至 localStorage（透過 `saveDisplayCurrency()`）
    - 若 localStorage 中的值不在 `SUPPORTED_CURRENCIES` 中，回退至 `'TWD'`
    - _需求：1.4, 2.1, 2.2, 2.3, 2.4_

  - [x] 1.3 建立 `src/lib/stores/exchangeRateMap.js` — 匯率對照表 store
    - 建立 writable store，啟動時從 `loadExchangeRateMap()` 讀取初始值
    - 提供 `setRate(currency, rate)` 方法：更新單一幣別匯率並持久化
    - 提供 `setAll(rates)` 方法：批次設定所有匯率並持久化
    - TWD 匯率始終為 1，不可修改
    - 更新時同步更新既有 `exchangeRate` store（`rateMap.USD` → `exchangeRate`），確保向後相容
    - 匯出 `CURRENCY_DECIMALS` 常數：`{ TWD: 0, USD: 2, CNY: 2, JPY: 0, KRW: 0 }`
    - 匯出 `DEFAULT_RATES` 常數：`{ USD: 31.5, CNY: 4.35, JPY: 0.21, KRW: 0.023 }`
    - _需求：3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 1.4 撰寫屬性測試：貨幣設定持久化 Round-Trip
    - **屬性 1：貨幣設定持久化 Round-Trip**
    - 使用 `fc.constantFrom('TWD', 'USD', 'CNY', 'JPY', 'KRW')` 產生任意支援貨幣
    - 驗證：設定顯示貨幣後，從 localStorage 讀取應得到相同的貨幣代碼
    - 測試檔案：`tests/displayCurrency.test.js`
    - **驗證：需求 2.1, 2.2**

  - [x] 1.5 撰寫屬性測試：匯率對照表持久化 Round-Trip
    - **屬性 2：匯率對照表持久化 Round-Trip**
    - 使用 `fc.record({ USD: rateArb, CNY: rateArb, JPY: rateArb, KRW: rateArb })` 產生任意有效匯率
    - 驗證：儲存匯率對照表後再讀取，應得到等價的匯率對照表
    - 測試檔案：`tests/exchangeRateMap.test.js`
    - **驗證：需求 3.4**

  - [x] 1.6 撰寫屬性測試：無效匯率拒絕
    - **屬性 7：無效匯率拒絕**
    - 使用 `fc.oneof(fc.constant(NaN), fc.constant(Infinity), fc.constant(-1), fc.constant(0), fc.double({ max: 0 }))` 產生無效值
    - 驗證：`validateExchangeRate()` 對所有非有限正數回傳 false
    - 測試檔案：`tests/exchangeRateMap.test.js`
    - **驗證：需求 7.3**

- [x] 2. 修改 localeFormatter 加入貨幣換算邏輯
  - [x] 2.1 修改 `src/lib/services/localeFormatter.js`，加入顯示貨幣換算
    - 匯入 `displayCurrency` store 和 `exchangeRateMap` store
    - 新增模組層級變數 `currentDisplayCurrency` 和 `currentRateMap`，透過 `subscribe()` 保持同步
    - 匯入 `CURRENCY_DECIMALS` 常數
    - 修改 `formatCurrency(amount, currency)` 函式：
      - 若 `currentDisplayCurrency !== 'TWD'`，先將金額除以對應匯率
      - 使用 `Intl.NumberFormat` 以目標貨幣格式化，根據 `CURRENCY_DECIMALS` 設定小數位
    - 新增或修改 `formatCompact()` 函式（PieChart 使用），套用相同的換算邏輯
    - _需求：4.1, 4.2, 4.3, 4.4_

  - [x] 2.2 撰寫屬性測試：貨幣換算正確性
    - **屬性 3：貨幣換算正確性**
    - 使用 `fc.double({ min: -1e8, max: 1e8 })` × `fc.constantFrom('TWD', 'USD', 'CNY', 'JPY', 'KRW')` 產生任意金額與貨幣
    - 驗證：`formatCurrency()` 輸出的數值部分等於 `amount / exchangeRateMap[currency]`（浮點精度範圍內）
    - 當顯示貨幣為 TWD 時，輸出應與原始 TWD 格式化行為一致
    - 測試檔案：`tests/localeFormatter.test.js`
    - **驗證：需求 4.1, 4.2**

  - [x] 2.3 撰寫屬性測試：貨幣格式化正確性
    - **屬性 4：貨幣格式化正確性**
    - 使用 `fc.double({ min: 0, max: 1e8 })` × `fc.constantFrom('TWD', 'USD', 'CNY', 'JPY', 'KRW')` 產生任意金額與貨幣
    - 驗證：JPY/KRW 格式化結果為零小數位，USD/CNY 為最多兩位小數
    - 驗證：格式化結果包含對應貨幣的正確符號
    - 測試檔案：`tests/localeFormatter.test.js`
    - **驗證：需求 4.3, 4.4**

- [x] 3. 檢查點 — 確認核心邏輯正確
  - 確保所有測試通過，如有疑問請詢問使用者。

- [x] 4. 建立 CurrencySwitcher UI 元件與擴展匯率編輯介面
  - [x] 4.1 擴展 i18n 翻譯檔案，新增貨幣切換相關翻譯 key
    - 在 `src/lib/i18n/zh-TW.json`（及其他語言檔案）中新增：
      - `settings.displayCurrency`：「顯示貨幣」
      - `settings.displayCurrencyDesc`：「切換所有金額的顯示幣別，底層資料不受影響」
      - `settings.rateMapTitle`：「匯率設定」
      - `settings.rateMapDesc`：「設定各貨幣對新台幣的匯率」
      - `currency.TWD` / `currency.USD` / `currency.CNY` / `currency.JPY` / `currency.KRW`
      - `toast.currencySwitched`：「顯示貨幣已切換為 {currency}」
      - `toast.rateMapUpdated`：「匯率已更新」
      - `validation.ratePositiveAll`：「所有匯率必須為正數」
    - _需求：1.2, 7.2, 7.3_

  - [x] 4.2 建立 `src/components/settings/CurrencySwitcher.svelte` 元件
    - 以按鈕群組形式呈現五個貨幣選項（TWD、USD、CNY、JPY、KRW）
    - 每個按鈕顯示貨幣代碼與中文名稱（例如「TWD 新台幣」）
    - 選中項以 accent 色高亮（使用 `active` CSS class）
    - 點擊按鈕時呼叫 `displayCurrency.set(cur)` 並顯示 Toast 通知
    - 使用 `settings-section` CSS class 保持與其他設定區塊一致
    - _需求：1.1, 1.2, 1.3, 1.4, 7.2_

  - [x] 4.3 修改 `src/components/settings/ExchangeRateSection.svelte`，擴展為多幣別匯率編輯
    - 將單一 USD/TWD 輸入改為四個幣別（USD、CNY、JPY、KRW）的匯率輸入欄位
    - 每行顯示「1 {幣別} = [輸入框] TWD」格式
    - 儲存時驗證每個匯率值為有限正數（使用 `validateExchangeRate()`）
    - 驗證失敗時顯示錯誤訊息
    - 儲存成功後更新 `exchangeRateMap` store 並同步更新既有 `exchangeRate` store
    - 顯示 Toast 通知「匯率已更新」
    - _需求：3.2, 3.4, 3.5, 7.3_

  - [x] 4.4 修改 `src/routes/settings/+page.svelte`，整合 CurrencySwitcher 元件
    - 在 `ExchangeRateSection` 上方加入 `CurrencySwitcher` 元件
    - 匯入順序：`CurrencySwitcher` → `ExchangeRateSection` → `DataManagement` → `GoogleIntegration`
    - _需求：1.1_

- [x] 5. 更新所有顯示元件以支援貨幣切換
  - [x] 5.1 更新 `src/components/dashboard/QuickStats.svelte`
    - 確保淨資產、投資總額、債務總額、月增率卡片中的金額透過 `formatCurrency()` 顯示
    - 由於 `formatCurrency()` 已內建換算邏輯，只需確認所有金額都經過 `formatCurrency()` 格式化
    - 若有直接使用 `Intl.NumberFormat` 的地方，改為使用 `formatCurrency()`
    - _需求：5.1_

  - [x] 5.2 更新 `src/components/dashboard/PieChart.svelte`
    - 確保圖例金額、tooltip 金額與中央淨資產金額透過 `formatCurrency()` 或 `formatCompact()` 顯示
    - _需求：5.2_

  - [x] 5.3 更新 `src/components/assets/AssetItem.svelte` 與 `AssetList.svelte`
    - 確保每筆資產金額與分類小計透過 `formatCurrency()` 顯示
    - _需求：5.3_

  - [x] 5.4 更新 `src/components/assets/LiabilityItem.svelte` 與 `LiabilityList.svelte`
    - 確保每筆負債金額、月付金、總利息等衍生數值透過 `formatCurrency()` 顯示
    - _需求：5.4_

  - [x] 5.5 更新 `src/components/dashboard/TrendChart.svelte`
    - 確保 Y 軸金額標籤與 tooltip 金額透過 `formatCurrency()` 或 `formatCompact()` 顯示
    - _需求：5.5_

  - [x] 5.6 更新 `src/components/dashboard/PnlCalendar.svelte`
    - 確保每日盈虧金額透過 `formatCurrency()` 顯示
    - _需求：5.6_

- [x] 6. 檢查點 — 確認 UI 整合正確
  - 確保所有測試通過，如有疑問請詢問使用者。

- [x] 7. 確保底層資料不受影響與匯出匯入完整性
  - [x] 7.1 驗證 `src/lib/services/storage.js` 的 `exportData()` 和 `importData()` 不受顯示貨幣影響
    - 確認 `exportData()` 輸出的 JSON 中所有金額為原始 TWD 數值
    - 確認 `importData()` 以 TWD 為基準匯入，不受 `displayCurrency` 設定影響
    - 確認 `calculateTotals()` 和 `calculateGrowthRates()` 的輸入輸出不受 `displayCurrency` 影響
    - _需求：6.1, 6.2, 6.3, 6.4_

  - [x] 7.2 撰寫屬性測試：顯示層不影響底層資料
    - **屬性 5：顯示層不影響底層資料**
    - 驗證：無論 `displayCurrency` 如何切換，localStorage 中的 `nwt_assets`、`nwt_liabilities`、`nwt_snapshots` 資料保持不變
    - 驗證：`calculateTotals()` 和 `calculateGrowthRates()` 的輸出不受 `displayCurrency` 設定影響
    - 測試檔案：`tests/calculator.test.js`（擴展）
    - **驗證：需求 6.1, 6.2**

  - [x] 7.3 撰寫屬性測試：匯出匯入資料完整性
    - **屬性 6：匯出匯入資料完整性**
    - 驗證：對於任何顯示貨幣設定，`exportData()` 輸出的 JSON 中所有金額為原始 TWD 數值
    - 驗證：`importData()` 以 TWD 為基準匯入，不受當前 `displayCurrency` 設定影響
    - 測試檔案：`tests/storage.test.js`（擴展）
    - **驗證：需求 6.3, 6.4**

- [x] 8. 最終檢查點 — 確保所有測試通過
  - 確保所有測試通過，如有疑問請詢問使用者。

## 備註

- 標記 `*` 的任務為選用任務，可跳過以加速 MVP 開發
- 每個任務皆標註對應的需求編號，確保可追溯性
- 檢查點確保漸進式驗證，及早發現問題
- 屬性測試驗證設計文件中定義的 7 個正確性屬性
- 單元測試驗證特定範例與邊界情況
