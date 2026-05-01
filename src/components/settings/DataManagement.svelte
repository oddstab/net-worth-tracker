<!--
  DataManagement.svelte — 資料匯出/匯入區塊

  匯出：將所有資料序列化為 JSON 並觸發下載，檔名 net-worth-tracker-YYYY-MM-DD.json。
  匯入：選擇 JSON 檔案，驗證並載入，覆蓋現有資料。
  匯入成功顯示 Toast 並更新所有 store；匯入失敗顯示具體錯誤訊息。
-->
<script>
  import { exportData, importData } from '$lib/services/storage.js';
  import { assets } from '$lib/stores/assets.js';
  import { liabilities } from '$lib/stores/liabilities.js';
  import { exchangeRate } from '$lib/stores/exchangeRate.js';
  import { snapshots } from '$lib/stores/snapshots.js';
  import { showToast } from '$lib/stores/toast.js';
  import { t } from '$lib/services/i18n.js';
  import Icon from '../Icon.svelte';

  /** 匯入錯誤訊息 */
  let importError = '';

  /** 隱藏的 file input 參考 */
  let fileInput;

  /**
   * 匯出資料：序列化為 JSON 並觸發瀏覽器下載。
   */
  function handleExport() {
    const jsonString = exportData();
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `net-worth-tracker-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast(t('toast.dataExported'), 'success');
  }

  /**
   * 觸發隱藏的 file input 點擊。
   */
  function handleImportClick() {
    fileInput.click();
  }

  /**
   * 讀取選擇的 JSON 檔案並匯入。
   * @param {Event} event
   */
  function handleFileChange(event) {
    const file = event.target.files[0];
    if (!file) return;

    importError = '';

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = importData(e.target.result);

        /* 更新所有 store（replaceAll 會同時持久化至 localStorage） */
        assets.replaceAll(parsed.assets);
        liabilities.replaceAll(parsed.liabilities);
        exchangeRate.setExchangeRate(parsed.exchangeRate);
        snapshots.replaceAll(parsed.snapshots);

        showToast(t('toast.dataImported'), 'success');
      } catch (err) {
        importError = err.message || t('toast.importFailed');
        showToast(t('toast.importFailed'), 'error');
      }
    };
    reader.readAsText(file);

    /* 清除 file input，允許重複選同一檔案 */
    event.target.value = '';
  }
</script>

<section class="settings-section">
  <h2 class="settings-section-title">{t('settings.dataManagement')}</h2>
  <div style="display: flex; flex-direction: column; gap: var(--spacing-md);">
    <!-- 匯出 -->
    <div>
      <button class="btn btn-secondary" style="width: 100%;" on:click={handleExport}>
        <Icon name="download" size={16}/> {t('settings.exportData')}
      </button>
      <p style="font-size: var(--font-size-xs); color: var(--text-muted); margin-top: var(--spacing-xs);">
        {t('settings.exportDesc')}
      </p>
    </div>

    <!-- 匯入 -->
    <div>
      <button class="btn btn-secondary" style="width: 100%;" on:click={handleImportClick}>
        <Icon name="upload" size={16}/> {t('settings.importData')}
      </button>
      <input
        type="file"
        accept=".json"
        style="display: none;"
        bind:this={fileInput}
        on:change={handleFileChange}
      />
      <p style="font-size: var(--font-size-xs); color: var(--text-muted); margin-top: var(--spacing-xs);">
        {t('settings.importDesc')}
      </p>
      {#if importError}
        <span class="form-error" style="display: block; margin-top: var(--spacing-xs);">{importError}</span>
      {/if}
    </div>
  </div>
</section>
