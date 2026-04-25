/**
 * snapshotManager.js — 淨資產快照管理
 *
 * 提供快照的建立、篩選與自動快照功能。
 * 不 import state.js，避免循環依賴。
 */

import { calculateTotals } from './calculator.js';

// ─── 日期輔助 ────────────────────────────────────────────────────────────────

/**
 * 取得今日本地日期字串（YYYY-MM-DD）。
 * @returns {string}
 */
function getTodayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ─── 快照操作 ────────────────────────────────────────────────────────────────

/**
 * 建立今日快照。
 * 若 snapshots 中已有今日日期的快照，則覆蓋（更新 netWorth）；
 * 若無，則新增一筆。
 * 回傳更新後的新 snapshots 陣列（不修改原陣列）。
 *
 * @param {import('./types.js').Snapshot[]} snapshots  現有快照陣列
 * @param {number} netWorth  當前淨資產（TWD）
 * @returns {import('./types.js').Snapshot[]}
 */
export function takeSnapshot(snapshots, netWorth) {
  const today = getTodayString();
  const exists = snapshots.some(s => s.date === today);

  if (exists) {
    // 覆蓋今日快照
    return snapshots.map(s =>
      s.date === today ? { ...s, netWorth } : s
    );
  } else {
    // 新增今日快照
    return [...snapshots, { date: today, netWorth }];
  }
}

/**
 * 依時間範圍篩選快照，回傳在指定範圍內的快照陣列（依日期升序排列）。
 *
 * 支援 range：
 *   '1w'  — 7 天
 *   '1m'  — 30 天
 *   '6m'  — 180 天
 *   '1y'  — 365 天
 *   'all' — 全部
 *
 * @param {import('./types.js').Snapshot[]} snapshots
 * @param {'1w' | '1m' | '6m' | '1y' | 'all'} range
 * @returns {import('./types.js').Snapshot[]}
 */
export function filterSnapshotsByRange(snapshots, range) {
  if (range === 'all') {
    return [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  }

  const RANGE_DAYS = {
    '1w': 7,
    '1m': 30,
    '6m': 180,
    '1y': 365,
  };

  const days = RANGE_DAYS[range];
  if (days === undefined) {
    // 未知 range，回傳全部
    return [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  }

  // 計算截止日期（今日往前 days 天）
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - days);

  const cutoffStr = (() => {
    const y = cutoff.getFullYear();
    const m = String(cutoff.getMonth() + 1).padStart(2, '0');
    const d = String(cutoff.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  })();

  return snapshots
    .filter(s => s.date >= cutoffStr)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * 計算淨資產後建立快照。
 * 呼叫 calculator.js 的 calculateTotals 取得 netWorth，
 * 再呼叫 takeSnapshot 建立快照。
 * 回傳更新後的 snapshots 陣列。
 *
 * @param {import('./types.js').Asset[]} assets
 * @param {import('./types.js').Liability[]} liabilities
 * @param {number} rate  USD/TWD 匯率
 * @param {import('./types.js').Snapshot[]} snapshots  現有快照陣列
 * @returns {import('./types.js').Snapshot[]}
 */
export function autoSnapshot(assets, liabilities, rate, snapshots) {
  const { netWorth } = calculateTotals(assets, liabilities, rate);
  return takeSnapshot(snapshots, netWorth);
}
