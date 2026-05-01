/**
 * storage.js — localStorage 讀寫封裝
 *
 * 從原有 js/storage.js 遷移至 SvelteKit 架構。
 * 使用相同的 localStorage key（nwt_ 前綴），確保資料向後相容。
 *
 * localStorage keys:
 *   nwt_assets        — Asset[]
 *   nwt_liabilities   — Liability[]
 *   nwt_exchange_rate — number
 *   nwt_snapshots     — Snapshot[]
 */

/** localStorage key 常數 */
const KEYS = {
  ASSETS: 'nwt_assets',
  LIABILITIES: 'nwt_liabilities',
  EXCHANGE_RATE: 'nwt_exchange_rate',
  SNAPSHOTS: 'nwt_snapshots',
};

/** 預設匯率（USD/TWD） */
const DEFAULT_EXCHANGE_RATE = 31.5;

// ─── 通用讀寫輔助 ────────────────────────────────────────────────────────────

/**
 * 將值序列化後寫入 localStorage。
 * 寫入失敗時拋出包含 key 名稱的描述性錯誤。
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
 * 若 key 不存在或 JSON.parse 失敗，回傳 fallback 預設值。
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
 * @param {Array} assets
 */
export function saveAssets(assets) {
  writeItem(KEYS.ASSETS, assets);
}

/**
 * 從 localStorage 讀取 Asset[]。
 * 若無資料回傳空陣列。
 * @returns {Array}
 */
export function loadAssets() {
  return readItem(KEYS.ASSETS, []);
}

// ─── 負債 ────────────────────────────────────────────────────────────────────

/**
 * 將 Liability[] 序列化後存入 localStorage。
 * @param {Array} liabilities
 */
export function saveLiabilities(liabilities) {
  writeItem(KEYS.LIABILITIES, liabilities);
}

/**
 * 從 localStorage 讀取 Liability[]。
 * 若無資料回傳空陣列。
 * @returns {Array}
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
 * @param {Array} snapshots
 */
export function saveSnapshots(snapshots) {
  writeItem(KEYS.SNAPSHOTS, snapshots);
}

/**
 * 從 localStorage 讀取 Snapshot[]。
 * 若無資料回傳空陣列。
 * @returns {Array}
 */
export function loadSnapshots() {
  return readItem(KEYS.SNAPSHOTS, []);
}

// ─── 匯出 / 匯入 ─────────────────────────────────────────────────────────────

/**
 * 將所有資料序列化為 JSON 字串（用於下載匯出）。
 * 從 localStorage 讀取所有資料並組合為 AppState 物件。
 * @returns {string} JSON 字串
 */
export function exportData() {
  const appData = {
    assets: loadAssets(),
    liabilities: loadLiabilities(),
    exchangeRate: loadExchangeRate(),
    snapshots: loadSnapshots(),
  };
  return JSON.stringify(appData);
}

/**
 * 解析 JSON 字串並驗證結構，成功後存入 localStorage。
 *
 * 驗證規則：
 * - 必須包含 assets、liabilities、exchangeRate、snapshots 四個欄位
 * - assets 必須為陣列
 * - liabilities 必須為陣列
 * - exchangeRate 必須為數字
 * - snapshots 必須為陣列
 *
 * @param {string} jsonString — 匯入的 JSON 字串
 * @returns {{ assets: Array, liabilities: Array, exchangeRate: number, snapshots: Array }}
 * @throws {Error} 若 JSON 格式無效或缺少必要欄位
 */
export function importData(jsonString) {
  let parsed;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    throw new Error('匯入失敗：JSON 格式無效');
  }

  // 驗證必要欄位存在
  const requiredKeys = ['assets', 'liabilities', 'exchangeRate', 'snapshots'];
  for (const key of requiredKeys) {
    if (!(key in parsed)) {
      throw new Error(`匯入失敗：缺少必要欄位「${key}」`);
    }
  }

  // 驗證欄位型別
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

  // 驗證通過，存入 localStorage
  saveAssets(parsed.assets);
  saveLiabilities(parsed.liabilities);
  saveExchangeRate(parsed.exchangeRate);
  saveSnapshots(parsed.snapshots);

  return parsed;
}
