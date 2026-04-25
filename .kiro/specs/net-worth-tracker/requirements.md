# 需求文件

## 簡介

個人資產追蹤器（Personal Asset Tracker）是一個免費的漸進式網頁應用（PWA），讓用戶能夠在手機和電腦上管理個人資產與負債。所有資料儲存於本地裝置，無需伺服器，支援加入手機主畫面使用。應用支援多種資產類別（台股、加密貨幣、穩定幣/現金）及負債類別（信貸、質押借款），並統一以新台幣（TWD）顯示淨資產。

---

## 詞彙表

- **App**：個人資產追蹤器 PWA 應用程式
- **User**：使用該應用的個人用戶
- **Asset**：用戶持有的資產項目，包含投資資產與流動資產
- **Liability**：用戶的負債項目
- **Net_Worth**：資產總計減去負債總計的淨值
- **Asset_Category**：資產的分類，包含「投資資產」與「流動資產」
- **Investment_Asset**：投資資產，包含台股與加密貨幣
- **Liquid_Asset**：流動資產，包含穩定幣與現金
- **Liability_Category**：負債的分類，包含「信貸」與「質押借款」
- **Exchange_Rate**：外幣對新台幣的匯率
- **Local_Storage**：瀏覽器本地儲存空間（localStorage / IndexedDB）
- **TWD**：新台幣（New Taiwan Dollar）
- **USD**：美元（United States Dollar）
- **PWA**：漸進式網頁應用（Progressive Web App），可安裝至手機主畫面
- **Dashboard**：主畫面儀表板，顯示資產總覽與快速數字
- **Snapshot**：某一時間點的淨資產快照記錄，包含日期與淨資產金額
- **Price_Fetcher**：負責從外部 API 自動抓取資產價格的模組
- **TWSE**：台灣證券交易所（Taiwan Stock Exchange）
- **CoinGecko**：提供加密貨幣即時價格的免費公開 API 服務

---

## 需求

### 需求 1：資產項目管理

**用戶故事：** 身為 User，我希望能新增、編輯、刪除各類資產項目，以便追蹤我的持倉狀況。

#### 驗收標準

1. THE App SHALL 提供「投資資產」與「流動資產」兩個資產分類供 User 選擇。
2. WHEN User 新增資產項目時，THE App SHALL 要求輸入：資產名稱、代號（選填）、持有數量、單位幣別（TWD 或 USD）、每單位價格。
3. WHEN User 儲存資產項目時，THE App SHALL 將資產資料寫入 Local_Storage。
4. WHEN User 編輯現有資產項目時，THE App SHALL 更新 Local_Storage 中對應的資料並重新計算顯示值。
5. WHEN User 刪除資產項目時，THE App SHALL 從 Local_Storage 移除該項目並更新總計。
6. IF User 輸入的數量或價格為非正數，THEN THE App SHALL 顯示錯誤提示並阻止儲存。

---

### 需求 2：負債項目管理

**用戶故事：** 身為 User，我希望能新增、編輯、刪除負債項目，以便計算真實的淨資產。

#### 驗收標準

1. THE App SHALL 提供「信貸」與「質押借款」兩個負債分類供 User 選擇。
2. WHEN User 新增負債項目時，THE App SHALL 要求輸入：負債名稱、金額、幣別（TWD 或 USD）。
3. WHEN User 儲存負債項目時，THE App SHALL 將負債資料寫入 Local_Storage。
4. WHEN User 編輯現有負債項目時，THE App SHALL 更新 Local_Storage 中對應的資料並重新計算顯示值。
5. WHEN User 刪除負債項目時，THE App SHALL 從 Local_Storage 移除該項目並更新總計。
6. IF User 輸入的金額為非正數，THEN THE App SHALL 顯示錯誤提示並阻止儲存。

---

### 需求 3：匯率設定與換算

**用戶故事：** 身為 User，我希望能設定 USD/TWD 匯率，以便將所有資產統一換算為新台幣顯示。

#### 驗收標準

1. THE App SHALL 提供匯率設定介面，讓 User 手動輸入 USD 對 TWD 的匯率。
2. WHEN User 更新匯率時，THE App SHALL 立即重新計算所有以 USD 計價的資產與負債的 TWD 換算值。
3. WHEN User 更新匯率時，THE App SHALL 將新匯率儲存至 Local_Storage。
4. WHILE 匯率尚未由 User 設定，THE App SHALL 使用預設匯率 31.5（USD/TWD）進行換算。
5. IF User 輸入的匯率為非正數，THEN THE App SHALL 顯示錯誤提示並保留原有匯率。

---

### 需求 4：淨資產總覽

**用戶故事：** 身為 User，我希望能在主畫面看到資產總計、負債總計與淨資產，以便快速掌握財務狀況。

#### 驗收標準

1. THE App SHALL 在主畫面顯示「資產總計（TWD）」、「負債總計（TWD）」與「淨資產（TWD）」三個數值。
2. THE App SHALL 依照「投資資產」與「流動資產」分類，分別顯示各分類小計（TWD）。
3. THE App SHALL 依照「信貸」與「質押借款」分類，分別顯示各分類小計（TWD）。
4. WHEN 任何資產或負債項目發生變更時，THE App SHALL 即時更新主畫面上的所有總計數值。
5. THE App SHALL 以清單形式在各分類下列出所有項目，顯示名稱、持有數量/金額及 TWD 換算值。

---

### 需求 5：本地資料持久化

**用戶故事：** 身為 User，我希望資料能儲存在本地裝置，以便不需要網路或伺服器也能使用。

