/**
 * dashboard.js — 儀表板（4格快速數字 + 圓餅圖）
 *
 * 負責渲染：
 *   - 4 格快速數字：資產月增率、投資總額、流動資產、債務
 *   - 圓餅圖：投資資產、流動資產、債務比例（Chart.js Doughnut）
 *   - 圓餅圖中央淨資產金額
 *   - 圓餅圖圖例
 */

import * as state from '../state.js';
import {
  calculateTotals,
  calculateMonthlyGrowthRate,
  calculatePieChartData,
} from '../calculator.js';

// ─── 常數 ────────────────────────────────────────────────────────────────────

/** 圓餅圖各類別顏色 */
const PIE_COLORS = ['#7c6af7', '#4ade80', '#f87171'];

// ─── 格式化輔助 ───────────────────────────────────────────────────────────────

/**
 * 將數字格式化為 NT$X,XXX,XXX 格式。
 * @param {number} value
 * @returns {string}
 */
function formatNTD(value) {
  return 'NT$' + Math.round(value).toLocaleString('zh-TW');
}

// ─── 圓餅圖實例 ───────────────────────────────────────────────────────────────

/** @type {import('chart.js').Chart | null} */
let pieChartInstance = null;

// ─── 渲染函式 ─────────────────────────────────────────────────────────────────

/**
 * 渲染 4 格快速數字。
 *
 * @param {{ assets: import('../types.js').Asset[], liabilities: import('../types.js').Liability[], exchangeRate: number, snapshots: import('../types.js').Snapshot[] }} currentState
 */
export function renderQuickStats(currentState) {
  const { assets, liabilities, exchangeRate, snapshots } = currentState;
  const totals = calculateTotals(assets, liabilities, exchangeRate);

  // ── 資產月增率 ──
  const growthEl = document.getElementById('stat-monthly-growth');
  if (growthEl) {
    const growthRate = calculateMonthlyGrowthRate(snapshots);
    if (growthRate === null) {
      growthEl.textContent = '--';
      growthEl.classList.remove('positive', 'negative');
    } else {
      const formatted = growthRate.toFixed(2);
      growthEl.textContent = (growthRate >= 0 ? '+' : '') + formatted + '%';
      growthEl.classList.toggle('positive', growthRate >= 0);
      growthEl.classList.toggle('negative', growthRate < 0);
    }
  }

  // ── 投資總額 ──
  const investmentEl = document.getElementById('stat-investment-total');
  if (investmentEl) {
    investmentEl.textContent = formatNTD(totals.investmentTotal);
  }

  // ── 流動資產 ──
  const liquidEl = document.getElementById('stat-liquid-total');
  if (liquidEl) {
    liquidEl.textContent = formatNTD(totals.liquidTotal);
  }

  // ── 債務 ──
  const liabilitiesEl = document.getElementById('stat-liabilities-total');
  if (liabilitiesEl) {
    liabilitiesEl.textContent = formatNTD(totals.totalLiabilities);
  }
}

/**
 * 渲染圓餅圖（Doughnut）、中央淨資產與圖例。
 *
 * @param {{ assets: import('../types.js').Asset[], liabilities: import('../types.js').Liability[], exchangeRate: number, snapshots: import('../types.js').Snapshot[] }} currentState
 */
export function renderPieChart(currentState) {
  const { assets, liabilities, exchangeRate } = currentState;
  const totals = calculateTotals(assets, liabilities, exchangeRate);
  const pieData = calculatePieChartData(totals);

  const canvasEl = document.getElementById('pie-chart');
  const noDataEl = document.getElementById('pie-no-data');
  const netWorthEl = document.getElementById('pie-net-worth');
  const legendEl = document.getElementById('pie-legend');

  const allZero = pieData.values.every(v => v === 0);

  if (allZero) {
    // 無資料狀態
    if (noDataEl) noDataEl.classList.remove('hidden');
    if (canvasEl) canvasEl.classList.add('hidden');
    if (legendEl) legendEl.innerHTML = '';
    if (netWorthEl) netWorthEl.textContent = '--';

    // 銷毀現有圖表
    if (pieChartInstance) {
      pieChartInstance.destroy();
      pieChartInstance = null;
    }
    return;
  }

  // 有資料狀態
  if (noDataEl) noDataEl.classList.add('hidden');
  if (canvasEl) canvasEl.classList.remove('hidden');

  // 更新中央淨資產
  if (netWorthEl) {
    netWorthEl.textContent = formatNTD(totals.netWorth);
  }

  // 渲染圖例
  if (legendEl) {
    legendEl.innerHTML = pieData.labels
      .map((label, i) => {
        const color = PIE_COLORS[i];
        const amount = formatNTD(pieData.values[i]);
        const percent = pieData.percentages[i].toFixed(1) + '%';
        return `<div class="legend-item">
  <span class="legend-dot" style="background-color: ${color};"></span>
  <span class="legend-label">${label}</span>
  <span class="legend-amount">${amount}</span>
  <span class="legend-percent">${percent}</span>
</div>`;
      })
      .join('');
  }

  // 繪製圓餅圖
  if (!canvasEl) return;

  const Chart = window.Chart;
  if (!Chart) {
    console.warn('dashboard.js: Chart.js 尚未載入');
    return;
  }

  // 若圖表已存在，先銷毀
  if (pieChartInstance) {
    pieChartInstance.destroy();
    pieChartInstance = null;
  }

  const ctx = canvasEl.getContext('2d');
  pieChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: pieData.labels,
      datasets: [
        {
          data: pieData.values,
          backgroundColor: PIE_COLORS,
          borderWidth: 0,
        },
      ],
    },
    options: {
      cutout: '70%',
      plugins: {
        legend: { display: false },
        tooltip: { enabled: true },
      },
      responsive: true,
      maintainAspectRatio: false,
    },
  });
}

// ─── 初始化 ───────────────────────────────────────────────────────────────────

/**
 * 初始化儀表板：訂閱狀態變更並執行初始渲染。
 */
export function initDashboard() {
  /**
   * 狀態變更時的更新函式。
   * @param {ReturnType<typeof state.getState>} currentState
   */
  function onStateChange(currentState) {
    renderQuickStats(currentState);
    renderPieChart(currentState);
  }

  // 訂閱狀態變更
  state.subscribe(onStateChange);

  // 執行初始渲染
  onStateChange(state.getState());
}
