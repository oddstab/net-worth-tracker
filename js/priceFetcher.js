/**
 * priceFetcher.js — 台股與加密貨幣價格抓取
 *
 * 提供從 TWSE 與 CoinGecko API 自動抓取資產價格的功能。
 * 所有 fetch 呼叫包在 try/catch 中，失敗時回傳 null 並保留原有價格。
 * 包含指數退避機制，避免 API 失敗時頻繁重試。
 */

// ─── 常數 ────────────────────────────────────────────────────────────────────

const COINGECKO_API_BASE = 'https://api.coingecko.com/api/v3/simple/price';

const CRYPTO_ID_MAP = {
  'BTC': 'bitcoin',
  'ETH': 'ethereum',
  'USDT': 'tether',
  'BNB': 'binancecoin',
  'SOL': 'solana',
  'USDC': 'usd-coin',
};

// ─── 指數退避 ─────────────────────────────────────────────────────────────────

/** @type {Map<string, { failures: number, nextRetry: number }>} */
const backoffState = new Map();
const MAX_BACKOFF_MS = 10 * 60 * 1000; // 最大退避 10 分鐘

function canRetry(key) {
  const s = backoffState.get(key);
  if (!s) return true;
  return Date.now() >= s.nextRetry;
}

function recordSuccess(key) {
  backoffState.delete(key);
}

function recordFailure(key) {
  const s = backoffState.get(key) || { failures: 0, nextRetry: 0 };
  s.failures++;
  const delay = Math.min(1000 * Math.pow(2, s.failures), MAX_BACKOFF_MS);
  s.nextRetry = Date.now() + delay;
  backoffState.set(key, s);
}

// ─── 台股價格抓取 ─────────────────────────────────────────────────────────────

/**
 * 從 TWSE API 抓取台股最新成交價。
 * @param {string} symbol - 股票代號
 * @returns {Promise<number | null>}
 */
export async function fetchTWStockPrice(symbol) {
  const bkey = `tw_${symbol}`;
  if (!canRetry(bkey)) return null;

  const markets = ['tse', 'otc'];
  
  for (const market of markets) {
    try {
      const url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=${market}_${encodeURIComponent(symbol)}.tw&json=1&delay=0`;
      const response = await fetch(url);
      if (!response.ok) continue;

      const data = await response.json();
      const stockInfo = data?.msgArray?.[0];
      if (!stockInfo) continue;

      let price = stockInfo.z;
      if (!price || price === '-') price = stockInfo.y;
      if (!price || price === '-') price = stockInfo.o;

      if (price && price !== '-') {
        const parsed = parseFloat(price);
        if (!isNaN(parsed) && parsed > 0) {
          recordSuccess(bkey);
          return parsed;
        }
      }
    } catch {
      continue;
    }
  }

  // 即時 API 失敗，嘗試每日資料
  try {
    const { getTWStockDetail } = await import('./searchService.js');
    const detail = await getTWStockDetail(symbol);
    if (detail?.price) {
      recordSuccess(bkey);
      return detail.price;
    }
  } catch { /* ignore */ }

  recordFailure(bkey);
  return null;
}

// ─── 加密貨幣價格抓取 ─────────────────────────────────────────────────────────

/**
 * 從 CoinGecko API 抓取加密貨幣即時價格。
 * @param {string} symbol
 * @param {'TWD' | 'USD'} [currency='TWD']
 * @returns {Promise<number | null>}
 */
export async function fetchCryptoPrice(symbol, currency = 'TWD') {
  const coinId = CRYPTO_ID_MAP[symbol?.toUpperCase()];
  if (!coinId) return null;

  const bkey = `crypto_${coinId}`;
  if (!canRetry(bkey)) return null;

  try {
    const currencyLower = currency.toLowerCase();
    const url = `${COINGECKO_API_BASE}?ids=${encodeURIComponent(coinId)}&vs_currencies=${encodeURIComponent(currencyLower)}`;
    const response = await fetch(url);
    if (!response.ok) { recordFailure(bkey); return null; }

    const data = await response.json();
    const price = data?.[coinId]?.[currencyLower];
    if (price == null) { recordFailure(bkey); return null; }

    const parsed = parseFloat(price);
    if (isNaN(parsed)) { recordFailure(bkey); return null; }

    recordSuccess(bkey);
    return parsed;
  } catch {
    recordFailure(bkey);
    return null;
  }
}

// ─── 批次價格抓取 ─────────────────────────────────────────────────────────────

/**
 * 批次抓取所有需要更新的資產價格。
 * 相同 symbol 只抓一次，結果共用。
 * @param {import('./types.js').Asset[]} assets
 * @returns {Promise<import('./types.js').Asset[]>}
 */
export async function fetchAllPrices(assets) {
  // 去重：相同 symbol + type 只抓一次
  const priceCache = new Map();
  const fetchPromises = [];

  for (const asset of assets) {
    if (!asset.symbol) continue;
    const key = `${asset.type}_${asset.symbol}`;
    if (priceCache.has(key)) continue;

    const promise = (async () => {
      let price = null;
      if (asset.type === 'tw_stock') {
        price = await fetchTWStockPrice(asset.symbol);
      } else if (asset.type === 'crypto') {
        price = await fetchCryptoPrice(asset.symbol, asset.currency);
      }
      priceCache.set(key, price);
    })();
    priceCache.set(key, null); // placeholder
    fetchPromises.push(promise);
  }

  await Promise.all(fetchPromises);

  // 套用價格
  return assets.map(asset => {
    if (!asset.symbol) return { ...asset };
    const key = `${asset.type}_${asset.symbol}`;
    const newPrice = priceCache.get(key);
    if (newPrice !== null && newPrice !== undefined) {
      return {
        ...asset,
        pricePerUnit: newPrice,
        priceSource: 'auto',
        lastPriceUpdate: new Date().toISOString(),
      };
    }
    return { ...asset };
  });
}

// ─── 手動設定價格 ─────────────────────────────────────────────────────────────

export function setManualPrice(assets, id, price) {
  return assets.map(asset => {
    if (asset.id === id) {
      return { ...asset, pricePerUnit: price, priceSource: 'manual' };
    }
    return { ...asset };
  });
}

// ─── 自動更新排程 ─────────────────────────────────────────────────────────────

export function startPriceAutoRefresh(callback, intervalMs = 120000) {
  return setInterval(callback, intervalMs);
}

export async function manualPriceRefresh() {
  window.dispatchEvent(new CustomEvent('manualPriceRefresh'));
}
