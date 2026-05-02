<!--
  GoogleIntegration.svelte — Google Sheets 整合設定區塊

  顯示 Google 登入狀態、使用者資訊與操作按鈕。
  支援：
  - 設定 Google API 金鑰與 OAuth 客戶端 ID
  - Google 帳戶登入/登出
  - 同步到 Google Sheets / 從 Google Sheets 載入 / 創建新表格

  所有文字使用 t() 翻譯函式。
-->
<script>
  import { t } from '$lib/services/i18n.js';
  import { showToast } from '$lib/stores/toast.js';
  import {
    isSignedIn,
    isInitialized,
    currentUser,
    setCredentials,
    loadCredentials,
    getApiKey,
    getClientId,
    getSpreadsheetId,
    saveSpreadsheetId,
    initialize,
    signIn,
    signOut,
    createSpreadsheet,
    syncAssetsToSheets,
    loadAssetsFromSheets,
    recordNetWorthHistory,
  } from '$lib/services/googleSheets.js';
  import { assets } from '$lib/stores/assets.js';
  import { totals } from '$lib/stores/derived.js';
  import { onMount, onDestroy } from 'svelte';
  import { lockScroll, unlockScroll } from '$lib/utils/scrollLock.js';
  import Icon from '../Icon.svelte';

  /** 是否顯示設定 Modal */
  let showSetup = false;

  // ── Modal 開啟時鎖定背景滾動 ──
  $: if (showSetup) {
    if (typeof document !== 'undefined') lockScroll();
  } else {
    if (typeof document !== 'undefined') unlockScroll();
  }
  onDestroy(() => {
    if (typeof document !== 'undefined') unlockScroll();
  });

  /** 設定表單欄位 */
  let apiKeyInput = '';
  let clientIdInput = '';
  let spreadsheetIdInput = '';

  /** 操作進行中狀態 */
  let syncing = false;
  let loading = false;
  let creating = false;

  onMount(() => {
    /* 載入已儲存的憑證 */
    loadCredentials();
    apiKeyInput = getApiKey();
    clientIdInput = getClientId();
    spreadsheetIdInput = getSpreadsheetId() || '';

    /* 若已有憑證，自動初始化 */
    if (apiKeyInput && clientIdInput) {
      initialize();
    }
  });

  /**
   * 開啟設定 Modal
   */
  function openSetup() {
    apiKeyInput = getApiKey();
    clientIdInput = getClientId();
    spreadsheetIdInput = getSpreadsheetId() || '';
    showSetup = true;
  }

  /**
   * 關閉設定 Modal
   */
  function closeSetup() {
    showSetup = false;
  }

  /**
   * 保存 Google API 設定並初始化
   */
  async function handleSaveSetup() {
    if (!apiKeyInput.trim() || !clientIdInput.trim()) {
      showToast(t('toast.googleApiNotReady'), 'error');
      return;
    }

    setCredentials(clientIdInput.trim(), apiKeyInput.trim());

    if (spreadsheetIdInput.trim()) {
      saveSpreadsheetId(spreadsheetIdInput.trim());
    }

    const success = await initialize();
    if (success) {
      showSetup = false;
      showToast(t('settings.googleSetupSaved'), 'success');
    } else {
      showToast(t('toast.googleApiNotReady'), 'error');
    }
  }

  /**
   * 處理 Google 登入
   */
  async function handleSignIn() {
    if (!$isInitialized) {
      showToast(t('toast.googleApiNotReady'), 'error');
      openSetup();
      return;
    }

    try {
      await signIn();
    } catch {
      showToast(t('toast.loginFailed'), 'error');
    }
  }

  /**
   * 處理 Google 登出
   */
  async function handleSignOut() {
    await signOut();
  }

  /**
   * 同步資產到 Google Sheets
   */
  async function handleSyncToSheets() {
    if (!$isSignedIn) return;
    syncing = true;

    try {
      const currentAssets = $assets;
      if (currentAssets.length === 0) {
        showToast(t('settings.googleNoAssets'), 'error');
        syncing = false;
        return;
      }

      await syncAssetsToSheets(currentAssets);

      /* 同時記錄淨資產歷史 */
      const currentTotals = $totals;
      if (currentTotals) {
        await recordNetWorthHistory(
          currentTotals.totalAssets,
          currentTotals.totalLiabilities,
          currentTotals.netWorth,
          '自動同步'
        );
      }

      showToast(t('settings.syncToSheets') + ' ✓', 'success');
    } catch {
      showToast(t('toast.syncFailed'), 'error');
    } finally {
      syncing = false;
    }
  }

  /**
   * 從 Google Sheets 載入資產
   */
  async function handleLoadFromSheets() {
    if (!$isSignedIn) return;
    loading = true;

    try {
      const sheetAssets = await loadAssetsFromSheets();

      if (sheetAssets.length === 0) {
        showToast(t('settings.googleNoSheetData'), 'error');
        loading = false;
        return;
      }

      /* 覆蓋本地資產 */
      assets.replaceAll(sheetAssets);
      showToast(t('settings.loadFromSheets') + ' ✓', 'success');
    } catch {
      showToast(t('toast.syncFailed'), 'error');
    } finally {
      loading = false;
    }
  }

  /**
   * 創建新的 Google Sheets
   */
  async function handleCreateSheet() {
    if (!$isSignedIn) return;
    creating = true;

    try {
      const result = await createSpreadsheet('Net Worth Tracker');
      showToast(t('settings.createSheet') + ' ✓', 'success');

      /* 開啟新建的 Google Sheets */
      if (result.url) {
        window.open(result.url, '_blank');
      }
    } catch {
      showToast(t('toast.syncFailed'), 'error');
    } finally {
      creating = false;
    }
  }
