/**
 * storage.js — 持久化儲存封裝（IndexedDB + localStorage fallback）
 *
 * 主要儲存層為 IndexedDB（透過 idb.js），
 * localStorage 作為同步讀取的 fallback（用於 store 初始化時的同步載入）。
 *
 * 寫入策略：雙寫（IndexedDB + localStorage），確保：
 * 1. IndexedDB 為主要資料來源（容量大、結構化）
 * 2. localStorage 作為同步快取（store 初始化需要同步值）
 *
 * 讀取策略：
 * - loadXxx()：同步從 localStorage 讀取（用於 store 初始化）
 * - loadXxxAsync()：非同步從 IndexedDB 讀取（用於需要最新資料的場景）
 *
 * localStorage keys（nwt_ 前綴）：
 *   nwt_assets             — Asset[]
 *   nwt_liabilities        — Liability[]
 *   nwt_exchange_rate      — number
 *   nwt_snapshots          — Snapshot[]
 *   nwt_display_currency   — string（顯示貨幣代碼）
 *   nwt_exchange_rate_map  — object（多幣別匯率對照表）
 */

import { getItem, setItem } from '$lib/services/idb.js';

/** localStorage key 常數 */
const KEYS = {
  ASSETS: 'nwt_assets',
  LIABILITIES: 'nwt_liabilities',
  EXCHANGE_RATE: 'nwt_exchange_rate',
  SNAPSHOTS: 'nwt_snapshots',
  DISPLAY_CURRENCY: 'nwt_display_currency',
  EXCHANGE_RATE_MAP: 'nwt_exchange_rate_map',
};

/** 預設匯率（USD/TWD） */
const DEFAULT_EXCHANGE_RATE = 31.5;

/** 預設顯示貨幣 */
const DEFAULT_DISPLAY_CURRENCY = 'TWD';

/** 預設多幣別匯率對照表（1 外幣 = X TWD） */
const DEFAULT_EXCHANGE_RATE_MAP = {
  USD: 31.5,
  CNY: 4.35,
  JPY: 0.21,
  KRW: 0.023,
};

// ─── 通用讀寫輔助 ────────────────────────────────────────────────────────────

/**
 * 將值序列化後寫入 localStorage（同步快取）。
 * @param {string} key
 * @param {*} value
 */
function writeLocalStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`localStorage 寫入失敗（key: ${key}）：${err.message}`);
  }
}

/**
 * 從 localStorage 同步讀取並反序列化。
 * 若 key 不存在或 JSON.parse 失敗，回傳 fallback 預設值。
 * @param {string} key
 * @param {*} fallback
 * @returns {*}
 */
function readLocalStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/**
 * 雙寫：同時寫入 IndexedDB 和 localStorage。
 * IndexedDB 寫入為非同步，不阻塞呼叫端。
 * @param {string} key
 * @param {*} value
 */
function writeItem(key, value) {
  // 同步寫入 localStorage（確保下次同步讀取能拿到最新值）
  writeLocalStorage(key, value);
  // 非同步寫入 IndexedDB（主要儲存）
  setItem(key, value).catch(err => {
    console.warn(`IndexedDB 寫入失敗（key: ${key}）：${err.message}`);
  });
}

/**
 * 從 localStorage 同步讀取（用於 store 初始化）。
 * @param {string} key
 * @param {*} fallback
 * @returns {*}
 */
function readItem(key, fallback) {
  return readLocalStorage(key, fallback);
}

/**
 * 從 IndexedDB 非同步讀取。
 * 若讀取失敗，fallback 至 localStorage。
 * @param {string} key
 * @param {*} fallback
 * @returns {Promise<*>}
 */
async function readItemAsync(key, fallback) {
  try {
    const value = await getItem(key);
    if (value === undefined) return readLocalStorage(key, fallback);
    return value;
  } catch {
    return readLocalStorage(key, fallback);
  }
}

// ─── 資產 ────────────────────────────────────────────────────────────────────

/**
 * 將 Asset[] 持久化（雙寫 IDB + localStorage）。
 * @param {Array} assets
 */
export function saveAssets(assets) {
  writeItem(KEYS.ASSETS, assets);
}

/**
 * 同步從 localStorage 讀取 Asset[]（用於 store 初始化）。
 * @returns {Array}
 */
export function loadAssets() {
  return readItem(KEYS.ASSETS, []);
}

/**
 * 非同步從 IndexedDB 讀取 Asset[]。
 * @returns {Promise<Array>}
 */
export async function loadAssetsAsync() {
  return readItemAsync(KEYS.ASSETS, []);
}

// ─── 負債 ────────────────────────────────────────────────────────────────────

/**
 * 將 Liability[] 持久化（雙寫 IDB + localStorage）。
 * @param {Array} liabilities
 */
export function saveLiabilities(liabilities) {
  writeItem(KEYS.LIABILITIES, liabilities);
}

/**
 * 同步從 localStorage 讀取 Liability[]（用於 store 初始化）。
 * @returns {Array}
 */
export function loadLiabilities() {
  return readItem(KEYS.LIABILITIES, []);
}

