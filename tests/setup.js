/**
 * setup.js — Vitest 全域設定
 *
 * Node.js v22+ 內建的 localStorage 不完整（缺少 clear/removeItem 等標準方法），
 * 此設定檔在測試環境中提供完整的 Web Storage API 實作。
 */

// 檢查 localStorage 是否缺少標準方法（Node.js v22+ 內建版本）
if (typeof localStorage !== 'undefined' && typeof localStorage.clear !== 'function') {
  const store = new Map();

  const storage = {
    getItem(key) {
      const val = store.get(String(key));
      return val === undefined ? null : val;
    },
    setItem(key, value) {
      store.set(String(key), String(value));
    },
    removeItem(key) {
      store.delete(String(key));
    },
    clear() {
      store.clear();
    },
    get length() {
      return store.size;
    },
    key(index) {
      const keys = [...store.keys()];
      return keys[index] ?? null;
    },
  };

  globalThis.localStorage = storage;
}
