/**
 * Google Sheets 整合服務
 * 提供資產數據與 Google Sheets 的雙向同步功能
 */

class GoogleSheetsService {
    constructor() {
        this.isSignedIn = false;
        this.gapi = null;
        this.spreadsheetId = null;
        
        // Google API 配置
        this.CLIENT_ID = ''; // 需要用戶設置
        this.API_KEY = '';   // 需要用戶設置
        this.DISCOVERY_DOC = 'https://sheets.googleapis.com/$discovery/rest?version=v4';
        this.SCOPES = 'https://www.googleapis.com/auth/spreadsheets';
    }

    /**
     * 初始化 Google API
     */
    async initialize() {
        try {
            // 動態載入 Google API
            await this.loadGoogleAPI();
            
            await gapi.load('client:auth2', async () => {
                await gapi.client.init({
                    apiKey: this.API_KEY,
                    clientId: this.CLIENT_ID,
                    discoveryDocs: [this.DISCOVERY_DOC],
                    scope: this.SCOPES
                });

                this.gapi = gapi;
                this.isSignedIn = gapi.auth2.getAuthInstance().isSignedIn.get();
                
                // 監聽登入狀態變化
                gapi.auth2.getAuthInstance().isSignedIn.listen(this.onSignInStatusChange.bind(this));
            });
            
            return true;
        } catch (error) {
            console.error('Google API 初始化失敗:', error);
            return false;
        }
    }

