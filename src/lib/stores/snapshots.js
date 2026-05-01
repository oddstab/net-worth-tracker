/**
 * snapshots.js — 快照 writable store
 *
 * 使用 Svelte writable store 管理每日淨資產快照陣列。
 * 提供快照 CRUD 操作，每次操作後自動透過 Storage Service 持久化至 localStorage。
 * 啟動時從 Storage Service 載入初始資料。
 */

import { writable } from 'svelte/store';
import { loadSnapshots, saveSnapshots } from '$lib/services/storage.js';

/**
 * 建立快照 store，提供 addSnapshot、updateSnapshot、removeSnapshot、replaceAll 操作。
 *
 * @returns {{
 *   subscribe: Function,
 *   addSnapshot: (snapshot: object) => void,
 *   updateSnapshot: (date: string, changes: object) => void,
 *   removeSnapshot: (date: string) => void,
 *   replaceAll: (newSnapshots: Array) => void
 * }}
 */
function createSnapshotStore() {
  const { subscribe, set, update } = writable(loadSnapshots());

  return {
    subscribe,

    /**
     * 新增一筆快照並持久化。
     * @param {{ date: string, netWorth: number }} snapshot — 快照物件
     */
    addSnapshot(snapshot) {
      update(snapshots => {
        const updated = [...snapshots, snapshot];
        saveSnapshots(updated);
        return updated;
      });
    },

    /**
     * 依日期更新快照欄位並持久化。
     * @param {string} date — 快照日期（YYYY-MM-DD）
     * @param {object} changes — 要更新的欄位
     */
    updateSnapshot(date, changes) {
      update(snapshots => {
        const updated = snapshots.map(s => s.date === date ? { ...s, ...changes } : s);
        saveSnapshots(updated);
        return updated;
      });
    },

    /**
     * 依日期移除快照並持久化。
     * @param {string} date — 快照日期（YYYY-MM-DD）
     */
    removeSnapshot(date) {
      update(snapshots => {
        const updated = snapshots.filter(s => s.date !== date);
        saveSnapshots(updated);
        return updated;
      });
    },

    /**
     * 以新陣列取代所有快照並持久化。
     * @param {Array} newSnapshots — 新的快照陣列
     */
    replaceAll(newSnapshots) {
      set(newSnapshots);
      saveSnapshots(newSnapshots);
    }
  };
}

/** 全域快照 store 單例 */
export const snapshots = createSnapshotStore();
