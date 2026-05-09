<!--
  PieChart.svelte — 圓餅圖（Doughnut）元件

  使用 Chart.js 渲染 Doughnut 圓餅圖，顯示投資資產與債務比例。
  圓餅圖中央顯示淨資產金額與今日漲跌幅百分比。
  旁邊顯示詳細圖例（含個別資產/負債明細）。
-->
<script>
  import { onMount, onDestroy, afterUpdate } from 'svelte';
  import { Chart, DoughnutController, ArcElement, Tooltip } from 'chart.js';
  import { t } from '$lib/services/i18n.js';
  import { formatCurrency, formatCompact as formatCompactUtil, formatPercent } from '$lib/services/localeFormatter.js';
  import { growthRates } from '$lib/stores/derived.js';
  import { assets as assetsStore } from '$lib/stores/assets.js';
  import { liabilities as liabilitiesStore } from '$lib/stores/liabilities.js';
  import { exchangeRate as exchangeRateStore } from '$lib/stores/exchangeRate.js';
  import { locale } from '$lib/stores/locale.js';
  import { theme } from '$lib/stores/theme.js';
  import { calculateAssetBreakdown } from '$lib/utils/calculator.js';

  Chart.register(DoughnutController, ArcElement, Tooltip);

  export let pieData = { labels: [], values: [], percentages: [] };
  export let totals = { investmentTotal: 0, liquidTotal: 0, totalLiabilities: 0, netWorth: 0 };

  const PIE_COLORS = ['#6366f1', '#34d399'];

  /** Brawl 主題專用配色 */
  const BRAWL_PIE_COLORS = ['#2d1a4e', '#1a7a10'];

  /** 根據主題取得圓餅圖配色 */
  $: activePieColors = $theme === 'brawl' ? BRAWL_PIE_COLORS : PIE_COLORS;

  let canvasEl;
  let chartInstance = null;

  $: allZero = pieData.values.every(v => v === 0);
  $: dailyRate = $growthRates?.dailyGrowthRate ?? null;
  $: dailyText = dailyRate !== null
    ? `${t('dashboard.todayChange')} ${dailyRate >= 0 ? '+' : ''}${formatPercent(dailyRate)}`
    : '';
  $: dailyClass = dailyRate !== null ? (dailyRate >= 0 ? 'positive' : 'negative') : '';

  // 計算詳細明細
  $: breakdown = calculateAssetBreakdown($assetsStore, $liabilitiesStore, $exchangeRateStore);

  /** 主題變更時重新渲染圖表 */
  $: if ($theme && canvasEl && !allZero) {
    renderChart();
  }

  /**
   * 格式化淨資產為簡潔萬元格式
   * 使用 localeFormatter 的 formatCompact，已內建貨幣換算邏輯
   */
  function formatCompact(value) {
    return formatCompactUtil(value);
  }

  function renderChart() {
    if (!canvasEl || allZero) { destroyChart(); return; }
    // Always destroy and recreate to pick up fresh i18n labels
    destroyChart();
    const isBrawl = $theme === 'brawl';
    const colors = isBrawl ? BRAWL_PIE_COLORS : PIE_COLORS;
    const ctx = canvasEl.getContext('2d');
    chartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: [t('asset.investment'), t('dashboard.liabilities')],
        datasets: [{
          data: pieData.values,
          backgroundColor: colors,
          borderWidth: isBrawl ? 4 : 0,
          borderColor: isBrawl ? '#1a0a00' : undefined,
          hoverBorderWidth: isBrawl ? 5 : 2,
          hoverBorderColor: isBrawl ? '#1a0a00' : undefined,
        }],
      },
      options: {
        cutout: '70%',
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: false,
            external(context) {
              // 確保只有一個 tooltip 元素
              let el = document.getElementById('pie-ext-tooltip');
              if (!el) {
                el = document.createElement('div');
                el.id = 'pie-ext-tooltip';
                document.body.appendChild(el);
              }
              // 根據主題設定樣式
              const brawl = document.documentElement.getAttribute('data-theme') === 'brawl';
              el.style.cssText = brawl
                ? 'position:fixed;pointer-events:none;z-index:9999;background:#2d1a4e;color:#fff;padding:12px 16px;border-radius:14px;font-size:13px;line-height:1.8;transition:opacity .15s;border:3px solid #1a0a00;box-shadow:0 4px 0 #1a0a00;max-width:280px;white-space:normal;'
                : 'position:fixed;pointer-events:none;z-index:9999;background:rgba(20,20,40,.92);color:#fff;padding:12px 16px;border-radius:10px;font-size:13px;line-height:1.8;transition:opacity .15s;backdrop-filter:blur(8px);max-width:280px;white-space:normal;';

              const tm = context.tooltip;
              if (tm.opacity === 0) { el.style.opacity = '0'; return; }

              const idx = tm.dataPoints?.[0]?.dataIndex;
              if (idx != null) {
                const label = tm.dataPoints[0].label || '';
                const value = formatCurrency(tm.dataPoints[0].parsed);
                const list = idx === 0 ? breakdown.investmentAssets : breakdown.liabilityItems;

                // 結構化 HTML：標題 + 分隔線 + 明細表格
                let html = `<div style="font-weight:800;font-size:14px;margin-bottom:6px;border-bottom:1px solid rgba(255,255,255,0.2);padding-bottom:6px;">${label} ${value}</div>`;
                html += '<table style="width:100%;border-collapse:collapse;">';
                for (const item of list) {
                  html += `<tr style="border-bottom:1px solid rgba(255,255,255,0.08);">`;
                  html += `<td style="padding:3px 0;font-weight:500;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${item.name}</td>`;
                  html += `<td style="padding:3px 0 3px 8px;text-align:right;font-weight:700;white-space:nowrap;">${formatCurrency(item.amount)}</td>`;
                  html += `</tr>`;
                }
                html += '</table>';
                el.innerHTML = html;
              }

              const pos = context.chart.canvas.getBoundingClientRect();
              el.style.opacity = '1';
              let left = pos.left + tm.caretX;
              let top = pos.top + tm.caretY - el.offsetHeight - 12;
              const elW = el.offsetWidth;
              if (left + elW > window.innerWidth - 8) {
                left = window.innerWidth - elW - 8;
              }
              if (left < 8) left = 8;
              if (top < 8) {
                top = pos.top + tm.caretY + 12;
              }
              el.style.left = left + 'px';
              el.style.top = top + 'px';
            },
          },
        },
        responsive: true,
        maintainAspectRatio: false,
      },
    });
  }

  function destroyChart() {
    if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
    const el = document.getElementById('pie-ext-tooltip');
    if (el) { el.style.opacity = '0'; el.innerHTML = ''; }
  }

  function hideExtTooltip() {
    const el = document.getElementById('pie-ext-tooltip');
    if (el) el.style.opacity = '0';
    // 同時重置 Chart.js 內部 tooltip 狀態，讓下次 hover 能重新觸發
    if (chartInstance) {
      chartInstance.tooltip.setActiveElements([], { x: 0, y: 0 });
      chartInstance.setActiveElements([]);
      chartInstance.update('none');
    }
  }

  onMount(() => {
    renderChart();
    window.addEventListener('scroll', hideExtTooltip, true);
  });
  afterUpdate(() => renderChart());
  onDestroy(() => {
    destroyChart();
    window.removeEventListener('scroll', hideExtTooltip, true);
  });