    /**
     * 動態載入 Google API 腳本
     */
    loadGoogleAPI() {
        return new Promise((resolve, reject) => {
            if (window.gapi) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://apis.google.com/js/api.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    /**
     * 登入狀態變化處理
     */
    onSignInStatusChange(isSignedIn) {
        this.isSignedIn = isSignedIn;
        
        // 觸發自定義事件
        window.dispatchEvent(new CustomEvent('googleSignInStatusChanged', {
            detail: { isSignedIn }
        }));
    }

    /**
     * Google 登入
     */
    async signIn() {
        if (!this.gapi) {
            throw new Error('Google API 未初始化');
        }

        try {
            await this.gapi.auth2.getAuthInstance().signIn();
            return true;
        } catch (error) {
            console.error('Google 登入失敗:', error);
            throw error;
        }
    }

    /**
     * Google 登出
     */
    async signOut() {
        if (!this.gapi) return;

        try {
            await this.gapi.auth2.getAuthInstance().signOut();
            this.spreadsheetId = null;
        } catch (error) {
            console.error('Google 登出失敗:', error);
        }
    }

    /**
     * 創建新的 Google Sheets
     */
    async createSpreadsheet(title = 'Net Worth Tracker') {
        if (!this.isSignedIn) {
            throw new Error('請先登入 Google 帳戶');
        }

        try {
            const response = await gapi.client.sheets.spreadsheets.create({
                properties: {
                    title: title
                },
                sheets: [
                    {
                        properties: {
                            title: '資產清單',
                            gridProperties: {
                                rowCount: 1000,
                                columnCount: 10
                            }
                        }
                    },
                    {
                        properties: {
                            title: '歷史記錄',
                            gridProperties: {
                                rowCount: 1000,
                                columnCount: 5
                            }
                        }
                    }
                ]
            });

            this.spreadsheetId = response.result.spreadsheetId;
            
            // 設置表頭
            await this.setupHeaders();
            
            return {
                spreadsheetId: this.spreadsheetId,
                url: `https://docs.google.com/spreadsheets/d/${this.spreadsheetId}/edit`
            };
        } catch (error) {
            console.error('創建 Google Sheets 失敗:', error);
            throw error;
        }
    }

    /**
     * 設置表格標題行
     */
    async setupHeaders() {
        const assetHeaders = [
            ['資產名稱', '類別', '數量', '單價 (TWD)', '總值 (TWD)', '更新時間', '備註']
        ];

        const historyHeaders = [
            ['日期', '總資產', '總負債', '淨資產', '備註']
        ];

        try {
            await gapi.client.sheets.spreadsheets.values.batchUpdate({
                spreadsheetId: this.spreadsheetId,
                resource: {
                    valueInputOption: 'RAW',
                    data: [
                        {
                            range: '資產清單!A1:G1',
                            values: assetHeaders
                        },
                        {
                            range: '歷史記錄!A1:E1',
                            values: historyHeaders
                        }
                    ]
                }
            });

            // 格式化標題行
            await this.formatHeaders();
        } catch (error) {
            console.error('設置表頭失敗:', error);
            throw error;
        }
    }

    /**
     * 格式化標題行
     */
    async formatHeaders() {
        try {
            await gapi.client.sheets.spreadsheets.batchUpdate({
                spreadsheetId: this.spreadsheetId,
                resource: {
                    requests: [
                        {
                            repeatCell: {
                                range: {
                                    sheetId: 0, // 資產清單
                                    startRowIndex: 0,
                                    endRowIndex: 1
                                },
                                cell: {
                                    userEnteredFormat: {
                                        backgroundColor: { red: 0.85, green: 0.27, blue: 0.94 }, // 深粉色
                                        textFormat: {
                                            foregroundColor: { red: 1, green: 1, blue: 1 },
                                            bold: true
                                        }
                                    }
                                },
                                fields: 'userEnteredFormat(backgroundColor,textFormat)'
                            }
                        },
                        {
                            repeatCell: {
                                range: {
                                    sheetId: 1, // 歷史記錄
                                    startRowIndex: 0,
                                    endRowIndex: 1
                                },
                                cell: {
                                    userEnteredFormat: {
                                        backgroundColor: { red: 0.85, green: 0.27, blue: 0.94 },
                                        textFormat: {
                                            foregroundColor: { red: 1, green: 1, blue: 1 },
                                            bold: true
                                        }
                                    }
                                },
                                fields: 'userEnteredFormat(backgroundColor,textFormat)'
                            }
                        }
                    ]
                }
            });
        } catch (error) {
            console.error('格式化標題失敗:', error);
        }
    }

    /**
     * 同步資產數據到 Google Sheets
     */
    async syncAssetsToSheets(assets) {
        if (!this.isSignedIn || !this.spreadsheetId) {
            throw new Error('請先登入並設置 Google Sheets');
        }

        try {
            // 準備數據
            const values = assets.map(asset => [
                asset.name,
                asset.category,
                asset.quantity || 1,
                asset.price || 0,
                asset.totalTWD || 0,
                new Date(asset.lastUpdated).toLocaleString('zh-TW'),
                asset.notes || ''
            ]);

            // 清除現有數據（保留標題）
            await gapi.client.sheets.spreadsheets.values.clear({
                spreadsheetId: this.spreadsheetId,
                range: '資產清單!A2:G1000'
            });

            // 寫入新數據
            if (values.length > 0) {
                await gapi.client.sheets.spreadsheets.values.update({
                    spreadsheetId: this.spreadsheetId,
                    range: `資產清單!A2:G${values.length + 1}`,
                    valueInputOption: 'RAW',
                    resource: { values }
                });
            }

            return true;
        } catch (error) {
            console.error('同步資產到 Google Sheets 失敗:', error);
            throw error;
        }
    }

    /**
     * 從 Google Sheets 讀取資產數據
     */
    async loadAssetsFromSheets() {
        if (!this.isSignedIn || !this.spreadsheetId) {
            throw new Error('請先登入並設置 Google Sheets');
        }

        try {
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: '資產清單!A2:G1000'
            });

            const rows = response.result.values || [];
            const assets = rows
                .filter(row => row[0]) // 過濾空行
                .map((row, index) => ({
                    id: `sheet_${index}`,
                    name: row[0] || '',
                    category: row[1] || 'other',
                    quantity: parseFloat(row[2]) || 1,
                    price: parseFloat(row[3]) || 0,
                    totalTWD: parseFloat(row[4]) || 0,
                    lastUpdated: new Date(row[5] || Date.now()).getTime(),
                    notes: row[6] || ''
                }));

            return assets;
        } catch (error) {
            console.error('從 Google Sheets 讀取資產失敗:', error);
            throw error;
        }
    }

    /**
     * 記錄淨資產歷史
     */
    async recordNetWorthHistory(totalAssets, totalDebt, netWorth, notes = '') {
        if (!this.isSignedIn || !this.spreadsheetId) {
            return false;
        }

        try {
            const values = [[
                new Date().toLocaleDateString('zh-TW'),
                totalAssets,
                totalDebt,
                netWorth,
                notes
            ]];

            await gapi.client.sheets.spreadsheets.values.append({
                spreadsheetId: this.spreadsheetId,
                range: '歷史記錄!A:E',
                valueInputOption: 'RAW',
                resource: { values }
            });

            return true;
        } catch (error) {
            console.error('記錄歷史失敗:', error);
            return false;
        }
    }

    /**
     * 設置 API 金鑰和客戶端 ID
     */
    setCredentials(clientId, apiKey) {
        this.CLIENT_ID = clientId;
        this.API_KEY = apiKey;
        
        // 保存到本地存儲
        localStorage.setItem('google_client_id', clientId);
        localStorage.setItem('google_api_key', apiKey);
    }

    /**
     * 從本地存儲載入憑證
     */
    loadCredentials() {
        this.CLIENT_ID = localStorage.getItem('google_client_id') || '';
        this.API_KEY = localStorage.getItem('google_api_key') || '';
        this.spreadsheetId = localStorage.getItem('google_spreadsheet_id') || null;
    }

    /**
     * 保存 Spreadsheet ID
     */
    saveSpreadsheetId(spreadsheetId) {
        this.spreadsheetId = spreadsheetId;
        localStorage.setItem('google_spreadsheet_id', spreadsheetId);
    }

    /**
     * 獲取當前用戶信息
     */
    getCurrentUser() {
        if (!this.isSignedIn || !this.gapi) return null;

        const user = this.gapi.auth2.getAuthInstance().currentUser.get();
        const profile = user.getBasicProfile();
        
        return {
            id: profile.getId(),
            name: profile.getName(),
            email: profile.getEmail(),
            imageUrl: profile.getImageUrl()
        };
    }
}

// 創建全局實例
window.googleSheetsService = new GoogleSheetsService();

export default GoogleSheetsService;