</script>

<svelte:window on:keydown={(e) => { if (e.key === 'Escape' && showSetup) { closeSetup(); } }} />

<section class="settings-section">
  <h2 class="settings-section-title">{t('settings.googleIntegration')}</h2>

  {#if !$isInitialized}
    <!-- 尚未設定 Google API -->
    <p class="google-desc">
      {t('settings.googleSetupDesc')}
    </p>
    <button class="btn btn-primary google-btn" on:click={openSetup}>
      <Icon name="settings" size={16}/> {t('settings.googleSetup')}
    </button>
  {:else if !$isSignedIn}
    <!-- 已初始化但未登入 -->
    <p class="google-desc">
      請登入 Google 帳戶以使用 Sheets 同步功能
    </p>
    <div class="google-actions">
      <button class="btn btn-primary google-btn" on:click={handleSignIn}>
        <Icon name="key" size={16}/> {t('settings.googleLogin')}
      </button>
      <button class="btn btn-secondary google-btn" on:click={openSetup}>
        <Icon name="settings" size={16}/> 重新設置
      </button>
    </div>
  {:else}
    <!-- 已登入 -->
    {#if $currentUser}
      <div class="google-user-info">
        <img
          src={$currentUser.imageUrl}
          alt={$currentUser.name}
          class="google-avatar"
        />
        <div class="google-user-details">
          <div class="google-user-name">{$currentUser.name}</div>
          <div class="google-user-email">{$currentUser.email}</div>
        </div>
        <button class="btn btn-secondary btn-sm" on:click={handleSignOut}>
          {t('settings.googleLogout')}
        </button>
      </div>
    {/if}

    <div class="google-actions">
      <button
        class="btn btn-primary google-btn"
        on:click={handleSyncToSheets}
        disabled={syncing}
      >
        <Icon name="upload" size={16}/> {syncing ? t('settings.refreshing') : t('settings.syncToSheets')}
      </button>
      <button
        class="btn btn-secondary google-btn"
        on:click={handleLoadFromSheets}
        disabled={loading}
      >
        <Icon name="download" size={16}/> {loading ? t('settings.refreshing') : t('settings.loadFromSheets')}
      </button>
      <button
        class="btn btn-secondary google-btn"
        on:click={handleCreateSheet}
        disabled={creating}
      >
        📊 {creating ? t('settings.refreshing') : t('settings.createSheet')}
      </button>
    </div>

    {#if getSpreadsheetId()}
      <div class="google-sheet-link">
        <a
          href="https://docs.google.com/spreadsheets/d/{getSpreadsheetId()}/edit"
          target="_blank"
          rel="noopener noreferrer"
          class="btn btn-secondary google-btn"
        >
          🔗 打開 Google Sheets
        </a>
      </div>
    {/if}
  {/if}
</section>

<!-- 設定 Modal -->
{#if showSetup}
  <!-- 背景遮罩（禁止點擊外部關閉） -->
  <div class="modal-overlay">
    <div class="modal google-setup-modal">
      <div class="modal-header">
        <h2 class="modal-title">Google Sheets 整合設置</h2>
        <button class="modal-close" on:click={closeSetup}><Icon name="x" size={18}/></button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label" for="google-api-key">
            Google API 金鑰 <span class="required">*</span>
          </label>
          <input
            type="text"
            class="form-input"
            id="google-api-key"
            placeholder="請輸入 Google API Key"
            bind:value={apiKeyInput}
          />
          <div class="form-hint">
            需要在
            <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer">
              Google Cloud Console
            </a>
            啟用 Google Sheets API 並創建 API 金鑰
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="google-client-id">
            OAuth 客戶端 ID <span class="required">*</span>
          </label>
          <input
            type="text"
            class="form-input"
            id="google-client-id"
            placeholder="請輸入 OAuth 2.0 客戶端 ID"
            bind:value={clientIdInput}
          />
          <div class="form-hint">
            需要創建 OAuth 2.0 客戶端 ID，應用程式類型選擇「網頁應用程式」
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="google-spreadsheet-id">
            Spreadsheet ID（可選）
          </label>
          <input
            type="text"
            class="form-input"
            id="google-spreadsheet-id"
            placeholder="現有的 Google Sheets ID"
            bind:value={spreadsheetIdInput}
          />
          <div class="form-hint">
            如果您已有 Google Sheets，可以輸入 ID。留空將創建新的表格。
          </div>
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary" on:click={closeSetup}>
          {t('common.cancel')}
        </button>
        <button class="btn btn-primary" on:click={handleSaveSetup}>
          {t('common.save')}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  /* Google 整合區塊樣式 */
  .google-desc {
    font-size: var(--font-size-sm, 0.875rem);
    color: var(--text-secondary);
    margin-bottom: 12px;
  }

  .google-user-info {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background: var(--bg-card);
    border-radius: 8px;
    margin-bottom: 12px;
  }

  .google-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    object-fit: cover;
  }

  .google-user-details {
    flex: 1;
    min-width: 0;
  }

  .google-user-name {
    font-weight: 600;
    font-size: var(--font-size-sm, 0.875rem);
    color: var(--text-primary);
  }

  .google-user-email {
    font-size: var(--font-size-xs, 0.75rem);
    color: var(--text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .google-actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 8px;
  }

  .google-btn {
    width: 100%;
    min-height: 44px;
    text-align: center;
  }

  .google-sheet-link {
    margin-top: 12px;
  }

  .google-sheet-link a {
    text-decoration: none;
    display: block;
    text-align: center;
  }

  /* 設定 Modal 樣式 */
  .google-setup-modal {
    max-width: 500px;
    width: 90%;
  }

  .form-group {
    margin-bottom: 16px;
  }

  .form-label {
    display: block;
    font-size: var(--font-size-sm, 0.875rem);
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 6px;
  }

  .form-input {
    width: 100%;
    padding: 10px 12px;
    font-size: var(--font-size-sm, 0.875rem);
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    color: var(--text-primary);
    box-sizing: border-box;
  }

  .form-input:focus {
    outline: none;
    border-color: var(--accent-color);
  }

  .form-hint {
    font-size: var(--font-size-xs, 0.75rem);
    color: var(--text-secondary);
    margin-top: 4px;
  }

  .form-hint a {
    color: var(--accent-color);
  }

  .required {
    color: var(--color-negative);
  }

  .btn-sm {
    padding: 6px 12px;
    font-size: var(--font-size-xs, 0.75rem);
    min-height: 32px;
  }
</style>
