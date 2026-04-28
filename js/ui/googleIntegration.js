/**
 * Google 整合 UI 組件
 * 處理 Google Sheets 同步的用戶界面
 */

class GoogleIntegrationUI {
    constructor() {
        this.googleService = window.googleSheetsService;
        this.isInitialized = false;
        
        this.bindEvents();
        this.loadCredentials();
    }

    /**
     * 綁定事件監聽器
     */
    bindEvents() {
        // 監聽 Google 登入狀態變化
        window.addEventListener('googleSignInStatusChanged', (event) => {
            this.updateUI(event.detail.isSignedIn);
        });

        // 綁定按鈕事件
        document.addEventListener('click', (event) => {
            if (event.target.matches('[data-action="google-setup"]')) {
                this.showSetupModal();
            } else if (event.target.matches('[data-action="google-signin"]')) {
                this.handleSignIn();
            } else if (event.target.matches('[data-action="google-signout"]')) {
                this.handleSignOut();
            } else if (event.target.matches('[data-action="google-sync-to-sheets"]')) {
                this.syncToSheets();
            } else if (event.target.matches('[data-action="google-sync-from-sheets"]')) {
                this.syncFromSheets();
            } else if (event.target.matches('[data-action="google-create-sheet"]')) {
                this.createNewSheet();
            }
        });
    }

    /**
     * 載入保存的憑證
     */
    loadCredentials() {
        this.googleService.loadCredentials();
        
        if (this.googleService.CLIENT_ID && this.googleService.API_KEY) {
            this.initializeGoogleAPI();
        }
    }

    /**
     * 初始化 Google API
     */
    async initializeGoogleAPI() {
        try {
            const success = await this.googleService.initialize();
            if (success) {
                this.isInitialized = true;
                this.updateUI(this.googleService.isSignedIn);
            }
        } catch (error) {
            console.error('Google API 初始化失敗:', error);
            this.showToast('Google API 初始化失敗', 'error');
        }
    }

    /**
     * 顯示設置模態框
     */
    showSetupModal() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal">
                <div class="modal-header">
                    <h2 class="modal-title">Google Sheets 整合設置</h2>
                    <button class="modal-close" data-action="close-modal">×</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label class="form-label">Google API 金鑰 <span class="required">*</span></label>
                        <input type="text" class="form-input" id="google-api-key" 
                               placeholder="請輸入 Google API Key" 
                               value="${this.googleService.API_KEY}">
                        <div class="form-hint">
                            需要在 <a href="https://console.cloud.google.com/" target="_blank">Google Cloud Console</a> 
                            啟用 Google Sheets API 並創建 API 金鑰
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">OAuth 客戶端 ID <span class="required">*</span></label>
                        <input type="text" class="form-input" id="google-client-id" 
                               placeholder="請輸入 OAuth 2.0 客戶端 ID"
                               value="${this.googleService.CLIENT_ID}">
                        <div class="form-hint">
                            需要創建 OAuth 2.0 客戶端 ID，應用程式類型選擇「網頁應用程式」
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Spreadsheet ID (可選)</label>
                        <input type="text" class="form-input" id="google-spreadsheet-id" 
                               placeholder="現有的 Google Sheets ID"
                               value="${this.googleService.spreadsheetId || ''}">
                        <div class="form-hint">
                            如果您已有 Google Sheets，可以輸入 ID。留空將創建新的表格。
                        </div>
                    </div>

