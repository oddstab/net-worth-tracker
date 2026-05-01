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
  import { formatCurrency, formatPercent } from '$lib/services/localeFormatter.js';
  import { growthRates } from '$lib/stores/derived.js';
  import { assets as assetsStore } from '$lib/stores/assets.js';
  import { liabilities as liabilitiesStore } from '$lib/stores/liabilities.js';
  import { exchangeRate as exchangeRateStore } from '$lib/stores/exchangeRate.js';
  import { locale } from '$lib/stores/locale.js';
  import { calculateAssetBreakdown } from '$lib/utils/calculator.js';

  Chart.register(DoughnutController, ArcElement, Tooltip);

  export let pieData = { labels: [], values: [], percentages: [] };
  export let totals = { investmentTotal: 0, liquidTotal: 0, totalLiabilities: 0, netWorth: 0 };

  const PIE_COLORS = ['#6366f1', '#34d399'];

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

  /**
   * 格式化淨資產為簡潔萬元格式
   */
  function formatCompact(value) {
    const abs = Math.abs(value);
    if (abs >= 10000) {
      try {
        return new Intl.NumberFormat($locale, {
          style: 'currency',
          currency: 'TWD',
          notation: 'compact',
          maximumFractionDigits: 0,
        }).format(value);
      } catch {
        // fallback
      }
    }
    return formatCurrency(value);
  }

  function renderChart() {
    if (!canvasEl || allZero) { destroyChart(); return; }
    // Always destroy and recreate to pick up fresh i18n labels
    destroyChart();
    const ctx = canvasEl.getContext('2d');
    chartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: [t('asset.investment'), t('dashboard.liabilities')],
        datasets: [{ data: pieData.values, backgroundColor: PIE_COLORS, borderWidth: 0 }],
      },
      options: {
        cutout: '70%',
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: false,
            external(context) {
              let el = document.getElementById('pie-ext-tooltip');
              if (!el) {
                el = document.createElement('div');
                el.id = 'pie-ext-tooltip';
                el.style.cssText = 'position:fixed;pointer-events:none;z-index:9999;background:rgba(0,0,0,.85);color:#fff;padding:8px 14px;border-radius:8px;font-size:13px;line-height:1.6;white-space:nowrap;transition:opacity .15s;';
                document.body.appendChild(el);
              }
              const tm = context.tooltip;
              if (tm.opacity === 0) { el.style.opacity = '0'; return; }

              const idx = tm.dataPoints?.[0]?.dataIndex;
              if (idx != null) {
                const label = tm.dataPoints[0].label || '';
                const value = formatCurrency(tm.dataPoints[0].parsed);
                const list = idx === 0 ? breakdown.investmentAssets : breakdown.liabilityItems;
                const details = list.map(i => `${i.name}: ${formatCurrency(i.amount)}`).join('<br>');
                el.innerHTML = `<div style="font-weight:700;margin-bottom:4px">${label} ${value}</div>${details}`;
              }

              const pos = context.chart.canvas.getBoundingClientRect();
              el.style.opacity = '1';
              // 先定位，再檢查是否超出螢幕右邊
              let left = pos.left + tm.caretX;
              let top = pos.top + tm.caretY - el.offsetHeight - 10;
              // 超出右邊時靠左
              const elW = el.offsetWidth;
              if (left + elW > window.innerWidth - 8) {
                left = window.innerWidth - elW - 8;
              }
              // 超出左邊
              if (left < 8) left = 8;
              // 超出上方時改到下方
              if (top < 8) {
                top = pos.top + tm.caretY + 10;
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
    if (el) el.style.opacity = '0';
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
              <span class="legend-dot" style="background-color: {PIE_COLORS[0]};"></span>
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
              <span class="legend-dot" style="background-color: {PIE_COLORS[1]};"></span>
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
