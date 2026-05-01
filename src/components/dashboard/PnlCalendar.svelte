<!--
  PnlCalendar.svelte — 每日盈虧日曆

  從快照資料計算每日盈虧（當日淨資產 - 前一日淨資產），
  以月曆格式顯示，正值綠色、負值紅色。
  提供月份切換功能與月度摘要。

  Props:
    snapshots — 快照陣列 [{ date, netWorth }]
-->
<script>
  import { formatCurrency } from '$lib/services/localeFormatter.js';
  import { t } from '$lib/services/i18n.js';
  import { tStore } from '$lib/services/i18n.js';
  import { locale } from '$lib/stores/locale.js';

  /** @type {Array<{ date: string, netWorth: number }>} */
  export let snapshots = [];

  /** 當前顯示的年月 */
  let currentYear = new Date().getFullYear();
  let currentMonth = new Date().getMonth(); // 0-indexed

  /** Tooltip 狀態 */
  let tooltipVisible = false;
  let tooltipX = 0;
  let tooltipY = 0;
  let tooltipContent = '';

  /* 訂閱語言切換 */
  $: _t = $tStore;

  $: WEEKDAYS = [
    t('dashboard.weekdaysSun'),
    t('dashboard.weekdaysMon'),
    t('dashboard.weekdaysTue'),
    t('dashboard.weekdaysWed'),
    t('dashboard.weekdaysThu'),
    t('dashboard.weekdaysFri'),
    t('dashboard.weekdaysSat'),
  ];

  /** 切換到上個月 */
  function prevMonth() {
    if (currentMonth === 0) {
      currentMonth = 11;
      currentYear--;
    } else {
      currentMonth--;
    }
  }

  /** 切換到下個月 */
  function nextMonth() {
    if (currentMonth === 11) {
      currentMonth = 0;
      currentYear++;
    } else {
      currentMonth++;
    }
  }

  /** 格式化月份標題 */
  $: monthLabel = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

  /**
   * 建立日期 → 盈虧的 Map
   * 盈虧 = 當日淨資產 - 前一日淨資產
   */
  $: pnlMap = (() => {
    const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
    const map = new Map();
    for (let i = 1; i < sorted.length; i++) {
      const diff = sorted[i].netWorth - sorted[i - 1].netWorth;
      map.set(sorted[i].date, diff);
    }
    return map;
  })();

  /** 日期 → 淨資產 Map（用於 tooltip） */
  $: netWorthMap = (() => {
    const map = new Map();
    for (const s of snapshots) {
      map.set(s.date, s.netWorth);
    }
    return map;
  })();

  /** 顯示 tooltip */
  function showTooltip(e, cell) {
    const nw = netWorthMap.get(cell.date);
    if (nw == null && cell.pnl == null) return;
    const lines = [cell.date];
    if (nw != null) lines.push(`${t('dashboard.netWorthLabel')}: ${formatCurrency(nw)}`);
    if (cell.pnl != null) lines.push(`${t('dashboard.pnlLabel')}: ${formatPnl(cell.pnl)}`);
    tooltipContent = lines.join('\n');
    const rect = e.currentTarget.getBoundingClientRect();
    tooltipX = rect.left + rect.width / 2;
    tooltipY = rect.top - 8;
    tooltipVisible = true;
  }

  /** 隱藏 tooltip */
  function hideTooltip() {
    tooltipVisible = false;
  }

  /**
   * 建立當月日曆格子
   * 每格: { day, date, pnl }
   */
  $: calendarDays = (() => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const startWeekday = firstDay.getDay(); // 0=Sun
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    const cells = [];

    // 前面的空格
    for (let i = 0; i < startWeekday; i++) {
      cells.push({ day: null, date: null, pnl: null });
    }

    // 每一天
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const pnl = pnlMap.get(dateStr) ?? null;
      cells.push({ day: d, date: dateStr, pnl });
    }

    return cells;
  })();

  /** 當月盈虧摘要 */
  $: monthSummary = (() => {
    let total = 0;
    let count = 0;
    const prefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    for (const [date, pnl] of pnlMap) {
      if (date.startsWith(prefix)) {
        total += pnl;
        count++;
      }
    }
    // 月初淨資產（用來算收益率）
    const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
    const monthStart = sorted.find(s => s.date >= prefix);
    // 找前一天的淨資產作為基準
    const baseIdx = monthStart ? sorted.indexOf(monthStart) - 1 : -1;
    const baseNetWorth = baseIdx >= 0 ? sorted[baseIdx].netWorth : 0;
    const returnRate = baseNetWorth > 0 ? (total / baseNetWorth) * 100 : 0;
    return { total, count, returnRate };
  })();

  /** 格式化盈虧金額（簡潔版） */
  function formatPnl(value) {
    if (value == null) return '';
    const sign = value >= 0 ? '+' : '';
    const abs = Math.abs(value);
    if (abs >= 10000) {
      try {
        const compact = new Intl.NumberFormat($locale, {
          notation: 'compact',
          maximumFractionDigits: 1,
          signDisplay: 'always',
        }).format(value);
        return compact;
      } catch { /* fallback below */ }
    }
    return `${sign}${Math.round(value).toLocaleString($locale)}`;
  }
</script>

