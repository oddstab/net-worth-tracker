/**
 * idb.js — IndexedDB 封裝模組
 *
 * 提供簡潔的 Promise-based API 操作 IndexedDB。
 * 資料庫名稱：nwt_db
 * 使用單一 object store「keyval」以 key-value 方式儲存，
 * 與原有 localStorage 的 key 結構保持一致。
 *
 * 設計原則：
 * - 所有操作回傳 Promise
 * - 自動處理資料庫版本升級
 * - 首次使用時自動從 localStorage 遷移既有資料
 */

/** 資料庫名稱 */
const DB_NAME = 'nwt_db';

/** 資料庫版本 */
const DB_VERSION = 1;

/** Object Store 名稱 */
const STORE_NAME = 'keyval';

/** 需要遷移的 localStorage keys */
const MIGRATION_KEYS = [
  'nwt_assets',
  'nwt_liabilities',
  'nwt_exchange_rate',
  'nwt_snapshots',
  'nwt_display_currency',
  'nwt_exchange_rate_map',
];

/** @type {IDBDatabase | null} */
let dbInstance = null;

/** @type {Promise<IDBDatabase> | null} */
let dbPromise = null;

/**
 * 開啟（或取得已開啟的）IndexedDB 連線。
 * 首次呼叫時建立資料庫與 object store，並執行 localStorage 遷移。
 *
 * @returns {Promise<IDBDatabase>}
 */
function openDB() {
  if (dbInstance) return Promise.resolve(dbInstance);
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;

      // 監聽 versionchange 事件，避免阻擋其他 tab 的升級
      dbInstance.onversionchange = () => {
        dbInstance.close();
        dbInstance = null;
        dbPromise = null;
      };

      resolve(dbInstance);
    };

    request.onerror = (event) => {
      dbPromise = null;
      reject(new Error(`IndexedDB 開啟失敗：${event.target.error?.message}`));
    };
  });

  return dbPromise;
}

/**
 * 從 IndexedDB 讀取指定 key 的值。
 *
 * @param {string} key — 儲存的 key
 * @returns {Promise<*>} 儲存的值，若不存在回傳 undefined
 */
export async function getItem(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(key);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error(`IDB 讀取失敗（key: ${key}）：${request.error?.message}`));
  });
}

/**
 * 將值寫入 IndexedDB 指定 key。
 *
 * @param {string} key — 儲存的 key
 * @param {*} value — 要儲存的值（必須是 structured clone 可序列化的）
 * @returns {Promise<void>}
 */
export async function setItem(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(value, key);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error(`IDB 寫入失敗（key: ${key}）：${request.error?.message}`));
  });
}

/**
 * 從 IndexedDB 刪除指定 key。
 *
 * @param {string} key — 要刪除的 key
 * @returns {Promise<void>}
 */
export async function removeItem(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(key);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error(`IDB 刪除失敗（key: ${key}）：${request.error?.message}`));
  });
}

/**
 * 清除 IndexedDB 中所有資料。
 *
 * @returns {Promise<void>}
 */
export async function clear() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error(`IDB 清除失敗：${request.error?.message}`));
  });
}

/**
 * 取得 IndexedDB 中所有 key。
 *
 * @returns {Promise<string[]>}
 */
export async function getAllKeys() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAllKeys();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error(`IDB 取得 keys 失敗：${request.error?.message}`));
  });
}

/**
 * 從 localStorage 遷移資料至 IndexedDB。
 *
 * 遷移邏輯：
 * 1. 檢查 IDB 中是否已有 `_migrated` 標記
 * 2. 若已遷移過，跳過
 * 3. 若未遷移，將所有 nwt_* key 的資料從 localStorage 搬到 IDB
 * 4. 寫入 `_migrated` 標記
 * 5. 遷移完成後不刪除 localStorage 資料（作為備份）
 *
 * @returns {Promise<boolean>} 是否執行了遷移（true = 有遷移，false = 已遷移過或無資料）
 */
export async function migrateFromLocalStorage() {
  const db = await openDB();

  // 檢查是否已遷移
  const migrated = await getItem('_migrated');
  if (migrated) return false;

  // 檢查 localStorage 是否有資料
  const hasData = MIGRATION_KEYS.some(key => localStorage.getItem(key) !== null);
  if (!hasData) {
    // 沒有舊資料，直接標記為已遷移
    await setItem('_migrated', true);
    return false;
  }

  // 執行遷移：逐一將 localStorage 資料寫入 IDB
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);

  for (const key of MIGRATION_KEYS) {
    const raw = localStorage.getItem(key);
    if (raw !== null) {
      try {
        const value = JSON.parse(raw);
        store.put(value, key);
      } catch {
        // JSON 解析失敗，跳過此 key
        console.warn(`遷移跳過 key "${key}"：JSON 解析失敗`);
      }
    }
  }

  // 標記遷移完成
  store.put(true, '_migrated');

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => {
      console.info('IndexedDB 遷移完成：已從 localStorage 搬移資料');
      resolve(true);
    };
    tx.onerror = () => {
      reject(new Error(`IndexedDB 遷移失敗：${tx.error?.message}`));
    };
  });
}

/**
 * 初始化 IndexedDB：開啟連線並執行遷移。
 * 應在 App 啟動時呼叫一次。
 *
 * @returns {Promise<void>}
 */
export async function initDB() {
  await openDB();
  await migrateFromLocalStorage();
}
