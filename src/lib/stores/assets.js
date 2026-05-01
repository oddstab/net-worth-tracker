/**
 * assets.js — 資產 writable store
 *
 * 使用 Svelte writable store 管理資產陣列。
 * 提供 CRUD 操作，每次操作後自動透過 Storage Service 持久化至 localStorage。
 * 啟動時從 Storage Service 載入初始資料。
 */

import { writable } from 'svelte/store';
import { loadAssets, saveAssets } from '$lib/services/storage.js';

/**
 * 建立資產 store，提供 addAsset、updateAsset、removeAsset、replaceAll 操作。
 *
 * @returns {{
 *   subscribe: Function,
 *   addAsset: (asset: object) => void,
 *   updateAsset: (id: string, changes: object) => void,
 *   removeAsset: (id: string) => void,
 *   replaceAll: (newAssets: Array) => void
 * }}
 */
function createAssetStore() {
  const { subscribe, set, update } = writable(loadAssets());

  return {
    subscribe,

    /**
     * 新增一筆資產並持久化。
     * @param {object} asset — 資產物件
     */
    addAsset(asset) {
      update(assets => {
        const updated = [...assets, asset];
        saveAssets(updated);
        return updated;
      });
    },

    /**
     * 依 id 更新資產欄位並持久化。
     * @param {string} id — 資產 UUID
     * @param {object} changes — 要更新的欄位
     */
    updateAsset(id, changes) {
      update(assets => {
        const updated = assets.map(a => a.id === id ? { ...a, ...changes } : a);
        saveAssets(updated);
        return updated;
      });
    },

    /**
     * 依 id 移除資產並持久化。
     * @param {string} id — 資產 UUID
     */
    removeAsset(id) {
      update(assets => {
        const updated = assets.filter(a => a.id !== id);
        saveAssets(updated);
        return updated;
      });
    },

    /**
     * 以新陣列取代所有資產並持久化。
     * @param {Array} newAssets — 新的資產陣列
     */
    replaceAll(newAssets) {
      set(newAssets);
      saveAssets(newAssets);
    }
  };
}

/** 全域資產 store 單例 */
export const assets = createAssetStore();
