/**
 * tdcc.js — 集保戶股權分散表 store
 *
 * 管理 TDCC 排名資料的 Svelte writable store。
 * 提供 fetchRankings() 方法批次取得台股資產的持股排名。
 * API 資料有 24 小時快取，股數變動時只重新計算排名（不重打 API）。
 */

import { writable } from 'svelte/store';
import { batchGetTDCCRanking, clearTDCCCache } from '$lib/services/tdccService.js';

/**
 * Store 值格式：Map<string, { topPercent, level, totalHolders, date, levels }>
 * key = 股票代號
 */
function createTDCCStore() {
  const { subscribe, set } = writable(new Map());

  /** 是否正在載入（防止並行 fetch） */
  let loading = false;

  /** 上次查詢的 stocks 序列化字串（用於偵測變動） */
  let lastKey = '';

  return {
    subscribe,

    /**
     * 批次取得台股資產的 TDCC 排名。
     * 比對 stocks 內容，有變動才重新計算。
     * @param {Array<{ symbol: string, quantity: number }>} stocks - 台股資產陣列
     */
    async fetchRankings(stocks) {
      if (!stocks || stocks.length === 0) return;

      // 序列化比對，避免相同內容重複計算
      const key = stocks.map(s => `${s.symbol}:${s.quantity}`).sort().join(',');
      if (key === lastKey) return;

      if (loading) return;
      loading = true;

      try {
        const results = await batchGetTDCCRanking(stocks);
        set(results);
        lastKey = key;
      } catch (err) {
        console.warn('[TDCC Store] 取得排名失敗:', err.message);
      } finally {
        loading = false;
      }
    },

    /**
     * 清除快取並重新取得。
     * @param {Array<{ symbol: string, quantity: number }>} stocks
     */
    async refresh(stocks) {
      lastKey = '';
      clearTDCCCache();
      await this.fetchRankings(stocks);
    },

    /** 重置 store */
    reset() {
      lastKey = '';
      set(new Map());
    }
  };
}

export const tdccStore = createTDCCStore();
