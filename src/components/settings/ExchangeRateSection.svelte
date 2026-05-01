<!--
  ExchangeRateSection.svelte — 匯率設定區塊

  提供 USD/TWD 匯率輸入欄位，預設值 31.5。
  輸入非正數時顯示錯誤訊息。
  儲存後更新 exchangeRate store 並顯示 Toast 通知。
-->
<script>
  import { exchangeRate } from '$lib/stores/exchangeRate.js';
  import { validateExchangeRate } from '$lib/utils/calculator.js';
  import { showToast } from '$lib/stores/toast.js';
  import { t } from '$lib/services/i18n.js';

  /** 匯率輸入值（字串，綁定至 input） */
  let rateInput = '';

  /** 錯誤訊息 */
  let error = '';

  /** 訂閱 store 取得當前匯率作為初始值 */
  $: rateInput = String($exchangeRate);

  /**
   * 儲存匯率：驗證後更新 store 並顯示 Toast。
   */
  function handleSave() {
    error = '';
    const rate = parseFloat(rateInput);

    if (!validateExchangeRate(rate)) {
      error = t('validation.ratePositive');
      return;
    }

    exchangeRate.setExchangeRate(rate);
    showToast(t('toast.rateUpdated'), 'success');
  }
</script>

<section class="settings-section">
  <h2 class="settings-section-title">{t('settings.exchangeRate')}</h2>
  <p style="font-size: var(--font-size-sm); color: var(--text-secondary); margin-bottom: var(--spacing-md);">
    {t('settings.currentRate')}：<strong style="color: var(--text-primary);">{t('settings.rateFormat', { rate: $exchangeRate })}</strong>
  </p>
  <div class="settings-row">
    <input
      class="form-input"
      type="number"
      bind:value={rateInput}
      min="0.01"
      step="0.01"
      aria-label="USD/TWD"
      placeholder={t('settings.ratePlaceholder')}
    />
    <button class="btn btn-primary" on:click={handleSave}>
      {t('common.save')}
    </button>
  </div>
  {#if error}
    <span class="form-error" style="display: block; margin-top: var(--spacing-xs);">{error}</span>
  {/if}
</section>
