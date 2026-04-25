/**
 * state.js — 全域狀態管理
 *
 * 提供 AppState 的讀寫、訂閱機制（Observer Pattern）
 * 以及資產、負債、匯率的 CRUD 操作。
 * 每次狀態變更後自動持久化至 localStorage 並通知所有訂閱者。
 */

import {
  loadAllData,
  saveAssets,
  saveLiabilities,
  saveExchangeRate,
  saveSnapshots,
} from './storage.js';
import { autoSnapshot } from './snapshotManager.js';

// ─── 內部狀態 ────────────────────────────────────────────────────────────────

/**
 * @type {{
 *   assets: import('./types.js').Asset[],
 *   liabilities: import('./types.js').Liability[],
 *   exchangeRate: number,
 *   snapshots: import('./types.js').Snapshot[]
 * }}
 */
let AppState = {
  assets: [],
  liabilities: [],
  exchangeRate: 31.5,
  snapshots: [],
};

/** @type {Set<(state: typeof AppState) => void>} */
const listeners = new Set();

// ─── 通知輔助 ────────────────────────────────────────────────────────────────

/**
 * 通知所有訂閱者，傳入當前狀態的淺拷貝。
 */
function notify() {
  const snapshot = { ...AppState };
  for (const listener of listeners) {
    listener(snapshot);
  }
}

// ─── 初始化 ──────────────────────────────────────────────────────────────────

/**
 * 從 storage.js 載入所有資料，初始化 AppState。
 * 若 localStorage 無資料，以空陣列與預設匯率 31.5 初始化。
 */
export function initState() {
  const data = loadAllData();
  AppState = {
    assets: Array.isArray(data.assets) ? data.assets : [],
    liabilities: Array.isArray(data.liabilities) ? data.liabilities : [],
    exchangeRate: typeof data.exchangeRate === 'number' ? data.exchangeRate : 31.5,
    snapshots: Array.isArray(data.snapshots) ? data.snapshots : [],
  };
}

// ─── 狀態讀寫 ────────────────────────────────────────────────────────────────

/**
 * 回傳當前狀態的淺拷貝，避免外部直接修改內部狀態。
 * @returns {{ assets: import('./types.js').Asset[], liabilities: import('./types.js').Liability[], exchangeRate: number, snapshots: import('./types.js').Snapshot[] }}
 */
export function getState() {
  return { ...AppState };
}

/**
 * 合併部分狀態，自動持久化並通知訂閱者。
 * @param {Partial<typeof AppState>} partial
 */
export function setState(partial) {
  AppState = { ...AppState, ...partial };

  // 持久化所有欄位
  if ('assets' in partial) saveAssets(AppState.assets);
  if ('liabilities' in partial) saveLiabilities(AppState.liabilities);
  if ('exchangeRate' in partial) saveExchangeRate(AppState.exchangeRate);
  if ('snapshots' in partial) saveSnapshots(AppState.snapshots);

  notify();
}

// ─── 訂閱機制 ────────────────────────────────────────────────────────────────

/**
 * 新增訂閱者，回傳取消訂閱函式。
 * @param {(state: typeof AppState) => void} listener
 * @returns {() => void} 取消訂閱函式
 */
export function subscribe(listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// ─── 資產操作 ────────────────────────────────────────────────────────────────

/**
 * 新增資產（asset 需有 id）。
 * @param {import('./types.js').Asset} asset
 */
export function addAsset(asset) {
  const newAssets = [...AppState.assets, asset];
  AppState = { ...AppState, assets: newAssets };
  saveAssets(AppState.assets);
  const newSnapshots = autoSnapshot(AppState.assets, AppState.liabilities, AppState.exchangeRate, AppState.snapshots);
  AppState = { ...AppState, snapshots: newSnapshots };
  saveSnapshots(AppState.snapshots);
  notify();
}

/**
 * 更新指定 id 的資產。
 * @param {string} id
 * @param {Partial<import('./types.js').Asset>} changes
 */
export function updateAsset(id, changes) {
  const newAssets = AppState.assets.map(a =>
    a.id === id ? { ...a, ...changes } : a
  );
  AppState = { ...AppState, assets: newAssets };
  saveAssets(AppState.assets);
  const newSnapshots = autoSnapshot(AppState.assets, AppState.liabilities, AppState.exchangeRate, AppState.snapshots);
  AppState = { ...AppState, snapshots: newSnapshots };
  saveSnapshots(AppState.snapshots);
  notify();
}

/**
 * 刪除指定 id 的資產。
 * @param {string} id
 */
export function removeAsset(id) {
  const newAssets = AppState.assets.filter(a => a.id !== id);
  AppState = { ...AppState, assets: newAssets };
  saveAssets(AppState.assets);
  const newSnapshots = autoSnapshot(AppState.assets, AppState.liabilities, AppState.exchangeRate, AppState.snapshots);
  AppState = { ...AppState, snapshots: newSnapshots };
  saveSnapshots(AppState.snapshots);
  notify();
}

// ─── 負債操作 ────────────────────────────────────────────────────────────────

/**
 * 新增負債（liability 需有 id）。
 * @param {import('./types.js').Liability} liability
 */
export function addLiability(liability) {
  const newLiabilities = [...AppState.liabilities, liability];
  AppState = { ...AppState, liabilities: newLiabilities };
  saveLiabilities(AppState.liabilities);
  const newSnapshots = autoSnapshot(AppState.assets, AppState.liabilities, AppState.exchangeRate, AppState.snapshots);
  AppState = { ...AppState, snapshots: newSnapshots };
  saveSnapshots(AppState.snapshots);
  notify();
}

/**
 * 更新指定 id 的負債。
 * @param {string} id
 * @param {Partial<import('./types.js').Liability>} changes
 */
export function updateLiability(id, changes) {
  const newLiabilities = AppState.liabilities.map(l =>
    l.id === id ? { ...l, ...changes } : l
  );
  AppState = { ...AppState, liabilities: newLiabilities };
  saveLiabilities(AppState.liabilities);
  const newSnapshots = autoSnapshot(AppState.assets, AppState.liabilities, AppState.exchangeRate, AppState.snapshots);
  AppState = { ...AppState, snapshots: newSnapshots };
  saveSnapshots(AppState.snapshots);
  notify();
}

/**
 * 刪除指定 id 的負債。
 * @param {string} id
 */
export function removeLiability(id) {
  const newLiabilities = AppState.liabilities.filter(l => l.id !== id);
  AppState = { ...AppState, liabilities: newLiabilities };
  saveLiabilities(AppState.liabilities);
  const newSnapshots = autoSnapshot(AppState.assets, AppState.liabilities, AppState.exchangeRate, AppState.snapshots);
  AppState = { ...AppState, snapshots: newSnapshots };
  saveSnapshots(AppState.snapshots);
  notify();
}

// ─── 匯率操作 ────────────────────────────────────────────────────────────────

/**
 * 更新匯率，自動持久化並通知訂閱者。
 * @param {number} rate
 */
export function setExchangeRate(rate) {
  AppState = { ...AppState, exchangeRate: rate };
  saveExchangeRate(AppState.exchangeRate);
  notify();
}
