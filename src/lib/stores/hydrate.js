/**
 * hydrate.js — 從 IndexedDB 載入最新資料並更新各 Svelte store
 *
 * 各 store 在建立時使用 localStorage 同步初始化（確保首次渲染有資料），
 * 此模組在 IndexedDB 就緒後，以 IDB 中的資料覆蓋 store，
 * 確保 store 持有最新、最完整的資料。
 *
 * 呼叫時機：App 啟動時，initDB() 完成後。
 */

import { assets } from '$lib/stores/assets.js';
import { liabilities } from '$lib/stores/liabilities.js';
import { snapshots } from '$lib/stores/snapshots.js';
import { exchangeRate } from '$lib/stores/exchangeRate.js';
import { displayCurrency } from '$lib/stores/displayCurrency.js';
import { exchangeRateMap } from '$lib/stores/exchangeRateMap.js';
import {
  loadAssetsAsync,
  loadLiabilitiesAsync,
  loadSnapshotsAsync,
  loadExchangeRateAsync,
  loadDisplayCurrencyAsync,
  loadExchangeRateMapAsync,
} from '$lib/services/storage.js';

/**
 * 從 IndexedDB 載入所有資料並更新對應的 Svelte store。
 * 若 IDB 中的資料與 localStorage 同步初始值相同，store 不會觸發不必要的更新。
 *
 * @returns {Promise<void>}
 */
export async function hydrateStoresFromIDB() {
  try {
    const [
      idbAssets,
      idbLiabilities,
      idbSnapshots,
      idbExchangeRate,
      idbDisplayCurrency,
      idbExchangeRateMap,
    ] = await Promise.all([
      loadAssetsAsync(),
      loadLiabilitiesAsync(),
      loadSnapshotsAsync(),
      loadExchangeRateAsync(),
      loadDisplayCurrencyAsync(),
      loadExchangeRateMapAsync(),
    ]);

    // 以 IDB 資料更新各 store（replaceAll 不會觸發額外的 save，因為資料相同）
    assets.replaceAll(idbAssets);
    liabilities.replaceAll(idbLiabilities);
    snapshots.replaceAll(idbSnapshots);
    exchangeRate.setExchangeRate(idbExchangeRate);
    displayCurrency.set(idbDisplayCurrency);
    exchangeRateMap.setAll(idbExchangeRateMap);
  } catch (err) {
    // IDB 讀取失敗時不影響 App 運作（localStorage 同步初始值仍有效）
    console.warn('IndexedDB hydrate 失敗，使用 localStorage 資料：', err.message);
  }
}
