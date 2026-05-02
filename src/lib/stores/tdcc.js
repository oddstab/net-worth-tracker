/**
 * tdcc.js — 集保戶股權分散表 store
 *
 * 管理 TDCC 排名資料的 Svelte writable store。
 * 提供 fetchRankings() 方法批次取得台股資產的持股排名。
 */

import { writable } from 'svelte/store';
import { batchGetTDCCRanking, clearTDCCCache } from '$lib/services/tdccService.js';

/**
 * Store 值格式：Map<string, { topPercent, level, totalHolders, date }>
 * key = 股票代號
 */
function createTDCCStore() {
  const { subscribe, set, update } = writable(new Map());

  /** 是否正在載入 */
  let loading = false;

  return {
    subscribe,

    /**
     * 批次取得台股資產的 TDCC 排名。
     * @param {Array<{ symbol: string, quantity: number }>} stocks - 台股資產陣列
     */
    async fetchRankings(stocks) {
      if (loading) return;
      if (!stocks || stocks.length === 0) return;

      loading = true;
      try {
        const results = await batchGetTDCCRanking(stocks);
        set(results);
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
      clearTDCCCache();
      await this.fetchRankings(stocks);
    },

    /** 重置 store */
    reset() {
      set(new Map());
    }
  };
}

export const tdccStore = createTDCCStore();
