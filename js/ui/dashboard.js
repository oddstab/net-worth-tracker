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
  calculateGrowthRates,
  calculatePieChartData,
  calculateAssetBreakdown,
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
  const growthRates = calculateGrowthRates(snapshots);

  // ── 資產月增率 ──
  const growthEl = document.getElementById('stat-monthly-growth');
  if (growthEl) {
    // 優先顯示真實月增率，其次顯示估算月增率
    const displayRate = growthRates.monthlyGrowthRate || growthRates.estimatedMonthlyRate;
    
    if (displayRate === null) {
      growthEl.textContent = '--';
      growthEl.classList.remove('positive', 'negative');
    } else {
      const formatted = displayRate.toFixed(2);
      const isEstimated = growthRates.monthlyGrowthRate === null && growthRates.estimatedMonthlyRate !== null;
      growthEl.textContent = (displayRate >= 0 ? '+' : '') + formatted + '%' + (isEstimated ? '*' : '');
      growthEl.classList.toggle('positive', displayRate >= 0);
      growthEl.classList.toggle('negative', displayRate < 0);
      
      // 添加估算標記的提示
      if (isEstimated) {
        growthEl.title = '基於現有資料估算的月增率';
      } else {
        growthEl.title = '';
      }
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
  const breakdown = calculateAssetBreakdown(assets, liabilities, exchangeRate);

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
    const growthRates = calculateGrowthRates(currentState.snapshots);
    const dailyRate = growthRates.dailyGrowthRate;
    
    console.log('[Dashboard] 成長率資料:', {
      snapshots: currentState.snapshots.length,
      dailyRate,
      monthlyRate: growthRates.monthlyGrowthRate,
      estimatedRate: growthRates.estimatedMonthlyRate
    });
    
    let dailyText = '';
    if (dailyRate !== null) {
      const sign = dailyRate >= 0 ? '+' : '';
      dailyText = `今日${sign}${dailyRate.toFixed(2)}%`;
    }
    
    netWorthEl.innerHTML = `
      <div class="net-worth-amount">${formatNTD(totals.netWorth)}</div>
      ${dailyText ? `<div class="net-worth-daily ${dailyRate >= 0 ? 'positive' : 'negative'}">${dailyText}</div>` : ''}
    `;
  }

  // 渲染詳細圖例
  if (legendEl) {
    let legendHtml = '';
    
    // 投資資產詳細列表
    if (breakdown.investmentAssets.length > 0) {
      legendHtml += `
        <div class="legend-category">
          <div class="legend-category-header">
            <span class="legend-dot" style="background-color: ${PIE_COLORS[0]};"></span>
            <span class="legend-category-title">投資資產</span>
            <span class="legend-category-total">${formatNTD(totals.investmentTotal)} (${pieData.percentages[0].toFixed(1)}%)</span>
          </div>
          <div class="legend-items">
            ${breakdown.investmentAssets.map(item => `
              <div class="legend-item-detail">
                <span class="legend-item-name">${item.name}</span>
                <span class="legend-item-amount">${formatNTD(item.amount)}</span>
                <span class="legend-item-percent">${item.percentage.toFixed(1)}%</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }
    
    // 流動資產詳細列表
    if (breakdown.liquidAssets.length > 0) {
      legendHtml += `
        <div class="legend-category">
          <div class="legend-category-header">
            <span class="legend-dot" style="background-color: ${PIE_COLORS[1]};"></span>
            <span class="legend-category-title">流動資產</span>
            <span class="legend-category-total">${formatNTD(totals.liquidTotal)} (${pieData.percentages[1].toFixed(1)}%)</span>
          </div>
          <div class="legend-items">
            ${breakdown.liquidAssets.map(item => `
              <div class="legend-item-detail">
                <span class="legend-item-name">${item.name}</span>
                <span class="legend-item-amount">${formatNTD(item.amount)}</span>
                <span class="legend-item-percent">${item.percentage.toFixed(1)}%</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }
    
    // 負債詳細列表
    if (breakdown.liabilityItems.length > 0) {
      legendHtml += `
        <div class="legend-category">
          <div class="legend-category-header">
            <span class="legend-dot" style="background-color: ${PIE_COLORS[2]};"></span>
            <span class="legend-category-title">債務</span>
            <span class="legend-category-total">${formatNTD(totals.totalLiabilities)} (${pieData.percentages[2].toFixed(1)}%)</span>
          </div>
          <div class="legend-items">
            ${breakdown.liabilityItems.map(item => `
              <div class="legend-item-detail">
                <span class="legend-item-name">${item.name}</span>
                <span class="legend-item-amount">${formatNTD(item.amount)}</span>
                <span class="legend-item-percent">${item.percentage.toFixed(1)}%</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }
    
    legendEl.innerHTML = legendHtml;
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

/**
 * 更新最後更新時間顯示
 * @param {ReturnType<typeof state.getState>} currentState
 */
function updateLastUpdateTime(currentState) {
  // 移除此函數，不再顯示更新時間
}
/**
 * 渲染資產負債明細
 * @param {ReturnType<typeof state.getState>} currentState
 */
export function renderAssetBreakdown(currentState) {
  const { assets, liabilities, exchangeRate } = currentState;
  const breakdown = calculateAssetBreakdown(assets, liabilities, exchangeRate);
  
  const containerEl = document.getElementById('breakdown-container');
  const noDataEl = document.getElementById('breakdown-no-data');
  
  if (!containerEl) return;
  
  const hasData = assets.length > 0 || liabilities.length > 0;
  
  if (!hasData) {
    if (noDataEl) noDataEl.classList.remove('hidden');
    containerEl.innerHTML = '';
    return;
  }
  
  if (noDataEl) noDataEl.classList.add('hidden');
  
  let html = '';
  
  // 投資資產區塊
  if (breakdown.investmentAssets.length > 0) {
    html += `
      <div class="breakdown-category">
        <div class="breakdown-category-title">
          <div class="breakdown-category-icon investment"></div>
          投資資產
        </div>
        <div class="breakdown-items">
          ${breakdown.investmentAssets.map(item => `
            <div class="breakdown-item">
              <div class="breakdown-item-info">
                <div class="breakdown-item-name">${item.name}</div>
                <div class="breakdown-item-details">${item.details}</div>
              </div>
              <div class="breakdown-item-values">
                <div class="breakdown-item-amount">${formatNTD(item.amount)}</div>
                <div class="breakdown-item-percentage">${item.percentage.toFixed(1)}%</div>
              </div>
            </div>
          `).join('')}
        </div>
        <div class="breakdown-category-total">
          <span>投資資產總計</span>
          <div>
            <span>${formatNTD(breakdown.totals.investmentTotal)}</span>
            <span class="breakdown-category-total-percentage">
              (${(breakdown.totals.totalAssets + breakdown.totals.totalLiabilities) > 0 ? 
                ((breakdown.totals.investmentTotal / (breakdown.totals.totalAssets + breakdown.totals.totalLiabilities)) * 100).toFixed(1) : '0.0'}%)
            </span>
          </div>
        </div>
      </div>
    `;
  }
  
  // 流動資產區塊
  if (breakdown.liquidAssets.length > 0) {
    html += `
      <div class="breakdown-category">
        <div class="breakdown-category-title">
          <div class="breakdown-category-icon liquid"></div>
          流動資產
        </div>
        <div class="breakdown-items">
          ${breakdown.liquidAssets.map(item => `
            <div class="breakdown-item">
              <div class="breakdown-item-info">
                <div class="breakdown-item-name">${item.name}</div>
                <div class="breakdown-item-details">${item.details}</div>
              </div>
              <div class="breakdown-item-values">
                <div class="breakdown-item-amount">${formatNTD(item.amount)}</div>
                <div class="breakdown-item-percentage">${item.percentage.toFixed(1)}%</div>
              </div>
            </div>
          `).join('')}
        </div>
        <div class="breakdown-category-total">
          <span>流動資產總計</span>
          <div>
            <span>${formatNTD(breakdown.totals.liquidTotal)}</span>
            <span class="breakdown-category-total-percentage">
              (${(breakdown.totals.totalAssets + breakdown.totals.totalLiabilities) > 0 ? 
                ((breakdown.totals.liquidTotal / (breakdown.totals.totalAssets + breakdown.totals.totalLiabilities)) * 100).toFixed(1) : '0.0'}%)
            </span>
          </div>
        </div>
      </div>
    `;
  }
  
  // 負債區塊
  if (breakdown.liabilityItems.length > 0) {
    html += `
      <div class="breakdown-category debt-category">
        <div class="breakdown-category-title">
          <div class="breakdown-category-icon debt"></div>
          負債
        </div>
        <div class="breakdown-items">
          ${breakdown.liabilityItems.map(item => `
            <div class="breakdown-item">
              <div class="breakdown-item-info">
                <div class="breakdown-item-name">${item.name}</div>
                <div class="breakdown-item-details">${item.details} (${getCategoryName(item.category)})</div>
              </div>
              <div class="breakdown-item-values">
                <div class="breakdown-item-amount">${formatNTD(item.amount)}</div>
                <div class="breakdown-item-percentage">${item.percentage.toFixed(1)}%</div>
              </div>
            </div>
          `).join('')}
        </div>
        <div class="breakdown-category-total">
          <span>負債總計</span>
          <div>
            <span>${formatNTD(breakdown.totals.totalLiabilities)}</span>
            <span class="breakdown-category-total-percentage">
              (${(breakdown.totals.totalAssets + breakdown.totals.totalLiabilities) > 0 ? 
                ((breakdown.totals.totalLiabilities / (breakdown.totals.totalAssets + breakdown.totals.totalLiabilities)) * 100).toFixed(1) : '0.0'}%)
            </span>
          </div>
        </div>
      </div>
    `;
  }
  
  containerEl.innerHTML = html;
}

/**
 * 獲取負債類別的中文名稱
 * @param {string} category
 * @returns {string}
 */
function getCategoryName(category) {
  const categoryNames = {
    'credit': '信用卡',
    'pledge': '質押貸款',
    'mortgage': '房貸',
    'other': '其他'
  };
  return categoryNames[category] || category;
}