/**
 * 非同步從 IndexedDB 讀取 Liability[]。
 * @returns {Promise<Array>}
 */
export async function loadLiabilitiesAsync() {
  return readItemAsync(KEYS.LIABILITIES, []);
}

// ─── 匯率 ────────────────────────────────────────────────────────────────────

/**
 * 將 USD/TWD 匯率持久化（雙寫 IDB + localStorage）。
 * @param {number} rate
 */
export function saveExchangeRate(rate) {
  writeItem(KEYS.EXCHANGE_RATE, rate);
}

/**
 * 同步從 localStorage 讀取 USD/TWD 匯率。
 * @returns {number}
 */
export function loadExchangeRate() {
  return readItem(KEYS.EXCHANGE_RATE, DEFAULT_EXCHANGE_RATE);
}

/**
 * 非同步從 IndexedDB 讀取 USD/TWD 匯率。
 * @returns {Promise<number>}
 */
export async function loadExchangeRateAsync() {
  return readItemAsync(KEYS.EXCHANGE_RATE, DEFAULT_EXCHANGE_RATE);
}

// ─── 顯示貨幣 ────────────────────────────────────────────────────────────────

/**
 * 將顯示貨幣代碼持久化（雙寫 IDB + localStorage）。
 * @param {string} currency — 貨幣代碼（如 'TWD'、'USD'）
 */
export function saveDisplayCurrency(currency) {
  writeItem(KEYS.DISPLAY_CURRENCY, currency);
}

/**
 * 同步從 localStorage 讀取顯示貨幣代碼。
 * @returns {string}
 */
export function loadDisplayCurrency() {
  return readItem(KEYS.DISPLAY_CURRENCY, DEFAULT_DISPLAY_CURRENCY);
}

/**
 * 非同步從 IndexedDB 讀取顯示貨幣代碼。
 * @returns {Promise<string>}
 */
export async function loadDisplayCurrencyAsync() {
  return readItemAsync(KEYS.DISPLAY_CURRENCY, DEFAULT_DISPLAY_CURRENCY);
}

// ─── 匯率對照表 ──────────────────────────────────────────────────────────────

/**
 * 將多幣別匯率對照表持久化（雙寫 IDB + localStorage）。
 * @param {Record<string, number>} rateMap
 */
export function saveExchangeRateMap(rateMap) {
  writeItem(KEYS.EXCHANGE_RATE_MAP, rateMap);
}

/**
 * 同步從 localStorage 讀取多幣別匯率對照表。
 * @returns {Record<string, number>}
 */
export function loadExchangeRateMap() {
  return readItem(KEYS.EXCHANGE_RATE_MAP, DEFAULT_EXCHANGE_RATE_MAP);
}

/**
 * 非同步從 IndexedDB 讀取多幣別匯率對照表。
 * @returns {Promise<Record<string, number>>}
 */
export async function loadExchangeRateMapAsync() {
  return readItemAsync(KEYS.EXCHANGE_RATE_MAP, DEFAULT_EXCHANGE_RATE_MAP);
}

// ─── 快照 ────────────────────────────────────────────────────────────────────

/**
 * 將 Snapshot[] 持久化（雙寫 IDB + localStorage）。
 * @param {Array} snapshots
 */
export function saveSnapshots(snapshots) {
  writeItem(KEYS.SNAPSHOTS, snapshots);
}

/**
 * 同步從 localStorage 讀取 Snapshot[]（用於 store 初始化）。
 * @returns {Array}
 */
export function loadSnapshots() {
  return readItem(KEYS.SNAPSHOTS, []);
}

/**
 * 非同步從 IndexedDB 讀取 Snapshot[]。
 * @returns {Promise<Array>}
 */
export async function loadSnapshotsAsync() {
  return readItemAsync(KEYS.SNAPSHOTS, []);
}

// ─── 匯出 / 匯入 ─────────────────────────────────────────────────────────────

/**
 * 將所有資料序列化為 JSON 字串（用於下載匯出）。
 * 非同步版本，從 IndexedDB 讀取最新資料。
 * @returns {Promise<string>} JSON 字串
 */
export async function exportDataAsync() {
  const [assets, liabilities, exchangeRateVal, snapshots] = await Promise.all([
    loadAssetsAsync(),
    loadLiabilitiesAsync(),
    loadExchangeRateAsync(),
    loadSnapshotsAsync(),
  ]);

  const appData = { assets, liabilities, exchangeRate: exchangeRateVal, snapshots };
  return JSON.stringify(appData);
}

/**
 * 將所有資料序列化為 JSON 字串（同步版本，從 localStorage 讀取）。
 * 保留向後相容。
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
 * 解析 JSON 字串並驗證結構，成功後存入 IndexedDB + localStorage。
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

  // 驗證通過，持久化（雙寫 IDB + localStorage）
  saveAssets(parsed.assets);
  saveLiabilities(parsed.liabilities);
  saveExchangeRate(parsed.exchangeRate);
  saveSnapshots(parsed.snapshots);

  return parsed;
}
