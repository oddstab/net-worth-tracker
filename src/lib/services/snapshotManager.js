/**
 * snapshotManager.js — 淨資產快照管理（純模組）
 *
 * 提供快照的建立、篩選功能。
 * 此模組為純函式模組，接收快照陣列作為參數並回傳新陣列，
 * 不直接匯入 state.js 或任何 store，避免循環依賴。
 */

// ─── 常數 ─────────────────────────────────────────────────────────────────────

/** 快照數量上限（最近 365 天） */
const MAX_SNAPSHOTS = 365;

/** 時間範圍對應天數 */
const RANGE_DAYS = {
  '1w': 7,
  '1m': 30,
  '6m': 180,
  '1y': 365,
};

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
 * 建立或更新當日快照。
 *
 * - 若 snapshots 中已有今日日期的快照，則覆蓋（更新 netWorth）
 * - 若無，則新增一筆
 * - 若快照數量超過 365 筆，移除最舊的快照
 * - 回傳更新後的新 snapshots 陣列（不修改原陣列）
 *
 * @param {Array<{date: string, netWorth: number}>} snapshots  現有快照陣列
 * @param {number} netWorth  當前淨資產（TWD）
 * @returns {Array<{date: string, netWorth: number}>}  更新後的快照陣列
 */
export function autoSnapshot(snapshots, netWorth) {
  const today = getTodayString();
  const exists = snapshots.some(s => s.date === today);

  let updated;

  if (exists) {
    // 當日已有快照 → 覆蓋 netWorth
    updated = snapshots.map(s =>
      s.date === today ? { ...s, netWorth } : { ...s }
    );
  } else {
    // 當日無快照 → 新增
    updated = [...snapshots.map(s => ({ ...s })), { date: today, netWorth }];
  }

  // 限制快照數量：保留最近 MAX_SNAPSHOTS 筆
  if (updated.length > MAX_SNAPSHOTS) {
    updated = updated
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-MAX_SNAPSHOTS);
  }

  return updated;
}

/**
 * 依時間範圍篩選快照，回傳在指定範圍內的快照陣列（依日期升序排列）。
 *
 * 支援 range：
 *   '1w'  — 最近 7 天
 *   '1m'  — 最近 30 天
 *   '6m'  — 最近 180 天
 *   '1y'  — 最近 365 天
 *   'all' — 全部
 *
 * @param {Array<{date: string, netWorth: number}>} snapshots  快照陣列
 * @param {'1w' | '1m' | '6m' | '1y' | 'all'} range  時間範圍
 * @returns {Array<{date: string, netWorth: number}>}  篩選後的快照陣列
 */
export function filterSnapshotsByRange(snapshots, range) {
  // 'all' 回傳全部（依日期升序）
  if (range === 'all') {
    return [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  }

  const days = RANGE_DAYS[range];

  // 未知 range 視為 'all'
  if (days === undefined) {
    return [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  }

  // 計算截止日期（今日往前 days 天）
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - days);

  // 格式化截止日期為 YYYY-MM-DD
  const cutoffStr = formatDateString(cutoff);

  return snapshots
    .filter(s => s.date >= cutoffStr)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * 依自訂日期範圍篩選快照，回傳在指定範圍內的快照陣列（依日期升序排列）。
 *
 * @param {Array<{date: string, netWorth: number}>} snapshots  快照陣列
 * @param {string} startDate  起始日期（YYYY-MM-DD）
 * @param {string} endDate    結束日期（YYYY-MM-DD）
 * @returns {Array<{date: string, netWorth: number}>}  篩選後的快照陣列
 */
export function filterSnapshotsByCustomRange(snapshots, startDate, endDate) {
  return snapshots
    .filter(s => s.date >= startDate && s.date <= endDate)
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ─── 內部輔助 ────────────────────────────────────────────────────────────────

/**
 * 將 Date 物件格式化為 YYYY-MM-DD 字串。
 * @param {Date} date
 * @returns {string}
 */
function formatDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
