<!--
  AssetList.svelte — 資產清單

  按分類分組顯示（投資資產），每組顯示小計金額。
  相同股票代號的多筆持股整合顯示。
  所有文字使用 t() 翻譯函式。
-->
<script>
  import { createEventDispatcher } from 'svelte';
  import { t } from '$lib/services/i18n.js';
  import { tStore } from '$lib/services/i18n.js';
  import { formatCurrency } from '$lib/services/localeFormatter.js';
  import { calculateAssetTWD } from '$lib/utils/calculator.js';
  import AssetItem from './AssetItem.svelte';

  const dispatch = createEventDispatcher();

  /** 資產陣列 */
  export let assets = [];

  /** USD/TWD 匯率 */
  export let exchangeRate = 31.5;

  /* 訂閱 tStore 以在語言切換時觸發重新渲染 */
  $: _t = $tStore;

  /**
   * 整合相同股票代號的資產。
   * 優先使用 symbol 作為整合 key，無 symbol 時使用標準化名稱。
   *
   * @param {Array} assetList — 原始資產陣列
   * @param {number} rate — USD/TWD 匯率
   * @returns {Array} 整合後的資產陣列（含 holdings 陣列）
   */
  function consolidateAssets(assetList, rate) {
    const consolidated = new Map();

    for (const asset of assetList) {
      // 優先使用 symbol 作為整合 key
      const key = asset.symbol
        ? asset.symbol.toUpperCase()
        : asset.name.replace(/\s+/g, '').toLowerCase();

      if (consolidated.has(key)) {
        const existing = consolidated.get(key);
        const totalQuantity = existing.quantity + asset.quantity;

        // 加權平均成本
        const existingCost = existing.avgCost || existing.pricePerUnit;
        const currentCost = asset.avgCost || asset.pricePerUnit;
        const weightedAvgCost = totalQuantity > 0
          ? (existingCost * existing.quantity + currentCost * asset.quantity) / totalQuantity
          : 0;

        existing.quantity = totalQuantity;
        existing.avgCost = weightedAvgCost;
        // pricePerUnit（市場價格）取最新更新的那筆
        if (asset.lastPriceUpdate && (!existing.lastPriceUpdate || asset.lastPriceUpdate > existing.lastPriceUpdate)) {
          existing.pricePerUnit = asset.pricePerUnit;
          existing.lastPriceUpdate = asset.lastPriceUpdate;
        }
        existing.holdings.push(asset);

        // 確保使用有 symbol 的資產作為主要顯示
        if (asset.symbol && !existing.symbol) {
          existing.symbol = asset.symbol;
        }
      } else {
        consolidated.set(key, {
          ...asset,
          avgCost: asset.avgCost || asset.pricePerUnit,
          holdings: [asset],
        });
      }
    }

    return Array.from(consolidated.values());
  }

  /** 投資資產 */
  $: investmentAssets = assets.filter(a => a.category === 'investment');

  /** 流動資產 */
  $: liquidAssets = assets.filter(a => a.category === 'liquid');

  /** 整合後的投資資產 */
  $: consolidatedInvestment = consolidateAssets(investmentAssets, exchangeRate);

  /** 整合後的流動資產 */
  $: consolidatedLiquid = consolidateAssets(liquidAssets, exchangeRate);

  /** 投資資產小計 */
  $: investmentSubtotal = investmentAssets.reduce(
    (sum, a) => sum + calculateAssetTWD(a.quantity, a.pricePerUnit, a.currency, exchangeRate), 0
  );

  /** 流動資產小計 */
  $: liquidSubtotal = liquidAssets.reduce(
    (sum, a) => sum + calculateAssetTWD(a.quantity, a.pricePerUnit, a.currency, exchangeRate), 0
  );

  /** 編輯資產 */
  function handleEdit(e) {
    dispatch('editAsset', e.detail);
  }

  /** 新增相同股票 */
  function handleAddSame(e) {
    dispatch('addSameStock', e.detail);
  }

  /** 質押 */
  function handlePledge(e) {
    dispatch('pledge', e.detail);
  }
</script>

{#if consolidatedInvestment.length > 0}
  <div class="asset-category">
    <div class="category-header">
      <h3 class="category-title">{t('asset.investment')}</h3>
      <span class="category-subtotal">{formatCurrency(investmentSubtotal)}</span>
    </div>
    <div class="category-items">
      {#each consolidatedInvestment as asset (asset.holdings[0].id)}
        <AssetItem
          {asset}
          {exchangeRate}
          on:edit={handleEdit}
          on:addSame={handleAddSame}
          on:pledge={handlePledge}
        />
      {/each}
    </div>
  </div>
{/if}

{#if consolidatedLiquid.length > 0}
  <div class="asset-category">
    <div class="category-header">
      <h3 class="category-title">{t('asset.liquid')}</h3>
      <span class="category-subtotal">{formatCurrency(liquidSubtotal)}</span>
    </div>
    <div class="category-items">
      {#each consolidatedLiquid as asset (asset.holdings[0].id)}
        <AssetItem
          {asset}
          {exchangeRate}
          on:edit={handleEdit}
          on:addSame={handleAddSame}
          on:pledge={handlePledge}
        />
      {/each}
    </div>
  </div>
{/if}