                    <div class="google-setup-help">
                        <h4>設置步驟：</h4>
                        <ol>
                            <li>前往 <a href="https://console.cloud.google.com/" target="_blank">Google Cloud Console</a></li>
                            <li>創建新項目或選擇現有項目</li>
                            <li>啟用 Google Sheets API</li>
                            <li>創建憑證：
                                <ul>
                                    <li>API 金鑰（用於 Sheets API）</li>
                                    <li>OAuth 2.0 客戶端 ID（用於用戶登入）</li>
                                </ul>
                            </li>
                            <li>在 OAuth 設置中添加授權網域</li>
                        </ol>
                    </div>
                </div>
                <div class="modal-actions">
                    <button class="btn btn-secondary" data-action="close-modal">取消</button>
                    <button class="btn btn-primary" data-action="save-google-setup">保存設置</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // 綁定模態框事件
        modal.addEventListener('click', (event) => {
            if (event.target.matches('[data-action="close-modal"]') || 
                event.target === modal) {
                modal.remove();
            } else if (event.target.matches('[data-action="save-google-setup"]')) {
                this.saveGoogleSetup(modal);
            }
        });
    }

    /**
     * 保存 Google 設置
     */
    async saveGoogleSetup(modal) {
        const apiKey = modal.querySelector('#google-api-key').value.trim();
        const clientId = modal.querySelector('#google-client-id').value.trim();
        const spreadsheetId = modal.querySelector('#google-spreadsheet-id').value.trim();

        if (!apiKey || !clientId) {
            this.showToast('請填寫 API 金鑰和客戶端 ID', 'error');
            return;
        }

        try {
            // 保存憑證
            this.googleService.setCredentials(clientId, apiKey);
            
            if (spreadsheetId) {
                this.googleService.saveSpreadsheetId(spreadsheetId);
            }

            // 初始化 Google API
            await this.initializeGoogleAPI();

            modal.remove();
            this.showToast('Google 設置已保存', 'success');
            
            // 更新 UI
            this.updateUI(this.googleService.isSignedIn);
            
        } catch (error) {
            console.error('保存 Google 設置失敗:', error);
            this.showToast('設置失敗，請檢查憑證是否正確', 'error');
        }
    }

    /**
     * 處理 Google 登入
     */
    async handleSignIn() {
        if (!this.isInitialized) {
            this.showToast('請先完成 Google API 設置', 'error');
            this.showSetupModal();
            return;
        }

        try {
            await this.googleService.signIn();
            this.showToast('Google 登入成功', 'success');
        } catch (error) {
            console.error('Google 登入失敗:', error);
            this.showToast('登入失敗，請重試', 'error');
        }
    }

    /**
     * 處理 Google 登出
     */
    async handleSignOut() {
        try {
            await this.googleService.signOut();
            this.showToast('已登出 Google 帳戶', 'success');
        } catch (error) {
            console.error('Google 登出失敗:', error);
        }
    }

    /**
     * 同步資產到 Google Sheets
     */
    async syncToSheets() {
        if (!this.googleService.isSignedIn) {
            this.showToast('請先登入 Google 帳戶', 'error');
            return;
        }

        try {
            // 獲取當前資產數據
            const assets = JSON.parse(localStorage.getItem('assets') || '[]');
            
            if (assets.length === 0) {
                this.showToast('沒有資產數據可同步', 'warning');
                return;
            }

            await this.googleService.syncAssetsToSheets(assets);
            this.showToast(`已同步 ${assets.length} 項資產到 Google Sheets`, 'success');
            
            // 記錄淨資產歷史
            const calculator = window.calculator;
            if (calculator) {
                const stats = calculator.calculateStats();
                await this.googleService.recordNetWorthHistory(
                    stats.totalAssets,
                    stats.totalDebt,
                    stats.netWorth,
                    '自動同步'
                );
            }
            
        } catch (error) {
            console.error('同步到 Google Sheets 失敗:', error);
            this.showToast('同步失敗，請重試', 'error');
        }
    }

    /**
     * 從 Google Sheets 同步資產
     */
    async syncFromSheets() {
        if (!this.googleService.isSignedIn) {
            this.showToast('請先登入 Google 帳戶', 'error');
            return;
        }

        try {
            const assets = await this.googleService.loadAssetsFromSheets();
            
            if (assets.length === 0) {
                this.showToast('Google Sheets 中沒有資產數據', 'warning');
                return;
            }

            // 確認覆蓋本地數據
            const confirmed = confirm(`將從 Google Sheets 載入 ${assets.length} 項資產，這會覆蓋本地數據。確定要繼續嗎？`);
            if (!confirmed) return;

            // 保存到本地存儲
            localStorage.setItem('assets', JSON.stringify(assets));
            
            // 觸發資產列表更新
            window.dispatchEvent(new CustomEvent('assetsUpdated'));
            
            this.showToast(`已從 Google Sheets 載入 ${assets.length} 項資產`, 'success');
            
        } catch (error) {
            console.error('從 Google Sheets 同步失敗:', error);
            this.showToast('同步失敗，請重試', 'error');
        }
    }

    /**
     * 創建新的 Google Sheets
     */
    async createNewSheet() {
        if (!this.googleService.isSignedIn) {
            this.showToast('請先登入 Google 帳戶', 'error');
            return;
        }

        try {
            const result = await this.googleService.createSpreadsheet('Net Worth Tracker');
            this.showToast('已創建新的 Google Sheets', 'success');
            
            // 詢問是否要打開 Google Sheets
            const openSheet = confirm('Google Sheets 已創建成功！要現在打開嗎？');
            if (openSheet) {
                window.open(result.url, '_blank');
            }
            
        } catch (error) {
            console.error('創建 Google Sheets 失敗:', error);
            this.showToast('創建失敗，請重試', 'error');
        }
    }

    /**
     * 更新 UI 狀態
     */
    updateUI(isSignedIn) {
        // 更新設置頁面的 Google 整合區塊
        this.updateSettingsSection(isSignedIn);
        
        // 更新 FAB 菜單
        this.updateFabMenu(isSignedIn);
    }

    /**
     * 更新設置頁面的 Google 區塊
     */
    updateSettingsSection(isSignedIn) {
        const settingsPage = document.getElementById('page-settings');
        if (!settingsPage) return;

        let googleSection = settingsPage.querySelector('.google-integration-section');
        if (!googleSection) {
            // 創建 Google 整合區塊
            googleSection = document.createElement('div');
            googleSection.className = 'settings-section google-integration-section';
            settingsPage.appendChild(googleSection);
        }

        const user = isSignedIn ? this.googleService.getCurrentUser() : null;
        
        googleSection.innerHTML = `
            <h3 class="settings-section-title">🔗 Google 整合</h3>
            
            ${!this.isInitialized ? `
                <div class="google-status">
                    <p>設置 Google Sheets 同步，將資產數據備份到雲端</p>
                    <button class="btn btn-primary" data-action="google-setup">
                        ⚙️ 設置 Google API
                    </button>
                </div>
            ` : ''}
            
            ${this.isInitialized ? `
                <div class="google-status">
                    ${isSignedIn ? `
                        <div class="google-user-info">
                            <img src="${user.imageUrl}" alt="${user.name}" class="google-avatar">
                            <div class="google-user-details">
                                <div class="google-user-name">${user.name}</div>
                                <div class="google-user-email">${user.email}</div>
                            </div>
                            <button class="btn btn-secondary" data-action="google-signout">登出</button>
                        </div>
                        
                        <div class="google-actions">
                            <button class="btn btn-primary" data-action="google-sync-to-sheets">
                                ⬆️ 同步到 Google Sheets
                            </button>
                            <button class="btn btn-secondary" data-action="google-sync-from-sheets">
                                ⬇️ 從 Google Sheets 載入
                            </button>
                            <button class="btn btn-secondary" data-action="google-create-sheet">
                                📊 創建新表格
                            </button>
                        </div>
                        
                        ${this.googleService.spreadsheetId ? `
                            <div class="google-sheet-link">
                                <a href="https://docs.google.com/spreadsheets/d/${this.googleService.spreadsheetId}/edit" 
                                   target="_blank" class="btn btn-secondary">
                                    🔗 打開 Google Sheets
                                </a>
                            </div>
                        ` : ''}
                    ` : `
                        <p>請登入 Google 帳戶以使用 Sheets 同步功能</p>
                        <button class="btn btn-primary" data-action="google-signin">
                            🔑 登入 Google
                        </button>
                        <button class="btn btn-secondary" data-action="google-setup">
                            ⚙️ 重新設置
                        </button>
                    `}
                </div>
            ` : ''}
        `;
    }

    /**
     * 更新 FAB 菜單
     */
    updateFabMenu(isSignedIn) {
        // 如果已登入 Google，在 FAB 菜單中添加快速同步選項
        const fabMenu = document.querySelector('.fab-menu');
        if (!fabMenu || !isSignedIn) return;

        // 檢查是否已有 Google 同步按鈕
        if (fabMenu.querySelector('[data-action="google-sync-to-sheets"]')) return;

        // 添加 Google 同步按鈕
        const syncButton = document.createElement('div');
        syncButton.className = 'fab-menu-item';
        syncButton.setAttribute('data-action', 'google-sync-to-sheets');
        syncButton.innerHTML = `
            <span class="fab-menu-icon">☁️</span>
            <span class="fab-menu-label">同步到雲端</span>
        `;

        fabMenu.insertBefore(syncButton, fabMenu.firstChild);
    }

    /**
     * 顯示提示訊息
     */
    showToast(message, type = 'info') {
        // 使用現有的 toast 系統
        if (window.showToast) {
            window.showToast(message, type);
        } else {
            alert(message);
        }
    }
}

// 初始化 Google 整合 UI
document.addEventListener('DOMContentLoaded', () => {
    window.googleIntegrationUI = new GoogleIntegrationUI();
});

export default GoogleIntegrationUI;