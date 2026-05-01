/**
 * Price Fetcher 協調層 — 負責協調各 Price Provider 進行即時價格抓取。
 *
 * 透過 PriceProviderRegistry 取得對應的 Provider（不直接耦合具體實作），
 * 依資產 type 分組並去重，避免重複 API 呼叫。
 * 包含指數退避機制：前 3 次失敗不退避，之後以 2 的冪次遞增延遲，最大退避 5 分鐘。
 */
import { registry } from './registry.js';

// ─── 指數退避狀態 ─────────────────────────────────────────────────────────────

/** @type {Map<string, { failures: number, nextRetry: number }>} */
const backoffState = new Map();

/** 最大退避時間：5 分鐘 */
const MAX_BACKOFF_MS = 5 * 60 * 1000;

/**
 * 檢查指定 key 是否可以重試。
 * @param {string} key - 退避狀態 key
 * @returns {boolean}
 */
function canRetry(key) {
  const s = backoffState.get(key);
  if (!s) return true;
  return Date.now() >= s.nextRetry;
}

/**
 * 記錄成功，清除退避狀態。
 * @param {string} key - 退避狀態 key
 */
function recordSuccess(key) {
  backoffState.delete(key);
}

/**
 * 記錄失敗，更新退避狀態。
 * 前 3 次失敗不退避，之後以 2^(n-3) 秒遞增，最大 5 分鐘。
 * @param {string} key - 退避狀態 key
 */
function recordFailure(key) {
  const s = backoffState.get(key) || { failures: 0, nextRetry: 0 };
  s.failures++;
  if (s.failures <= 3) {
    s.nextRetry = 0;
  } else {
    const delay = Math.min(1000 * Math.pow(2, s.failures - 3), MAX_BACKOFF_MS);
    s.nextRetry = Date.now() + delay;
  }
  backoffState.set(key, s);
}

// ─── 批次價格抓取 ─────────────────────────────────────────────────────────────

/**
 * 批次抓取所有需要更新的資產價格。
 *
 * 透過 Registry 取得對應 Provider，依 type 分組並去重，
 * 對每個唯一的 (type, symbol) 組合只呼叫一次 Provider 的 fetchPrices。
 *
 * @param {Array<{symbol?: string, type: string, currency?: string}>} assets - 資產陣列
 * @param {import('./registry.js').PriceProviderRegistry} [providerRegistry] - 可選的 Registry 實例（預設使用全域 registry）
 * @returns {Promise<Array>} 更新後的資產陣列
 */
export async function fetchAllPrices(assets, providerRegistry = registry) {
  // 依 type 分組並去重
  /** @type {Map<string, Set<string>>} type → Set<symbol> */
  const grouped = new Map();
  for (const asset of assets) {
    if (!asset.symbol) continue;
    if (!grouped.has(asset.type)) grouped.set(asset.type, new Set());
    grouped.get(asset.type).add(asset.symbol);
  }

  // 透過 Registry 取得對應 Provider 並抓取價格
  /** @type {Map<string, number>} `${type}_${symbol}` → price */
  const priceCache = new Map();

  for (const [type, symbols] of grouped) {
    const provider = providerRegistry.getProviderByType(type);
    if (!provider) continue;

    const backoffKey = `provider_${type}`;
    if (!canRetry(backoffKey)) continue;

    try {
      const results = await provider.fetchPrices([...symbols]);
      for (const [symbol, result] of results) {
        priceCache.set(`${type}_${symbol}`, result.price);
      }
      recordSuccess(backoffKey);
    } catch {
      recordFailure(backoffKey);
    }
  }

  // 套用價格至資產
  return assets.map(asset => {
    if (!asset.symbol) return { ...asset };
    const price = priceCache.get(`${asset.type}_${asset.symbol}`);
    if (price != null) {
      return {
        ...asset,
        pricePerUnit: price,
        priceSource: 'auto',
        lastPriceUpdate: new Date().toISOString()
      };
    }
    return { ...asset };
  });
}

/**
 * 手動設定資產價格。
 * @param {Array} assets - 資產陣列
 * @param {string} id - 資產 ID
 * @param {number} price - 新價格
 * @returns {Array} 更新後的資產陣列
 */
export function setManualPrice(assets, id, price) {
  return assets.map(asset => {
    if (asset.id === id) {
      return { ...asset, pricePerUnit: price, priceSource: 'manual' };
    }
    return { ...asset };
  });
}

/**
 * 啟動自動價格更新排程。
 * @param {Function} callback - 更新回呼函式
 * @param {number} [intervalMs=60000] - 更新間隔（毫秒），預設 1 分鐘
 * @returns {number} setInterval ID
 */
export function startPriceAutoRefresh(callback, intervalMs = 60000) {
  return setInterval(callback, intervalMs);
}

/**
 * 清除退避狀態（用於測試或手動重置）。
 */
export function clearBackoffState() {
  backoffState.clear();
}