<div class="pnl-calendar">
  <!-- 月份導航 -->
  <div class="calendar-nav">
    <button class="calendar-nav-btn" on:click={prevMonth} aria-label="Previous month">‹</button>
    <span class="calendar-month-label">{monthLabel}</span>
    <button class="calendar-nav-btn" on:click={nextMonth} aria-label="Next month">›</button>
  </div>

  <!-- 月度摘要 -->
  <div class="calendar-summary">
    <span class="summary-item">
      {t('dashboard.monthPnl', { month: currentMonth + 1 })}
      <strong class={monthSummary.total >= 0 ? 'positive' : 'negative'}>
        {formatPnl(monthSummary.total)}
      </strong>
    </span>
    <span class="summary-item">
      {t('dashboard.returnRate')}
      <strong class={monthSummary.returnRate >= 0 ? 'positive' : 'negative'}>
        {monthSummary.returnRate >= 0 ? '+' : ''}{monthSummary.returnRate.toFixed(2)}%
      </strong>
    </span>
  </div>

  <!-- 星期標題 -->
  <div class="calendar-grid calendar-header">
    {#each WEEKDAYS as wd}
      <span class="calendar-weekday">{wd}</span>
    {/each}
  </div>

  <!-- 日曆格子 -->
  <div class="calendar-grid calendar-body">
    {#each calendarDays as cell}
      <div
        class="calendar-cell"
        class:empty={cell.day === null}
        class:has-data={cell.pnl !== null}
        class:positive-bg={cell.pnl !== null && cell.pnl >= 0}
        class:negative-bg={cell.pnl !== null && cell.pnl < 0}
        role="gridcell"
        tabindex="-1"
        on:mouseenter={(e) => { if (cell.day !== null) showTooltip(e, cell); }}
        on:mouseleave={hideTooltip}
      >
        {#if cell.day !== null}
          <span class="cell-day">{cell.day}</span>
          {#if cell.pnl !== null}
            <span class="cell-pnl" class:positive={cell.pnl >= 0} class:negative={cell.pnl < 0}>
              {formatPnl(cell.pnl)}
            </span>
          {/if}
        {/if}
      </div>
    {/each}
  </div>

  <!-- Tooltip -->
  {#if tooltipVisible}
    <div class="calendar-tooltip" style="left: {tooltipX}px; top: {tooltipY}px;">
      {#each tooltipContent.split('\n') as line}
        <div>{line}</div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .pnl-calendar {
    width: 100%;
  }

  /* 月份導航 */
  .calendar-nav {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-md);
    margin-bottom: var(--spacing-md);
  }
  .calendar-nav-btn {
    background: transparent;
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-sm);
    color: var(--text-primary);
    font-size: var(--font-size-lg);
    width: 32px;
    height: 32px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--transition-fast);
  }
  .calendar-nav-btn:hover {
    border-color: var(--accent-color);
    color: var(--accent-color);
  }
  .calendar-nav-btn:focus-visible {
    outline: 2px solid var(--accent-color);
    outline-offset: 2px;
  }
  .calendar-month-label {
    font-size: var(--font-size-lg);
    font-weight: 700;
    color: var(--text-primary);
    min-width: 100px;
    text-align: center;
  }

  /* 月度摘要 */
  .calendar-summary {
    display: flex;
    justify-content: center;
    gap: var(--spacing-xl);
    margin-bottom: var(--spacing-md);
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
  }
  .summary-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
  }
  .summary-item strong {
    font-weight: 700;
  }

  /* 日曆格線 */
  .calendar-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 2px;
  }
  .calendar-header {
    margin-bottom: 4px;
  }
  .calendar-weekday {
    text-align: center;
    font-size: var(--font-size-xs);
    font-weight: 600;
    color: var(--text-muted);
    padding: var(--spacing-xs) 0;
  }

  /* 日曆格子 */
  .calendar-cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    border-radius: var(--border-radius-sm);
    padding: 3px 2px;
    min-height: 40px;
    transition: background-color var(--transition-fast);
  }
  .calendar-cell.empty {
    background: transparent;
  }
  .calendar-cell.has-data {
    cursor: default;
  }
  .calendar-cell.positive-bg {
    background: rgba(74, 222, 128, 0.15);
  }
  .calendar-cell.negative-bg {
    background: rgba(248, 113, 113, 0.15);
  }

  /* Light theme overrides */
  :global([data-theme="light"]) .calendar-cell.positive-bg {
    background: rgba(0, 200, 83, 0.12);
  }
  :global([data-theme="light"]) .calendar-cell.negative-bg {
    background: rgba(255, 23, 68, 0.10);
  }

  .cell-day {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--text-primary);
    line-height: 1;
  }
  .cell-pnl {
    font-size: 10px;
    font-weight: 600;
    line-height: 1;
    margin-top: 2px;
    white-space: nowrap;
  }
  .cell-pnl.positive { color: var(--color-positive); }
  .cell-pnl.negative { color: var(--color-negative); }

  .positive { color: var(--color-positive); }
  .negative { color: var(--color-negative); }

  /* 手機上字更小 */
  @media (max-width: 480px) {
    .calendar-cell {
      min-height: 34px;
      padding: 2px 1px;
    }
    .cell-pnl {
      font-size: 9px;
    }
  }

  /* Tooltip */
  .calendar-tooltip {
    position: fixed;
    transform: translate(-50%, -100%);
    background: rgba(0, 0, 0, 0.85);
    color: #fff;
    padding: 6px 12px;
    border-radius: 8px;
    font-size: 12px;
    line-height: 1.5;
    white-space: nowrap;
    pointer-events: none;
    z-index: 9999;
  }
</style>
