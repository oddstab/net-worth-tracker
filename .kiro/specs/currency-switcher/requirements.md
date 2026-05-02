# 需求文件：貨幣切換功能（Currency Switcher）

## 簡介

在 Net Worth Tracker 設定頁面中新增貨幣切換功能，讓使用者可以將所有顯示金額從預設的 TWD（新台幣）切換為其他指定貨幣（USD、CNY、JPY、KRW）。切換後，應用程式中所有金額顯示（儀表板、資產列表、負債列表、圓餅圖、趨勢圖等）皆以所選貨幣呈現。底層資料仍以 TWD 儲存，僅在顯示層進行換算。

## 詞彙表

- **Currency_Switcher**：設定頁面中的貨幣切換 UI 元件，提供貨幣選擇功能
- **Display_Currency**：使用者選擇的顯示貨幣，決定所有金額的呈現幣別
- **Exchange_Rate_Map**：一組 TWD 對各目標貨幣的匯率對照表，用於金額換算
- **Locale_Formatter**：負責根據當前語言與顯示貨幣格式化金額的服務模組（`localeFormatter.js`）
- **Currency_Store**：管理當前顯示貨幣設定的 Svelte writable store，負責持久化至 localStorage
- **Supported_Currencies**：系統支援的貨幣清單，包含 TWD、USD、CNY、JPY、KRW
- **Base_Currency**：系統內部計算與儲存使用的基準貨幣，固定為 TWD

## 需求

### 需求 1：貨幣選擇 UI

**使用者故事：** 身為使用者，我希望在設定頁面中看到貨幣切換選項，以便選擇我偏好的顯示貨幣。

#### 驗收條件

1. THE Currency_Switcher SHALL 在設定頁面中顯示一個貨幣選擇區塊，包含標題「顯示貨幣」與五個可選貨幣選項：TWD、USD、CNY、JPY、KRW
2. THE Currency_Switcher SHALL 以按鈕群組或下拉選單的形式呈現貨幣選項，每個選項顯示貨幣代碼與對應的中文名稱（例如「TWD 新台幣」、「USD 美元」、「CNY 人民幣」、「JPY 日圓」、「KRW 韓元」）
3. THE Currency_Switcher SHALL 以視覺高亮方式標示當前已選擇的貨幣選項
4. WHEN 使用者首次使用應用程式時，THE Currency_Switcher SHALL 預設選擇 TWD 作為顯示貨幣

### 需求 2：貨幣設定持久化

**使用者故事：** 身為使用者，我希望貨幣選擇在重新載入頁面後仍然保留，以免每次都要重新設定。

#### 驗收條件

1. WHEN 使用者選擇一個新的顯示貨幣時，THE Currency_Store SHALL 將所選貨幣代碼持久化至 localStorage（使用 `nwt_` 前綴的 key）
2. WHEN 應用程式啟動時，THE Currency_Store SHALL 從 localStorage 讀取先前儲存的貨幣設定
3. IF localStorage 中無貨幣設定資料，THEN THE Currency_Store SHALL 使用 TWD 作為預設值
4. WHEN 使用者選擇一個新的顯示貨幣時，THE Currency_Store SHALL 立即通知所有訂閱者（Svelte 響應式更新），使畫面即時反映新的貨幣設定

### 需求 3：匯率對照表管理

**使用者故事：** 身為使用者，我希望系統提供合理的匯率來換算金額，以便我能看到接近真實的外幣金額。

#### 驗收條件

1. THE Exchange_Rate_Map SHALL 包含 TWD 對 USD、CNY、JPY、KRW 四種貨幣的匯率（TWD 對 TWD 匯率固定為 1）
2. THE Exchange_Rate_Map SHALL 提供可編輯的匯率輸入介面，讓使用者可以手動調整各貨幣的匯率
3. THE Exchange_Rate_Map SHALL 提供合理的預設匯率值（例如：1 USD = 31.5 TWD、1 CNY = 4.35 TWD、1 JPY = 0.21 TWD、1 KRW = 0.023 TWD）
4. WHEN 使用者修改匯率值時，THE Exchange_Rate_Map SHALL 將更新後的匯率持久化至 localStorage
5. WHEN 使用者修改匯率值時，THE Exchange_Rate_Map SHALL 立即觸發所有金額顯示的重新計算

