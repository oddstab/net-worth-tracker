<!--
  QuickStats.svelte — 四格快速數字卡片

  顯示：資產月增率、投資總額、淨資產、債務。
  月增率正值綠色 + '+' 前綴，負值紅色。
  手機 2×2 網格，平板/桌面 4 欄（由全域 CSS 控制）。

  Props:
    totals     — calculateTotals 的回傳值
    growthRates — calculateGrowthRates 的回傳值
-->
<script>
  import { t } from '$lib/services/i18n.js';
  import { formatCurrency, formatPercent } from '$lib/services/localeFormatter.js';

  /** @type {{ investmentTotal: number, totalLiabilities: number, netWorth: number }} */
  export let totals = { investmentTotal: 0, totalLiabilities: 0, netWorth: 0 };

  /** @type {{ monthlyGrowthRate: number|null, estimatedMonthlyRate: number|null }} */
  export let growthRates = { monthlyGrowthRate: null, estimatedMonthlyRate: null };

  /**
   * 取得要顯示的月增率數值。
   * 優先使用真實月增率，其次使用估算月增率。
   */
  $: displayRate = growthRates.monthlyGrowthRate ?? growthRates.estimatedMonthlyRate ?? null;

  /**
   * 格式化月增率顯示文字。
   * 正值加 '+' 前綴，附帶 '%' 後綴。
   * 若為估算值則加 '*' 標記。
   */
  $: growthText = displayRate !== null
    ? (displayRate >= 0 ? '+' : '') + formatPercent(displayRate)
    : '--';

  /** 是否為估算值 */
  $: isEstimated = growthRates.monthlyGrowthRate === null && growthRates.estimatedMonthlyRate !== null;

  /** 月增率 CSS class */
  $: growthClass = displayRate !== null
    ? (displayRate >= 0 ? 'positive' : 'negative')
    : '';
</script>

<div class="quick-stats">
  <!-- 資產月增率 -->
  <div class="stat-card">
    <span class="stat-label">{t('dashboard.monthlyGrowth')}</span>
    <span
      class="stat-value {growthClass}"
      title={isEstimated ? t('dashboard.noData') : ''}
    >
      {growthText}{#if isEstimated}*{/if}
    </span>
  </div>

  <!-- 投資總額 -->
  <div class="stat-card">
    <span class="stat-label">{t('dashboard.investmentTotal')}</span>
    <span class="stat-value">{formatCurrency(totals.investmentTotal)}</span>
  </div>

  <!-- 淨資產 -->
  <div class="stat-card">
    <span class="stat-label">{t('dashboard.netWorth')}</span>
    <span class="stat-value">{formatCurrency(totals.netWorth)}</span>
  </div>

  <!-- 債務 -->
  <div class="stat-card">
    <span class="stat-label">{t('dashboard.liabilities')}</span>
    <span class="stat-value">{formatCurrency(totals.totalLiabilities)}</span>
  </div>
</div>
