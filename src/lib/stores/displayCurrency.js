/**
 * displayCurrency.js — 顯示貨幣 writable store
 *
 * 管理使用者選擇的顯示貨幣設定。
 * 啟動時從 localStorage 載入初始值（預設 'TWD'），
 * 每次 set() 時自動透過 Storage Service 持久化至 localStorage。
 */

import { writable } from 'svelte/store';
import { loadDisplayCurrency, saveDisplayCurrency } from '$lib/services/storage.js';

/** 支援的貨幣代碼清單 */
export const SUPPORTED_CURRENCIES = ['TWD', 'USD', 'CNY', 'JPY', 'KRW'];

/** 貨幣代碼對應中文名稱 */
export const CURRENCY_NAMES = {
  TWD: '新台幣',
  USD: '美元',
  CNY: '人民幣',
  JPY: '日圓',
  KRW: '韓元',
};

/**
 * 驗證貨幣代碼是否在支援清單中。
 * 若不在清單中，回退至預設值 'TWD'。
 *
 * @param {string} currency — 待驗證的貨幣代碼
 * @returns {string} 有效的貨幣代碼
 */
function validateCurrency(currency) {
  return SUPPORTED_CURRENCIES.includes(currency) ? currency : 'TWD';
}

/**
 * 建立顯示貨幣 store。
 * 啟動時從 localStorage 讀取初始值，set() 時同步持久化。
 *
 * @returns {{
 *   subscribe: Function,
 *   set: (currency: string) => void
 * }}
 */
function createDisplayCurrencyStore() {
  const initial = validateCurrency(loadDisplayCurrency());
  const { subscribe, set: _set } = writable(initial);

  return {
    subscribe,

    /**
     * 設定顯示貨幣並持久化至 localStorage。
     * @param {string} currency — 貨幣代碼（如 'TWD'、'USD'）
     */
    set(currency) {
      _set(currency);
      saveDisplayCurrency(currency);
    },
  };
}

/** 全域顯示貨幣 store 單例 */
export const displayCurrency = createDisplayCurrencyStore();
