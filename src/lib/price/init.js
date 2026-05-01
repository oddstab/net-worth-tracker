/**
 * Price System 初始化 — 註冊所有 Price Provider 並設定自動更新。
 *
 * 在應用程式啟動時呼叫 initPriceSystem() 以：
 * 1. 註冊 TWSE 與 CoinGecko Provider 至全域 Registry
 * 2. 設定每 1 分鐘自動更新價格
 * 3. 每 10 分鐘強制更新一次
 */
import { registry } from './registry.js';
import { TWSEPriceProvider } from './twseProvider.js';
import { CoinGeckoPriceProvider } from './coinGeckoProvider.js';
import { fetchAllPrices, startPriceAutoRefresh } from './priceFetcher.js';

/** 自動更新間隔：1 分鐘 */
const AUTO_REFRESH_INTERVAL = 60 * 1000;

/** 強制更新間隔：10 分鐘 */
const FORCE_REFRESH_INTERVAL = 10 * 60 * 1000;

/** 上次更新時間戳 */
let lastUpdateTime = 0;

/** 自動更新 interval ID */
let autoRefreshId = null;

/**
 * 初始化價格系統：註冊 Provider 並啟動自動更新。
 * @param {Object} options
 * @param {Function} options.getAssets - 取得當前資產陣列的函式
 * @param {Function} options.onPricesUpdated - 價格更新後的回呼（接收更新後的資產陣列與更新數量）
 * @param {Function} [options.showToast] - 顯示 Toast 通知的函式
 */
export function initPriceSystem({ getAssets, onPricesUpdated, showToast }) {
  // 註冊 Provider
  try {
    registry.register(new TWSEPriceProvider());
  } catch {
    /* 已註冊則忽略 */
  }

  try {
    registry.register(new CoinGeckoPriceProvider());
  } catch {
    /* 已註冊則忽略 */
  }

  // 價格更新函式
  async function updatePrices(force = false) {
    const now = Date.now();

    // 非強制更新時，檢查是否在自動更新間隔內
    if (!force && lastUpdateTime > 0 && (now - lastUpdateTime) < AUTO_REFRESH_INTERVAL) {
      return;
    }

    const assets = getAssets();
    if (!assets || assets.length === 0) return;

    try {
      const updatedAssets = await fetchAllPrices(assets);

      // 計算實際更新了幾個資產
      let updatedCount = 0;
      for (let i = 0; i < assets.length; i++) {
        if (updatedAssets[i].pricePerUnit !== assets[i].pricePerUnit) {
          updatedCount++;
        }
      }

      if (updatedCount > 0) {
        onPricesUpdated(updatedAssets, updatedCount);
        if (showToast) {
          showToast(`已更新 ${updatedCount} 個資產的價格`, 'success');
        }
      }

      lastUpdateTime = Date.now();
    } catch {
      /* 靜默失敗，退避機制已在 fetchAllPrices 內處理 */
    }
  }

  // 啟動每 1 分鐘自動更新
  autoRefreshId = startPriceAutoRefresh(() => {
    const now = Date.now();
    const isForce = (now - lastUpdateTime) >= FORCE_REFRESH_INTERVAL;
    updatePrices(isForce);
  }, AUTO_REFRESH_INTERVAL);

  // 回傳控制物件
  return {
    /** 手動觸發一次價格更新 */
    refresh: () => updatePrices(true),

    /** 停止自動更新 */
    stop: () => {
      if (autoRefreshId) {
        clearInterval(autoRefreshId);
        autoRefreshId = null;
      }
    }
  };
}
