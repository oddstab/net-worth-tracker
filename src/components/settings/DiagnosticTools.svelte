<!--
  DiagnosticTools.svelte — 診斷工具區塊

  提供「清除快取」與「手動更新股價」按鈕。
  更新進行中按鈕停用並顯示「更新中...」。
-->
<script>
  import { clearStockCache } from '$lib/services/searchService.js';
  import { fetchAllPrices } from '$lib/price/priceFetcher.js';
  import { assets } from '$lib/stores/assets.js';
  import { showToast } from '$lib/stores/toast.js';
  import { t } from '$lib/services/i18n.js';
  import Icon from '../Icon.svelte';

  /** 是否正在更新股價 */
  let isRefreshing = false;

  /**
   * 清除股價快取並顯示 Toast。
   */
  function handleClearCache() {
    try {
      clearStockCache();
      showToast(t('toast.cacheCleared'), 'success');
    } catch {
      showToast(t('toast.cacheClearFailed'), 'error');
    }
  }

  /**
   * 手動觸發一次價格更新。
   * 更新期間按鈕停用並顯示「更新中...」。
   */
  async function handleManualRefresh() {
    if (isRefreshing) return;
    isRefreshing = true;

    try {
      let currentAssets;
      assets.subscribe(v => { currentAssets = v; })();

      if (!currentAssets || currentAssets.length === 0) {
        showToast(t('toast.priceUpdateComplete'), 'success');
        return;
      }

      const updatedAssets = await fetchAllPrices(currentAssets);

      /* 計算實際更新了幾個資產 */
      let updatedCount = 0;
      for (let i = 0; i < currentAssets.length; i++) {
        if (updatedAssets[i].pricePerUnit !== currentAssets[i].pricePerUnit) {
          updatedCount++;
        }
      }

      if (updatedCount > 0) {
        assets.replaceAll(updatedAssets);
        showToast(t('toast.priceUpdated', { count: updatedCount }), 'success');
      } else {
        showToast(t('toast.priceUpdateComplete'), 'success');
      }
    } catch {
      showToast(t('toast.priceUpdateFailed'), 'error');
    } finally {
      isRefreshing = false;
    }
  }
</script>

<section class="settings-section">
  <h2 class="settings-section-title">{t('settings.diagnostics')}</h2>
  <div style="display: flex; flex-direction: column; gap: var(--spacing-md);">
    <!-- 清除快取 -->
    <div>
      <button class="btn btn-warning" style="width: 100%;" on:click={handleClearCache}>
        <Icon name="trash" size={16}/> {t('settings.clearCache')}
      </button>
      <p style="font-size: var(--font-size-xs); color: var(--text-muted); margin-top: var(--spacing-xs);">
        {t('settings.clearCacheDesc')}
      </p>
    </div>

    <!-- 手動更新股價 -->
    <div>
      <button
        class="btn btn-success"
        style="width: 100%;"
        on:click={handleManualRefresh}
        disabled={isRefreshing}
      >
        <Icon name="refresh" size={16}/> {isRefreshing ? t('settings.refreshing') : t('settings.manualRefresh')}
      </button>
      <p style="font-size: var(--font-size-xs); color: var(--text-muted); margin-top: var(--spacing-xs);">
        {t('settings.manualRefreshDesc')}
      </p>
    </div>
  </div>
</section>
