<!--
  AssetItem.svelte — 單一資產項目

  顯示資產名稱、代號、數量、每單位價格、TWD 值。
  相同股票代號的多筆持股整合顯示，提供展開/收合明細。
  刪除時顯示自訂確認對話框。
  所有文字使用 t() 翻譯函式。
-->
<script>
  import { createEventDispatcher } from 'svelte';
  import { t } from '$lib/services/i18n.js';
  import { tStore } from '$lib/services/i18n.js';
  import { formatCurrency } from '$lib/services/localeFormatter.js';
  import { calculateAssetTWD } from '$lib/utils/calculator.js';
  import { showConfirmDialog } from '$lib/stores/confirmDialog.js';
  import { assets } from '$lib/stores/assets.js';
  import { liabilities as liabilitiesStore } from '$lib/stores/liabilities.js';
  import { tdccStore } from '$lib/stores/tdcc.js';
  import { LEVEL_LABELS } from '$lib/services/tdccService.js';
  import { showToast } from '$lib/stores/toast.js';
  import Icon from '../Icon.svelte';

  const dispatch = createEventDispatcher();

  /** 整合後的資產物件（含 holdings 陣列） */
  export let asset;

  /** USD/TWD 匯率 */
  export let exchangeRate = 31.5;

  /* 訂閱 tStore 以在語言切換時觸發重新渲染 */
  $: _t = $tStore;

  /** 是否為多筆持股 */
  $: isMultiple = asset.holdings && asset.holdings.length > 1;

  /** 持股明細是否展開 */
  let holdingsExpanded = false;

  /** TDCC 表格是否展開 */
  let tdccExpanded = false;

  /** 計算 TWD 值 */
  $: twdValue = calculateAssetTWD(asset.quantity, asset.pricePerUnit, asset.currency, exchangeRate);

  /** 損益 = (市價 - 平均成本) × 數量 */
  $: effectiveAvgCost = asset.avgCost || asset.pricePerUnit;
  $: pnl = (asset.pricePerUnit - effectiveAvgCost) * asset.quantity;
  $: pnlPercent = effectiveAvgCost > 0 ? ((asset.pricePerUnit - effectiveAvgCost) / effectiveAvgCost) * 100 : 0;

  /** 質押資訊 */
  $: pledgeBorrowed = asset.symbol
    ? $liabilitiesStore
        .filter(l => l.category === 'pledge' && l.name && l.name.startsWith(asset.symbol))
        .reduce((sum, l) => sum + (l.amount || 0), 0)
    : 0;
  $: hasPledge = pledgeBorrowed > 0;

  /** 可質押市值：只算整張（1000 股倍數），零股無法抵押 */
  $: pledgeableShares = Math.floor(asset.quantity / 1000) * 1000;
  $: pledgeableMarketValue = calculateAssetTWD(pledgeableShares, asset.pricePerUnit, asset.currency, exchangeRate);

  /** 維持率用可質押市值計算（零股不計入） */
  $: pledgeMaintenanceRate = hasPledge && pledgeableMarketValue > 0
    ? (pledgeableMarketValue / pledgeBorrowed) * 100
    : 0;

  /** 可承受跌幅 = (可質押市值 - 已借 × 1.3) / 可質押市值 × 100 */
  $: pledgeMaxDrop = hasPledge && pledgeableMarketValue > 0
    ? ((pledgeableMarketValue - pledgeBorrowed * 1.3) / pledgeableMarketValue) * 100
    : 0;

  /** 顯示名稱（代號 + 名稱） */
  $: displayName = asset.symbol ? `${asset.symbol} ${asset.name}` : asset.name;

  /** TDCC 排名資料 */
  $: tdccRanking = asset.type === 'tw_stock' && asset.symbol ? $tdccStore.get(asset.symbol) : null;

  /**
   * 計算每一級的「前 X%」（該級及以上的人數累計 / 總人數）。
   * 從最高級（15）往下累加。
   */
  $: tdccTopPercentMap = (() => {
    if (!tdccRanking || !tdccRanking.levels) return new Map();
    const map = new Map();
    const total = tdccRanking.totalHolders;
    if (total <= 0) return map;
    let cumulative = 0;
    // 從最高級往最低級累加
    for (let i = tdccRanking.levels.length - 1; i >= 0; i--) {
      cumulative += tdccRanking.levels[i].holders;
      map.set(tdccRanking.levels[i].level, (cumulative / total) * 100);
    }
    return map;
  })();

  /** 格式化最後更新時間 */
  function formatLastUpdate(ts) {
    if (!ts) return t('asset.manualInput');
    return new Date(ts).toLocaleString('zh-TW');
  }

  /** 格式化價格顯示 */
  function formatPrice(price, cur) {
    return price.toLocaleString('zh-TW', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }) + ' ' + cur;
  }

  /** 切換持股明細展開/收合 */
  function toggleHoldings() {
    holdingsExpanded = !holdingsExpanded;
  }

  /** 編輯資產 */
  function handleEdit(holdingId) {
    dispatch('edit', { id: holdingId });
  }

  /** 刪除資產（顯示確認對話框，有質押時驗證維持率） */
  function handleDelete(holding) {
    const displayName = holding.symbol ? `${holding.symbol} ${holding.name}` : holding.name;
    const sym = holding.symbol || asset.symbol;

    // 檢查是否有質押
    if (sym && pledgeBorrowed > 0) {
      // 計算刪除後的剩餘可質押市值（只算整張）
      const remainingQuantity = asset.quantity - holding.quantity;
      const remainingPledgeableShares = Math.floor(remainingQuantity / 1000) * 1000;
      const remainingValue = calculateAssetTWD(remainingPledgeableShares, asset.pricePerUnit, asset.currency, exchangeRate);
      const rateAfterDelete = remainingValue > 0 ? (remainingValue / pledgeBorrowed) * 100 : 0;

      if (rateAfterDelete < 130) {
        showToast(t('tools.deletePledgeFirst'), 'error');
        return;
      }
    }

    showConfirmDialog(
      t('confirm.deleteTitle'),
      t('confirm.deleteAsset', { name: displayName }),
      () => {
        assets.removeAsset(holding.id);
        showToast(`${displayName} ${t('common.delete')}`, 'success');
      }
    );
  }

  /** 新增相同股票 */
  function handleAddSame() {
    dispatch('addSame', {
      symbol: asset.symbol || '',
      name: asset.name,
      type: asset.type || 'tw_stock',
      category: asset.category || 'investment',
    });
  }

  /** 質押（僅限台股） */
  function handlePledge() {
    dispatch('pledge', {
      symbol: asset.symbol,
      name: asset.name,
      marketValue: twdValue,
      quantity: asset.quantity,
    });
  }
