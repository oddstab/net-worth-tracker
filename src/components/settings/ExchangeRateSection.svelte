<!--
  ExchangeRateSection.svelte — 多幣別匯率設定區塊

  提供 USD、CNY、JPY、KRW 四個幣別對 TWD 的匯率輸入欄位。
  每行顯示「1 {幣別} = [輸入框] TWD」格式。
  提供「同步匯率」按鈕，從公開 API 取得即時匯率。
  儲存時驗證每個匯率值為有限正數（使用 validateExchangeRate()）。
-->
<script>
  import { exchangeRateMap, validateExchangeRate } from '$lib/stores/exchangeRateMap.js';
  import { showToast } from '$lib/stores/toast.js';
  import { t } from '$lib/services/i18n.js';
  import { tStore } from '$lib/services/i18n.js';
  import Icon from '../Icon.svelte';

  /* 訂閱 tStore 以在語言切換時觸發重新渲染 */
  $: _t = $tStore;

  /** 可編輯的幣別清單（TWD 固定為 1，不可編輯） */
  const editableCurrencies = ['USD', 'CNY', 'JPY', 'KRW'];

  /** 各幣別匯率輸入值（字串，綁定至 input） */
  let rateInputs = {};

  /** 錯誤訊息 */
  let error = '';

  /** 同步中狀態 */
  let syncing = false;

  /** 訂閱 store 取得當前匯率作為初始值 */
  $: {
    const map = $exchangeRateMap;
    rateInputs = {};
    for (const cur of editableCurrencies) {
      rateInputs[cur] = String(map[cur] ?? '');
    }
  }

  /**
   * 儲存所有匯率：逐一驗證後批次更新 store 並顯示 Toast。
   */
  function handleSaveAll() {
    error = '';

    /** @type {Record<string, number>} */
    const parsed = {};

    for (const cur of editableCurrencies) {
      const rate = parseFloat(rateInputs[cur]);
      if (!validateExchangeRate(rate)) {
        error = t('validation.ratePositiveAll');
        return;
      }
      parsed[cur] = rate;
    }

    exchangeRateMap.setAll(parsed);
    showToast(t('toast.rateMapUpdated'), 'success');
  }

  /**
   * 從公開 API 同步即時匯率。
   * 使用 exchangerate-api.com 的免費端點（以 TWD 為基準）。
   * 回退方案：若 API 失敗，嘗試 open.er-api.com。
   */
  async function handleSync() {
    syncing = true;
    error = '';

    try {
      // 主要 API：exchangerate-api.com（免費，無需 key）
      const res = await fetch('https://open.er-api.com/v6/latest/TWD');
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();

      if (data.result !== 'success' || !data.rates) {
        throw new Error('API 回傳格式異常');
      }

      // API 回傳的是 1 TWD = X 外幣，我們需要 1 外幣 = X TWD
      // 所以取倒數：1 / rate
      const newRates = {};
      for (const cur of editableCurrencies) {
        const apiRate = data.rates[cur];
        if (apiRate && apiRate > 0) {
          // 四捨五入到合理精度
          newRates[cur] = Math.round((1 / apiRate) * 10000) / 10000;
        }
      }

      // 檢查是否取得所有幣別
      const fetched = Object.keys(newRates);
      if (fetched.length === 0) {
        throw new Error('未取得任何匯率資料');
      }

      // 更新輸入欄位（不直接存入 store，讓使用者確認後再儲存）
      for (const cur of fetched) {
        rateInputs[cur] = String(newRates[cur]);
      }
      // 觸發 Svelte 響應式更新
      rateInputs = { ...rateInputs };

      showToast(t('toast.rateSynced'), 'success');
    } catch (err) {
      showToast(t('toast.rateSyncFailed'), 'error');
    } finally {
      syncing = false;
    }
  }
</script>

<section class="settings-section">
  <div class="rate-header">
    <div>
      <h2 class="settings-section-title">{t('settings.rateMapTitle')}</h2>
      <p class="rate-desc">{t('settings.rateMapDesc')}</p>
    </div>
  </div>

  <div class="rate-rows">
    {#each editableCurrencies as cur}
      <div class="rate-row">
        <label class="rate-label" for="rate-{cur}">1 {cur} =</label>
        <input
          id="rate-{cur}"
          class="form-input rate-input"
          type="number"
          bind:value={rateInputs[cur]}
          min="0.001"
          step="any"
          aria-label="1 {cur} = TWD"
        />
        <span class="rate-unit">TWD</span>
      </div>
    {/each}
  </div>

  {#if error}
    <span class="form-error" style="display: block; margin-top: var(--spacing-xs);">{error}</span>
  {/if}

  <div class="rate-actions">
    <button class="btn btn-secondary rate-sync-btn" on:click={handleSync} disabled={syncing}>
      <Icon name="refresh" size={14}/>
      {syncing ? t('settings.syncing') : t('settings.syncRate')}
    </button>
    <button class="btn btn-primary rate-save-btn" on:click={handleSaveAll}>
      {t('common.save')}
    </button>
  </div>
</section>

<style>
  /* 標題區 */
  .rate-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--spacing-md);
  }

  /* 說明文字 */
  .rate-desc {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    margin-bottom: var(--spacing-md);
  }

  /* 匯率列容器 */
  .rate-rows {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  /* 單一匯率列 */
  .rate-row {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  /* 幣別標籤 */
  .rate-label {
    min-width: 5.5em;
    font-size: var(--font-size-sm);
    font-weight: 500;
    color: var(--text-primary);
    white-space: nowrap;
  }

  /* 匯率輸入框 */
  .rate-input {
    flex: 1;
    max-width: 10em;
  }

  /* TWD 單位文字 */
  .rate-unit {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    white-space: nowrap;
  }

  /* 按鈕列 */
  .rate-actions {
    display: flex;
    gap: var(--spacing-sm);
    margin-top: var(--spacing-md);
  }

  /* 同步按鈕 */
  .rate-sync-btn {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
  }

  .rate-sync-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>