#### 驗收標準

1. THE App SHALL 將所有資產、負債及匯率資料儲存於 Local_Storage，不傳送至任何外部伺服器。
2. WHEN User 重新開啟 App 時，THE App SHALL 從 Local_Storage 讀取並還原所有先前儲存的資料。
3. IF Local_Storage 中無任何資料，THEN THE App SHALL 以空白狀態啟動並顯示引導提示。
4. THE App SHALL 提供資料匯出功能，將所有資料以 JSON 格式下載至 User 的裝置。
5. THE App SHALL 提供資料匯入功能，讓 User 從 JSON 檔案還原資料。
6. IF 匯入的 JSON 格式不符合預期結構，THEN THE App SHALL 顯示錯誤提示並保留現有資料不變。

---

### 需求 6：PWA 安裝與離線使用

**用戶故事：** 身為 User，我希望能將 App 加入手機主畫面並在離線狀態下使用，以便像原生 APP 一樣操作。

#### 驗收標準

1. THE App SHALL 提供符合 PWA 標準的 Web App Manifest，包含應用名稱、圖示與主題色。
2. THE App SHALL 實作 Service Worker，使 App 在無網路連線時仍可正常讀取與操作本地資料。
3. WHEN User 在支援 PWA 的瀏覽器中開啟 App 時，THE App SHALL 觸發瀏覽器的「加入主畫面」提示。
4. WHILE App 以已安裝的 PWA 模式執行時，THE App SHALL 以全螢幕（standalone）模式顯示，不顯示瀏覽器網址列。

---

### 需求 7：響應式介面

**用戶故事：** 身為 User，我希望 App 在手機和電腦上都有良好的顯示效果，以便在不同裝置上使用。

#### 驗收標準

1. THE App SHALL 採用響應式設計，在螢幕寬度 320px 至 1920px 的範圍內正確顯示所有介面元素。
2. WHEN User 在寬度小於 768px 的裝置上使用時，THE App SHALL 以單欄垂直排列顯示資產清單與總覽資訊。
3. WHEN User 在寬度大於或等於 768px 的裝置上使用時，THE App SHALL 以多欄並排方式顯示資產清單與總覽資訊。
4. THE App SHALL 確保所有互動元素（按鈕、輸入欄位）的觸控目標尺寸不小於 44×44 像素。

---

### 需求 8：儀表板總覽

**用戶故事：** 身為 User，我希望在主畫面頂部能一眼看到關鍵財務數字與資產配置比例，以便快速掌握整體財務狀況。

#### 驗收標準

1. THE Dashboard SHALL 在主畫面頂部以 4 格並排方式顯示以下快速數字：資產月增率（%）、投資總額（TWD）、流動資產（TWD）、債務（TWD）。
2. WHEN 任何資產或負債項目發生變更時，THE Dashboard SHALL 即時更新 4 格快速數字的顯示值。
3. THE Dashboard SHALL 顯示一個圓餅圖，呈現投資資產、流動資產與債務三者的金額比例。
4. THE Dashboard SHALL 在圓餅圖中央顯示當前淨資產（TWD）金額。
5. THE Dashboard SHALL 在圓餅圖下方顯示圖例，每個類別標示對應的 TWD 金額與佔比百分比。
6. WHEN 任何資產或負債項目發生變更時，THE Dashboard SHALL 即時更新圓餅圖的比例與中央淨資產金額。

---

### 需求 9：淨資產趨勢圖

**用戶故事：** 身為 User，我希望能查看淨資產的歷史變化趨勢，以便了解財務成長軌跡。

#### 驗收標準

1. WHEN User 修改任何資產或負債項目時，THE App SHALL 自動儲存一筆 Snapshot 至 Local_Storage，記錄當下日期與淨資產金額。
2. THE App SHALL 以折線圖顯示所有 Snapshot 的淨資產歷史變化。
3. THE App SHALL 提供時間範圍篩選器，支援以下選項：1 週、1 個月、6 個月、1 年、全部。
4. WHEN User 選擇時間範圍時，THE App SHALL 僅顯示該時間範圍內的 Snapshot 資料於折線圖中。
5. IF 所選時間範圍內無任何 Snapshot 資料，THEN THE App SHALL 顯示「該時間範圍內無資料」的提示訊息。
6. THE App SHALL 將所有 Snapshot 資料儲存於 Local_Storage，不傳送至任何外部伺服器。

---

### 需求 10：自動價格抓取

**用戶故事：** 身為 User，我希望台股與加密貨幣的價格能自動更新，以便不需要手動查詢並輸入最新價格。

#### 驗收標準

1. WHEN User 持有台股資產時，THE Price_Fetcher SHALL 自動從 TWSE 公開資料或 Yahoo Finance 免費 API 抓取對應股票的最新收盤價格。
2. WHEN User 持有加密貨幣資產時，THE Price_Fetcher SHALL 自動從 CoinGecko 免費 API 抓取對應加密貨幣的即時價格。
3. WHEN 自動抓取價格成功時，THE App SHALL 更新對應資產的每單位價格並重新計算該資產的 TWD 總值。
4. IF 自動抓取失敗（包含無網路連線或 API 回傳錯誤），THEN THE App SHALL 保留該資產的上次已知價格並繼續顯示。
5. THE App SHALL 在每個資產項目旁顯示最後價格更新時間。
6. WHEN User 手動輸入資產的每單位價格時，THE App SHALL 以 User 輸入的價格覆蓋自動抓取的價格並更新計算結果。
