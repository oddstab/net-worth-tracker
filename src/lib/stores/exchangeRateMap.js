/**
 * exchangeRateMap.js — 多幣別匯率對照表 writable store
 *
 * 管理 TWD 對各目標貨幣的匯率對照表。
 * 啟動時從 localStorage 載入初始值，
 * 提供 setRate() 與 setAll() 方法，每次操作後自動持久化至 localStorage。
 * 更新 USD 匯率時同步更新既有 exchangeRate store，確保向後相容。
 */

import { writable } from 'svelte/store';
import { loadExchangeRateMap, saveExchangeRateMap } from '$lib/services/storage.js';
import { exchangeRate } from '$lib/stores/exchangeRate.js';

/** 各貨幣小數位設定 */
export const CURRENCY_DECIMALS = {
  TWD: 0,
  USD: 2,
  CNY: 2,
  JPY: 0,
  KRW: 0,
};

/** 預設匯率（1 外幣 = X TWD） */
export const DEFAULT_RATES = {
  USD: 31.5,
  CNY: 4.35,
  JPY: 0.21,
  KRW: 0.023,
};

/**
 * 驗證匯率值是否為有限正數。
 * 拒絕 NaN、Infinity、負數、零、非數字型別。
 *
 * @param {*} value — 待驗證的值
 * @returns {boolean} 若為有限正數回傳 true，否則回傳 false
 */
export function validateExchangeRate(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/**
 * 同步 USD 匯率至既有 exchangeRate store，確保向後相容。
 *
 * @param {Record<string, number>} rateMap — 當前匯率對照表
 */
function syncLegacyExchangeRate(rateMap) {
  if (rateMap.USD !== undefined) {
    exchangeRate.setExchangeRate(rateMap.USD);
  }
}

/**
 * 建立匯率對照表 store，提供 setRate 與 setAll 操作。
 *
 * @returns {{
 *   subscribe: Function,
 *   setRate: (currency: string, rate: number) => void,
 *   setAll: (rates: Record<string, number>) => void
 * }}
 */
function createExchangeRateMapStore() {
  const initial = { ...loadExchangeRateMap(), TWD: 1 };
  const { subscribe, update, set } = writable(initial);

  return {
    subscribe,

    /**
     * 設定單一幣別匯率並持久化。
     * TWD 匯率固定為 1，不可修改。
     *
     * @param {string} currency — 貨幣代碼
     * @param {number} rate — 匯率值
     */
    setRate(currency, rate) {
      if (currency === 'TWD') return;

      update((current) => {
        const updated = { ...current, [currency]: rate, TWD: 1 };
        saveExchangeRateMap(updated);
        syncLegacyExchangeRate(updated);
        return updated;
      });
    },

    /**
     * 批次設定所有匯率並持久化。
     * TWD 匯率固定為 1，即使傳入也會被覆蓋。
     *
     * @param {Record<string, number>} rates — 匯率對照表
     */
    setAll(rates) {
      const updated = { ...rates, TWD: 1 };
      set(updated);
      saveExchangeRateMap(updated);
      syncLegacyExchangeRate(updated);
    },
  };
}

/** 全域匯率對照表 store 單例 */
export const exchangeRateMap = createExchangeRateMapStore();