</script>

<div class="asset-item">
  <div class="asset-item-info">
    <div class="asset-item-header">
      <div class="asset-item-name">
        <span class="asset-name">{displayName}</span>
        {#if isMultiple}
          <span class="multiple-badge">{asset.holdings.length}{t('asset.holdingsCount')}</span>
        {/if}
      </div>
      <div class="asset-item-value">{formatCurrency(twdValue)}</div>
    </div>

    <div class="asset-detail-row">
      <span class="asset-label">{t('asset.quantity')}</span>
      <span class="asset-value">{asset.quantity.toLocaleString('zh-TW')}</span>
    </div>
    <div class="asset-detail-row">
      <span class="asset-label">{t('asset.marketPrice')}</span>
      <span class="asset-value">{formatPrice(asset.pricePerUnit, asset.currency)}</span>
    </div>
    <div class="asset-detail-row">
      <span class="asset-label">{t('asset.avgCost')}</span>
      <span class="asset-value">{formatPrice(asset.avgCost || asset.pricePerUnit, asset.currency)}</span>
    </div>
    <div class="asset-detail-row">
      <span class="asset-label">{t('dashboard.pnlLabel')}</span>
      <span class="asset-value" style="color: {pnl > 0 ? 'var(--color-positive)' : pnl < 0 ? 'var(--color-negative)' : 'var(--text-secondary)'}">
        {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)} ({pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%)
      </span>
    </div>
    <div class="asset-detail-row">
      <span class="asset-label">{t('asset.lastUpdate')}</span>
      <span class="asset-value">{formatLastUpdate(asset.lastPriceUpdate)}</span>
    </div>

    <!-- 質押資訊標籤 -->
    {#if hasPledge}
      <div class="asset-pledge-tags">
        <span class="pledge-tag">{t('asset.pledge')} {formatCurrency(pledgeBorrowed)}</span>
        <span class="pledge-tag" style="color: {pledgeMaintenanceRate >= 160 ? 'var(--color-positive)' : pledgeMaintenanceRate >= 140 ? 'var(--color-warning)' : 'var(--color-negative)'}">
          {t('tools.maintenanceRate')} {pledgeMaintenanceRate.toFixed(0)}%
        </span>
        <span class="pledge-tag" style="color: {pledgeMaxDrop < 20 ? 'var(--color-negative)' : pledgeMaxDrop < 30 ? 'var(--color-warning)' : 'var(--color-positive)'}">
          {t('tools.maxDrop')} -{pledgeMaxDrop.toFixed(1)}%
        </span>
      </div>
    {/if}

    <!-- TDCC 集保排名按鈕 + 展開表格 -->
    {#if tdccRanking}
      <div class="asset-tdcc-tag">
        <button
          class="tdcc-badge"
          class:tdcc-top5={tdccRanking.topPercent <= 5}
          class:tdcc-top10={tdccRanking.topPercent > 5 && tdccRanking.topPercent <= 10}
          class:tdcc-top20={tdccRanking.topPercent > 10 && tdccRanking.topPercent <= 20}
          on:click={() => { tdccExpanded = !tdccExpanded; }}
        >
          <Icon name="users" size={12}/> {t('asset.tdccTop', { percent: tdccRanking.topPercent.toFixed(2) })}
          <Icon name="chevron-down" size={12}/>
        </button>
      </div>

      {#if tdccExpanded && tdccRanking.levels}
        <div class="tdcc-table-wrap">
          <div class="tdcc-table-header">
            <span class="tdcc-table-title">{t('asset.tdccLabel')}</span>
            <span class="tdcc-table-date">{tdccRanking.date}</span>
          </div>
          <div class="tdcc-table-scroll">
          <table class="tdcc-table">
            <thead>
              <tr>
                <th>{t('asset.tdccLevel')}</th>
                <th>{t('asset.tdccHolders')}</th>
                <th>{t('asset.tdccShares')}</th>
                <th>{t('asset.tdccPercent')}</th>
                <th>{t('asset.tdccTopPercent')}</th>
              </tr>
            </thead>
            <tbody>
              {#each tdccRanking.levels as row}
                <tr class:tdcc-highlight={row.level === tdccRanking.level}>
                  <td>{LEVEL_LABELS[row.level] || row.level}</td>
                  <td>{row.holders.toLocaleString('zh-TW')}</td>
                  <td>{row.shares.toLocaleString('zh-TW')}</td>
                  <td>{row.percentage.toFixed(2)}%</td>
                  <td>{(tdccTopPercentMap.get(row.level) || 0).toFixed(2)}%</td>
                </tr>
              {/each}
            </tbody>
            <tfoot>
              <tr class="tdcc-total">
                <td>{t('asset.tdccTotal')}</td>
                <td>{tdccRanking.totalHolders.toLocaleString('zh-TW')}</td>
                <td>{tdccRanking.levels.reduce((s, r) => s + r.shares, 0).toLocaleString('zh-TW')}</td>
                <td>100.00%</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
          </div>
        </div>
      {/if}
    {/if}

    <!-- 多筆持股明細 -->
    {#if isMultiple && holdingsExpanded}
      <div class="holdings-detail expanded">
        {#each asset.holdings as holding}
          <div class="holding-item">
            <span class="holding-quantity">{holding.quantity.toLocaleString('zh-TW')}</span>
            <span class="holding-price">{t('asset.avgCost')} {(holding.avgCost || holding.pricePerUnit).toLocaleString('zh-TW')} {holding.currency}</span>
            <span class="holding-actions">
              <button class="btn-sm btn-outline" on:click={() => handleEdit(holding.id)} title={t('common.edit')}><Icon name="edit" size={14}/> {t('common.edit')}</button>
              <button class="btn-sm btn-outline btn-outline-danger" on:click={() => handleDelete(holding)} title={t('common.delete')}><Icon name="trash" size={14}/> {t('common.delete')}</button>
            </span>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <div class="asset-item-actions">
    {#if isMultiple}
      <button class="btn-sm btn-outline" on:click={toggleHoldings}>
        {#if holdingsExpanded}<Icon name="folder" size={14}/>{:else}<Icon name="list" size={14}/>{/if} {holdingsExpanded ? t('common.close') : t('asset.holdingsCount')}
      </button>
    {:else}
      <button class="btn-sm btn-outline" on:click={() => handleEdit(asset.holdings[0].id)}>
        <Icon name="edit" size={14}/> {t('common.edit')}
      </button>
      <button class="btn-sm btn-outline btn-outline-danger" on:click={() => handleDelete(asset.holdings[0])}>
        <Icon name="trash" size={14}/> {t('common.delete')}
      </button>
    {/if}
    <button class="btn-sm btn-outline" on:click={handleAddSame}>
      <Icon name="plus" size={14}/> {t('common.add')}
    </button>
    {#if asset.type === 'tw_stock'}
      <button
        class="btn-sm btn-outline btn-outline-accent"
        on:click={handlePledge}
        disabled={asset.quantity < 1000}
        title={asset.quantity < 1000 ? '至少要一張（1000股）才能質押' : t('asset.pledge')}
      >
        <Icon name="bank" size={14}/> {asset.quantity < 1000 ? t('asset.pledge') + '（不足1張）' : t('asset.pledge')}
      </button>
    {/if}
  </div>
</div>