### 需求 4：金額顯示換算

**使用者故事：** 身為使用者，我希望切換貨幣後所有頁面的金額都以新貨幣顯示，以便我用熟悉的幣別理解資產狀況。

#### 驗收條件

1. WHEN Display_Currency 不是 TWD 時，THE Locale_Formatter SHALL 將所有 TWD 金額除以對應匯率後，以目標貨幣符號與格式顯示
2. WHEN Display_Currency 為 TWD 時，THE Locale_Formatter SHALL 維持原有的 TWD 格式化行為，不進行任何換算
3. THE Locale_Formatter SHALL 根據 Display_Currency 使用正確的 Intl.NumberFormat 貨幣格式（例如 USD 顯示 "$1,234"、JPY 顯示 "¥1,234"、KRW 顯示 "₩1,234"）
4. THE Locale_Formatter SHALL 對 JPY 和 KRW 等無小數位貨幣使用零小數位格式，對 USD 和 CNY 使用最多兩位小數

### 需求 5：全域金額顯示一致性

**使用者故事：** 身為使用者，我希望切換貨幣後應用程式中所有金額都統一以新貨幣顯示，避免混淆。

#### 驗收條件

1. WHEN Display_Currency 變更時，THE 儀表板 SHALL 以新貨幣顯示淨資產、投資總額、債務總額、月增率卡片中的金額
2. WHEN Display_Currency 變更時，THE 圓餅圖 SHALL 以新貨幣顯示圖例金額、tooltip 金額與中央淨資產金額
3. WHEN Display_Currency 變更時，THE 資產列表 SHALL 以新貨幣顯示每筆資產的金額與分類小計
4. WHEN Display_Currency 變更時，THE 負債列表 SHALL 以新貨幣顯示每筆負債的金額、月付金、總利息等衍生數值
5. WHEN Display_Currency 變更時，THE 趨勢圖 SHALL 以新貨幣顯示 Y 軸金額標籤與 tooltip 金額
6. WHEN Display_Currency 變更時，THE 盈虧日曆 SHALL 以新貨幣顯示每日盈虧金額

### 需求 6：底層資料不受影響

**使用者故事：** 身為使用者，我希望切換顯示貨幣不會改變我的實際資料，以確保資料的正確性與一致性。

#### 驗收條件

1. THE Currency_Switcher SHALL 僅影響顯示層的金額格式化，不修改 localStorage 中儲存的資產、負債或快照資料
2. THE Currency_Switcher SHALL 不改變 calculateTotals、calculateGrowthRates 等計算函式的輸入或輸出（計算仍以 TWD 為基準）
3. WHEN 使用者匯出資料（JSON）時，THE 匯出功能 SHALL 輸出原始 TWD 數值，不受 Display_Currency 設定影響
4. WHEN 使用者匯入資料（JSON）時，THE 匯入功能 SHALL 以 TWD 為基準匯入，不受 Display_Currency 設定影響

### 需求 7：貨幣切換的即時回饋

**使用者故事：** 身為使用者，我希望切換貨幣後能立即看到變化，並知道目前使用的是哪種貨幣。

#### 驗收條件

1. WHEN 使用者在 Currency_Switcher 中選擇新貨幣時，THE 應用程式 SHALL 在 300 毫秒內完成所有可見金額的更新
2. WHEN 使用者成功切換貨幣時，THE 應用程式 SHALL 顯示 Toast 通知，告知使用者貨幣已切換（例如「顯示貨幣已切換為 USD」）
3. IF 使用者輸入的匯率值不是有限正數，THEN THE Currency_Switcher SHALL 顯示驗證錯誤訊息，拒絕儲存無效匯率
