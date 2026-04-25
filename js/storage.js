/**
 * storage.js — localStorage 讀寫封裝
 *
 * localStorage keys:
 *   nwt_assets        — Asset[]
 *   nwt_liabilities   — Liability[]
 *   nwt_exchange_rate — number
 *   nwt_snapshots     — Snapshot[]
 */

const KEYS = {
  ASSETS: 'nwt_assets',
  LIABILITIES: 'nwt_liabilities',
  EXCHANGE_RATE: 'nwt_exchange_rate',
  SNAPSHOTS: 'nwt_snapshots',
};

const DEFAULT_EXCHANGE_RATE = 31.5;

// ─── 通用讀寫輔助 ────────────────────────────────────────────────────────────

/**
 * 將值序列化後寫入 localStorage。
 * 寫入失敗時拋出 Error。
 * @param {string} key
 * @param {*} value
 */
function writeItem(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    throw new Error(`localStorage 寫入失敗（key: ${key}）：${err.message}`);
  }
}

/**
 * 從 localStorage 讀取並反序列化。
 * 若 key 不存在或解析失敗，回傳 fallback。
 * @param {string} key
 * @param {*} fallback
 * @returns {*}
 */
function readItem(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

// ─── 資產 ────────────────────────────────────────────────────────────────────

/**
 * 將 Asset[] 序列化後存入 localStorage。
 * @param {import('./types.js').Asset[]} assets
 */
export function saveAssets(assets) {
  writeItem(KEYS.ASSETS, assets);
}

/**
 * 從 localStorage 讀取 Asset[]。
 * 若無資料回傳空陣列。
 * @returns {import('./types.js').Asset[]}
 */
export function loadAssets() {
  return readItem(KEYS.ASSETS, []);
}

// ─── 負債 ────────────────────────────────────────────────────────────────────

/**
 * 將 Liability[] 序列化後存入 localStorage。
 * @param {import('./types.js').Liability[]} liabilities
 */
export function saveLiabilities(liabilities) {
  writeItem(KEYS.LIABILITIES, liabilities);
}

/**
 * 從 localStorage 讀取 Liability[]。
 * 若無資料回傳空陣列。
 * @returns {import('./types.js').Liability[]}
 */
export function loadLiabilities() {
  return readItem(KEYS.LIABILITIES, []);
}

// ─── 匯率 ────────────────────────────────────────────────────────────────────

/**
 * 將 USD/TWD 匯率存入 localStorage。
 * @param {number} rate
 */
export function saveExchangeRate(rate) {
  writeItem(KEYS.EXCHANGE_RATE, rate);
}

/**
 * 從 localStorage 讀取 USD/TWD 匯率。
 * 若無資料回傳預設值 31.5。
 * @returns {number}
 */
export function loadExchangeRate() {
  return readItem(KEYS.EXCHANGE_RATE, DEFAULT_EXCHANGE_RATE);
}

// ─── 快照 ────────────────────────────────────────────────────────────────────

/**
 * 將 Snapshot[] 序列化後存入 localStorage。
 * @param {import('./types.js').Snapshot[]} snapshots
 */
export function saveSnapshots(snapshots) {
  writeItem(KEYS.SNAPSHOTS, snapshots);
}

/**
 * 從 localStorage 讀取 Snapshot[]。
 * 若無資料回傳空陣列。
 * @returns {import('./types.js').Snapshot[]}
 */
export function loadSnapshots() {
  return readItem(KEYS.SNAPSHOTS, []);
}

// ─── 批次讀寫 ────────────────────────────────────────────────────────────────

/**
 * 一次讀取所有資料，回傳 AppData 物件。
 * @returns {{ assets: import('./types.js').Asset[], liabilities: import('./types.js').Liability[], exchangeRate: number, snapshots: import('./types.js').Snapshot[] }}
 */
export function loadAllData() {
  return {
    assets: loadAssets(),
    liabilities: loadLiabilities(),
    exchangeRate: loadExchangeRate(),
    snapshots: loadSnapshots(),
  };
}

/**
 * 一次儲存所有資料。
 * @param {{ assets: import('./types.js').Asset[], liabilities: import('./types.js').Liability[], exchangeRate: number, snapshots: import('./types.js').Snapshot[] }} appData
 */
export function saveAllData(appData) {
  saveAssets(appData.assets);
  saveLiabilities(appData.liabilities);
  saveExchangeRate(appData.exchangeRate);
  saveSnapshots(appData.snapshots);
}

// ─── 匯出 / 匯入 ─────────────────────────────────────────────────────────────

/**
 * 將 appData 序列化為 JSON 字串（用於下載）。
 * @param {{ assets: import('./types.js').Asset[], liabilities: import('./types.js').Liability[], exchangeRate: number, snapshots: import('./types.js').Snapshot[] }} appData
 * @returns {string}
 */
export function exportData(appData) {
  return JSON.stringify(appData);
}

/**
 * 解析 JSON 字串並驗證結構。
 * 若格式不符（缺少 assets / liabilities / exchangeRate / snapshots）則拋出 Error。
 * 成功時呼叫 saveAllData 並回傳解析後的資料。
 *
 * @param {string} jsonString
 * @returns {{ assets: import('./types.js').Asset[], liabilities: import('./types.js').Liability[], exchangeRate: number, snapshots: import('./types.js').Snapshot[] }}
 * @throws {Error} 若 JSON 格式不符預期結構
 */
export function importData(jsonString) {
  let parsed;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    throw new Error('匯入失敗：JSON 格式無效');
  }

  const requiredKeys = ['assets', 'liabilities', 'exchangeRate', 'snapshots'];
  for (const key of requiredKeys) {
    if (!(key in parsed)) {
      throw new Error(`匯入失敗：缺少必要欄位「${key}」`);
    }
  }

  if (!Array.isArray(parsed.assets)) {
    throw new Error('匯入失敗：assets 必須為陣列');
  }
  if (!Array.isArray(parsed.liabilities)) {
    throw new Error('匯入失敗：liabilities 必須為陣列');
  }
  if (typeof parsed.exchangeRate !== 'number') {
    throw new Error('匯入失敗：exchangeRate 必須為數字');
  }
  if (!Array.isArray(parsed.snapshots)) {
    throw new Error('匯入失敗：snapshots 必須為陣列');
  }

  saveAllData(parsed);
  return parsed;
}
