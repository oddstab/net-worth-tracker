<!--
  TrendChart.svelte — 淨資產趨勢折線圖

  使用 Chart.js 渲染淨資產趨勢折線圖。
  提供時間範圍篩選器（1週、1月、6月、1年、全部）。
  無快照資料時顯示「尚無資料」提示。

  Props:
    snapshots — 快照陣列 [{ date, netWorth }]
-->
<script>
  import { onMount, onDestroy, afterUpdate } from 'svelte';
  import {
    Chart,
    LineController,
    LineElement,
    PointElement,
    LinearScale,
    CategoryScale,
    Filler,
    Tooltip,
  } from 'chart.js';
  import { t } from '$lib/services/i18n.js';
  import { formatCurrency } from '$lib/services/localeFormatter.js';
  import { filterSnapshotsByRange, filterSnapshotsByCustomRange } from '$lib/services/snapshotManager.js';
  import PnlCalendar from './PnlCalendar.svelte';
  import Icon from '../Icon.svelte';

  // 註冊 Chart.js 所需元件
  Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip);

  /** @type {Array<{ date: string, netWorth: number }>} */
  export let snapshots = [];

  /** 檢視模式：chart 或 calendar */
  let viewMode = 'chart';

  /** 可選的時間範圍 */
  const RANGES = ['1w', '1m', '6m', '1y', 'all', 'custom'];

  /** 當前選取的時間範圍 */
  let currentRange = '1w';

  /** 自訂日期範圍 */
  let customStartDate = '';
  let customEndDate = '';

  /** @type {HTMLCanvasElement} */
  let canvasEl;

  /** @type {Chart | null} */
  let chartInstance = null;

  /** 依當前範圍篩選後的快照 */
  $: filteredSnapshots = currentRange === 'custom'
    ? (customStartDate && customEndDate
        ? filterSnapshotsByCustomRange(snapshots, customStartDate, customEndDate)
        : [])
    : filterSnapshotsByRange(snapshots, currentRange);

  /** 是否無資料 */
  $: hasNoData = filteredSnapshots.length === 0;

  /**
   * 切換時間範圍。
   * @param {string} range — 時間範圍代碼
   */
  function selectRange(range) {
    currentRange = range;
  }

  /**
   * 建立或更新折線圖。
   */
  function renderChart() {
    if (!canvasEl || hasNoData) {
      destroyChart();
      return;
    }

    // Always destroy and recreate to pick up fresh i18n labels
    destroyChart();

    const labels = filteredSnapshots.map(s => s.date);
    const data = filteredSnapshots.map(s => s.netWorth);

    const ctx = canvasEl.getContext('2d');
    chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: t('dashboard.netWorth'),
          data,
          borderColor: '#7c6af7',
          backgroundColor: 'rgba(124, 106, 247, 0.1)',
          borderWidth: 2,
          pointRadius: data.length > 30 ? 0 : 3,
          pointHoverRadius: 4,
          fill: true,
          tension: 0.4,
          cubicInterpolationMode: 'monotone',
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => formatCurrency(context.parsed.y),
            },
          },
        },
        scales: {
          x: {
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: {
              color: '#a0a0b8',
              maxTicksLimit: 6,
              maxRotation: 45,
              minRotation: 45,
              callback(value) {
                const label = this.getLabelForValue(value);
                // 'YYYY-MM-DD' → 'MM/DD'
                return label.slice(5);
              },
            },
          },
          y: {
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: {
              color: '#a0a0b8',
              callback: (value) => formatCurrency(Number(value)),
            },
          },
        },
      },
    });
  }

  /**
   * 銷毀圖表實例。
   */
  function destroyChart() {
    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }
  }

  onMount(() => {
    renderChart();
  });

  afterUpdate(() => {
    // 當 filteredSnapshots 變更時需要重新渲染
    // 若從有資料變為無資料，需銷毀圖表
    if (hasNoData) {
      destroyChart();
    } else {
      renderChart();
    }
  });

  onDestroy(() => {
    destroyChart();
  });
</script>

<div class="chart-section">
  <div class="trend-header">
    <h2 class="section-title">{t('dashboard.assetTrend')}</h2>
    <div class="view-toggle">
      <button
        class="view-toggle-btn"
        class:active={viewMode === 'calendar'}
        on:click={() => viewMode = 'calendar'}
      >
        <Icon name="calendar" size={16}/> {t('dashboard.pnlCalendar')}
      </button>
      <button
        class="view-toggle-btn"
        class:active={viewMode === 'chart'}
        on:click={() => viewMode = 'chart'}
      >
        <Icon name="chart" size={16}/> {t('dashboard.chartView')}
      </button>
    </div>
  </div>

  {#if viewMode === 'calendar'}
    <!-- 盈虧日曆 -->
    <PnlCalendar {snapshots} />
  {:else}
    <!-- 時間範圍篩選器 -->
    <div class="trend-range-selector">
      {#each RANGES as range}
        <button
          class="range-btn"
          class:active={currentRange === range}
          on:click={() => selectRange(range)}
        >
          {t(`timeRange.${range}`)}
        </button>
      {/each}
    </div>

    <!-- 自訂日期範圍輸入 -->
    {#if currentRange === 'custom'}
      <div class="custom-range-inputs">
        <input type="date" class="form-input custom-date-input" bind:value={customStartDate} />
        <span class="custom-range-separator">~</span>
        <input type="date" class="form-input custom-date-input" bind:value={customEndDate} />
      </div>
    {/if}

    <!-- 折線圖或無資料提示 -->
    {#if hasNoData}
      <div class="no-data-placeholder">{t('dashboard.noData')}</div>
    {:else}
      <div class="trend-chart-container">
        <canvas bind:this={canvasEl}></canvas>
      </div>
    {/if}
  {/if}
</div>

<style>
  .trend-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--spacing-md);
    flex-wrap: wrap;
    gap: var(--spacing-sm);
  }
  .trend-header .section-title {
    margin-bottom: 0;
  }
  .view-toggle {
    display: flex;
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-full);
  }
  .view-toggle-btn {
    padding: var(--spacing-xs) var(--spacing-md);
    background: transparent;
    border: none;
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
    cursor: pointer;
    transition: all var(--transition-fast);
    white-space: nowrap;
    min-height: 36px;
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
  }
  .view-toggle-btn:first-child {
    border-radius: var(--border-radius-full) 0 0 var(--border-radius-full);
  }
  .view-toggle-btn:last-child {
    border-radius: 0 var(--border-radius-full) var(--border-radius-full) 0;
  }
  .view-toggle-btn:hover {
    color: var(--text-primary);
    background: var(--bg-hover);
  }
  .view-toggle-btn.active {
    background: var(--accent-color);
    color: #fff;
  }
  .view-toggle-btn:focus-visible {
    outline: 2px solid var(--accent-color);
    outline-offset: 2px;
  }
  .custom-range-inputs {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm, 8px);
    margin-top: var(--spacing-sm, 8px);
  }
  .custom-date-input {
    flex: 1;
    max-width: 160px;
    font-size: var(--font-size-sm, 0.85rem);
    padding: 6px 8px;
    border-radius: var(--border-radius-md);
    border: 1px solid var(--border-color);
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }
  .custom-range-separator {
    color: var(--text-secondary, #a0a0b8);
    font-size: var(--font-size-sm, 0.85rem);
  }
</style>
