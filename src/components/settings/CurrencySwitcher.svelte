<!--
  CurrencySwitcher.svelte — 顯示貨幣切換元件

  以按鈕群組形式呈現五個貨幣選項（TWD、USD、CNY、JPY、KRW），
  選中項以 accent 色高亮。點擊按鈕時更新 displayCurrency store 並顯示 Toast 通知。
-->
<script>
  import {
    displayCurrency,
    SUPPORTED_CURRENCIES,
  } from '$lib/stores/displayCurrency.js';
  import { showToast } from '$lib/stores/toast.js';
  import { t } from '$lib/services/i18n.js';
  import { tStore } from '$lib/services/i18n.js';

  /* 訂閱 tStore 以在語言切換時觸發重新渲染 */
  $: _t = $tStore;

  /**
   * 選擇顯示貨幣：更新 store 並顯示 Toast 通知。
   * @param {string} cur — 貨幣代碼
   */
  function selectCurrency(cur) {
    if (cur === $displayCurrency) return;
    displayCurrency.set(cur);
    showToast(t('toast.currencySwitched', { currency: cur }), 'success');
  }
</script>

<section class="settings-section">
  <h2 class="settings-section-title">{t('settings.displayCurrency')}</h2>
  <p class="currency-desc">{t('settings.displayCurrencyDesc')}</p>
  <div class="currency-btn-group" role="radiogroup" aria-label={t('settings.displayCurrency')}>
    {#each SUPPORTED_CURRENCIES as cur}
      <button
        class="currency-btn"
        class:active={$displayCurrency === cur}
        role="radio"
        aria-checked={$displayCurrency === cur}
        on:click={() => selectCurrency(cur)}
      >
        {cur} {t('currency.' + cur)}
      </button>
    {/each}
  </div>
</section>

<style>
  /* 說明文字 */
  .currency-desc {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    margin-bottom: var(--spacing-md);
  }

  /* 按鈕群組容器 */
  .currency-btn-group {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-sm);
  }

  /* 單一貨幣按鈕 */
  .currency-btn {
    min-height: var(--touch-target);
    padding: var(--spacing-sm) var(--spacing-md);
    background-color: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-md);
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .currency-btn:hover {
    background-color: var(--bg-hover);
    color: var(--text-primary);
    border-color: var(--accent-color);
  }

  .currency-btn:active {
    transform: scale(0.95);
  }

  /* 選中狀態：accent 色高亮 */
  .currency-btn.active {
    background-color: var(--accent-color);
    border-color: var(--accent-color);
    color: #fff;
  }

  .currency-btn:focus-visible {
    outline: 2px solid var(--accent-color);
    outline-offset: 2px;
  }
</style>
