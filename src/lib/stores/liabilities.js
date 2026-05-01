/**
 * liabilities.js — 負債 writable store
 *
 * 使用 Svelte writable store 管理負債陣列。
 * 提供 CRUD 操作，每次操作後自動透過 Storage Service 持久化至 localStorage。
 * 啟動時從 Storage Service 載入初始資料。
 */

import { writable } from 'svelte/store';
import { loadLiabilities, saveLiabilities } from '$lib/services/storage.js';

/**
 * 建立負債 store，提供 addLiability、updateLiability、removeLiability、replaceAll 操作。
 *
 * @returns {{
 *   subscribe: Function,
 *   addLiability: (liability: object) => void,
 *   updateLiability: (id: string, changes: object) => void,
 *   removeLiability: (id: string) => void,
 *   replaceAll: (newLiabilities: Array) => void
 * }}
 */
function createLiabilityStore() {
  const { subscribe, set, update } = writable(loadLiabilities());

  return {
    subscribe,

    /**
     * 新增一筆負債並持久化。
     * @param {object} liability — 負債物件
     */
    addLiability(liability) {
      update(liabilities => {
        const updated = [...liabilities, liability];
        saveLiabilities(updated);
        return updated;
      });
    },

    /**
     * 依 id 更新負債欄位並持久化。
     * @param {string} id — 負債 UUID
     * @param {object} changes — 要更新的欄位
     */
    updateLiability(id, changes) {
      update(liabilities => {
        const updated = liabilities.map(l => l.id === id ? { ...l, ...changes } : l);
        saveLiabilities(updated);
        return updated;
      });
    },

    /**
     * 依 id 移除負債並持久化。
     * @param {string} id — 負債 UUID
     */
    removeLiability(id) {
      update(liabilities => {
        const updated = liabilities.filter(l => l.id !== id);
        saveLiabilities(updated);
        return updated;
      });
    },

    /**
     * 以新陣列取代所有負債並持久化。
     * @param {Array} newLiabilities — 新的負債陣列
     */
    replaceAll(newLiabilities) {
      set(newLiabilities);
      saveLiabilities(newLiabilities);
    }
  };
}

/** 全域負債 store 單例 */
export const liabilities = createLiabilityStore();