</script>

<div class="chart-section">
  <h2 class="section-title">{t('dashboard.assetAllocation')}</h2>

  <div class="pie-chart-container">
    {#if allZero}
      <div class="no-data-placeholder">{t('dashboard.noData')}</div>
    {:else}
      <div class="pie-chart-wrapper">
        <canvas bind:this={canvasEl}></canvas>
        <div class="pie-chart-center">
          <span class="pie-net-worth-label">{t('dashboard.netWorth')}</span>
          <span class="pie-center-amount">{formatCompact(totals.netWorth)}</span>
          {#if dailyText}
            <span class="pie-daily-change {dailyClass}">{dailyText}</span>
          {/if}
        </div>
      </div>

      <!-- 詳細圖例 -->
      <div class="pie-legend">
        <!-- 投資資產 -->
        {#if breakdown.investmentAssets.length > 0}
          <div class="legend-category">
            <div class="legend-category-header">
              <span class="legend-dot" style="background-color: {activePieColors[0]};"></span>
              <span class="legend-category-title">{t('asset.investment')}</span>
              <span class="legend-category-total">{formatCurrency(totals.investmentTotal + totals.liquidTotal)} ({pieData.percentages[0].toFixed(1)}%)</span>
            </div>
            <div class="legend-items">
              {#each breakdown.investmentAssets as item}
                <div class="legend-item-detail">
                  <span class="legend-item-name">{item.name}</span>
                  <span class="legend-item-amount">{formatCurrency(item.amount)}</span>
                  <span class="legend-item-percent">{item.percentage.toFixed(1)}%</span>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- 債務 -->
        {#if breakdown.liabilityItems.length > 0}
          <div class="legend-category">
            <div class="legend-category-header">
              <span class="legend-dot" style="background-color: {activePieColors[1]};"></span>
              <span class="legend-category-title">{t('dashboard.liabilities')}</span>
              <span class="legend-category-total">{formatCurrency(totals.totalLiabilities)} ({pieData.percentages[1].toFixed(1)}%)</span>
            </div>
            {#if breakdown.avgInterestRate !== null}
              <div class="legend-category-rate">{t('dashboard.avgRate')} {breakdown.avgInterestRate.toFixed(2)}%</div>
            {/if}
            <div class="legend-items">
              {#each breakdown.liabilityItems as item}
                <div class="legend-item-detail">
                  <span class="legend-item-name">
                    {item.name}
                    {#if item.interestRate}
                      <span class="legend-item-rate">{item.interestRate}%</span>
                    {/if}
                  </span>
                  <span class="legend-item-amount">{formatCurrency(item.amount)}</span>
                  <span class="legend-item-percent">{item.percentage.toFixed(1)}%</span>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .pie-daily-change { display: block; font-size: var(--font-size-xs); margin-top: 2px; }
  .pie-daily-change.positive { color: var(--color-positive); }
  .pie-daily-change.negative { color: var(--color-negative); }
  .pie-center-amount {
    display: block;
    font-size: var(--font-size-lg);
    font-weight: 800;
    color: var(--text-primary);
    white-space: nowrap;
  }
</style>
