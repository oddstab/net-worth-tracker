/**
 * trendChart.js — 淨資產趨勢折線圖
 *
 * 提供趨勢折線圖的渲染與初始化功能。
 * 使用 Chart.js（由 CDN 載入至 window.Chart）繪製折線圖。
 *
 * 對應需求：9.2, 9.3, 9.4, 9.5
 */

import * as state from '../state.js';
import { filterSnapshotsByRange } from '../snapshotManager.js';

// ─── 內部狀態 ────────────────────────────────────────────────────────────────

/** @type {import('chart.js').Chart | null} */
let trendChartInstance = null;

/** @type {'1w' | '1m' | '6m' | '1y' | 'all'} */
let currentRange = '1w';

// ─── 渲染 ────────────────────────────────────────────────────────────────────

/**
 * 渲染趨勢折線圖。
 * 依 range 篩選快照後，若無資料顯示提示訊息；
 * 若有資料則使用 Chart.js 繪製折線圖。
 *
 * @param {import('../types.js').Snapshot[]} snapshots  所有快照
 * @param {'1w' | '1m' | '6m' | '1y' | 'all'} range   時間範圍
 */
export function renderTrendChart(snapshots, range) {
  const canvas = document.getElementById('trend-chart');
  const noDataEl = document.getElementById('trend-no-data');

  if (!canvas || !noDataEl) return;

  const filteredSnapshots = filterSnapshotsByRange(snapshots, range);

  if (filteredSnapshots.length === 0) {
    // 無資料：顯示提示，隱藏 canvas
    noDataEl.classList.remove('hidden');
    canvas.classList.add('hidden');

    // 若圖表已存在，先銷毀
    if (trendChartInstance) {
      trendChartInstance.destroy();
      trendChartInstance = null;
    }
    return;
  }

  // 有資料：隱藏提示，顯示 canvas
  noDataEl.classList.add('hidden');
  canvas.classList.remove('hidden');

  // 若圖表已存在，先銷毀再重建
  if (trendChartInstance) {
    trendChartInstance.destroy();
    trendChartInstance = null;
  }

  const ctx = canvas.getContext('2d');
  const Chart = window.Chart;

  if (!Chart) {
    console.warn('trendChart.js: Chart.js 尚未載入');
    return;
  }

  trendChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: filteredSnapshots.map(s => s.date),
      datasets: [{
        label: '淨資產',
        data: filteredSnapshots.map(s => s.netWorth),
        borderColor: '#7c6af7',
        backgroundColor: 'rgba(124, 106, 247, 0.1)',
        borderWidth: 2,
        pointRadius: 3,
        fill: true,
        tension: 0.3,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => 'NT$' + Math.round(context.parsed.y).toLocaleString('zh-TW'),
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#a0a0b8', maxTicksLimit: 6 },
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: {
            color: '#a0a0b8',
            callback: (value) => 'NT$' + Math.round(value).toLocaleString('zh-TW'),
          }
        }
      }
    }
  });
}

// ─── 初始化 ──────────────────────────────────────────────────────────────────

/**
 * 初始化趨勢折線圖：
 * 1. 綁定時間範圍篩選器按鈕的點擊事件
 * 2. 訂閱 state，快照變更時自動更新圖表
 * 3. 執行初始渲染（預設範圍 '1w'）
 */
export function initTrendChart() {
  // 綁定時間範圍篩選器按鈕
  const rangeBtns = document.querySelectorAll('.range-btn');
  rangeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      // 切換 active class
      rangeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // 更新當前範圍並重新渲染
      currentRange = btn.dataset.range;
      const { snapshots } = state.getState();
      renderTrendChart(snapshots, currentRange);
    });
  });

  // 訂閱狀態變更，快照更新時自動重新渲染
  state.subscribe((appState) => {
    renderTrendChart(appState.snapshots, currentRange);
  });

  // 初始渲染
  const { snapshots } = state.getState();
  renderTrendChart(snapshots, currentRange);
}
