/**
 * exchangeRate.js — 匯率 writable store
 *
 * 使用 Svelte writable store 管理 USD/TWD 匯率。
 * 提供 setExchangeRate 操作，每次操作後自動透過 Storage Service 持久化至 localStorage。
 * 啟動時從 Storage Service 載入初始資料（預設 31.5）。
 */

import { writable } from 'svelte/store';
import { loadExchangeRate, saveExchangeRate } from '$lib/services/storage.js';

/**
 * 建立匯率 store，提供 setExchangeRate 操作。
 *
 * @returns {{
 *   subscribe: Function,
 *   setExchangeRate: (rate: number) => void
 * }}
 */
function createExchangeRateStore() {
  const { subscribe, set } = writable(loadExchangeRate());

  return {
    subscribe,

    /**
     * 設定新匯率並持久化。
     * @param {number} rate — USD/TWD 匯率
     */
    setExchangeRate(rate) {
      set(rate);
      saveExchangeRate(rate);
    }
  };
}

/** 全域匯率 store 單例 */
export const exchangeRate = createExchangeRateStore();
