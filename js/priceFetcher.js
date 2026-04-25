/**
 * priceFetcher.js — 台股與加密貨幣價格抓取
 *
 * 提供從 TWSE 與 CoinGecko API 自動抓取資產價格的功能。
 * 所有 fetch 呼叫包在 try/catch 中，失敗時回傳 null 並保留原有價格。
 */

// ─── 常數 ────────────────────────────────────────────────────────────────────

const TWSE_API_BASE = 'https://mis.twse.com.tw/stock/api/getStockInfo.jsp';
const COINGECKO_API_BASE = 'https://api.coingecko.com/api/v3/simple/price';

/**
 * 加密貨幣代號對照表（symbol → CoinGecko ID）
 * @type {Record<string, string>}
 */
const CRYPTO_ID_MAP = {
  'BTC': 'bitcoin',
  'ETH': 'ethereum',
  'USDT': 'tether',
  'BNB': 'binancecoin',
  'SOL': 'solana',
  'USDC': 'usd-coin',
};

// ─── 台股價格抓取 ─────────────────────────────────────────────────────────────

/**
 * 從 TWSE API 抓取台股最新成交價。
 * 僅在台股交易時間（週一至週五 09:00–13:30）回傳即時價格，盤後回傳收盤價。
 *
 * @param {string} symbol - 股票代號（例：00631L、2330）
 * @returns {Promise<number | null>} 最新成交價，失敗時回傳 null
 */
export async function fetchTWStockPrice(symbol) {
  try {
    const url = `${TWSE_API_BASE}?ex_ch=tse_${encodeURIComponent(symbol)}.tw&json=1&delay=0`;
    const response = await fetch(url);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    // 解析 msgArray[0].z（最新成交價）
    const price = data?.msgArray?.[0]?.z;

    if (price === undefined || price === null || price === '-') {
      return null;
    }

    const parsed = parseFloat(price);
    return isNaN(parsed) ? null : parsed;
  } catch {
    return null;
  }
}

// ─── 加密貨幣價格抓取 ─────────────────────────────────────────────────────────

/**
 * 從 CoinGecko API 抓取加密貨幣即時價格。
 * CoinGecko 免費 API 每分鐘限制 10–30 次請求。
 *
 * @param {string} symbol - 加密貨幣代號（例：BTC、ETH）
 * @param {'TWD' | 'USD'} [currency='TWD'] - 目標幣別
 * @returns {Promise<number | null>} 即時價格，失敗或 symbol 不在 map 中時回傳 null
 */
export async function fetchCryptoPrice(symbol, currency = 'TWD') {
  const coinId = CRYPTO_ID_MAP[symbol?.toUpperCase()];

  if (!coinId) {
    return null;
  }

  try {
    const currencyLower = currency.toLowerCase();
    const url = `${COINGECKO_API_BASE}?ids=${encodeURIComponent(coinId)}&vs_currencies=${encodeURIComponent(currencyLower)}`;
    const response = await fetch(url);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    // 解析 { "bitcoin": { "twd": 2443703 } }
    const price = data?.[coinId]?.[currencyLower];

    if (price === undefined || price === null) {
      return null;
    }

    const parsed = parseFloat(price);
    return isNaN(parsed) ? null : parsed;
  } catch {
    return null;
  }
}

// ─── 批次價格抓取 ─────────────────────────────────────────────────────────────

/**
 * 批次抓取所有需要更新的資產價格。
 * 對 type === 'tw_stock' 的資產呼叫 fetchTWStockPrice，
 * 對 type === 'crypto' 的資產呼叫 fetchCryptoPrice。
 *
 * 成功時：更新 pricePerUnit、priceSource = 'auto'、lastPriceUpdate（ISO 8601）
 * 失敗時：保留原有 pricePerUnit，不修改資產資料
 *
 * @param {import('./types.js').Asset[]} assets - 資產陣列
 * @returns {Promise<import('./types.js').Asset[]>} 更新後的新資產陣列（不修改原陣列）
 */
export async function fetchAllPrices(assets) {
  // 並行抓取所有需要更新的資產價格
  const updatedAssets = await Promise.all(
    assets.map(async (asset) => {
      let newPrice = null;

      if (asset.type === 'tw_stock' && asset.symbol) {
        newPrice = await fetchTWStockPrice(asset.symbol);
      } else if (asset.type === 'crypto' && asset.symbol) {
        newPrice = await fetchCryptoPrice(asset.symbol, asset.currency);
      }

      // 成功時更新價格資訊，失敗時保留原有資料
      if (newPrice !== null) {
        return {
          ...asset,
          pricePerUnit: newPrice,
          priceSource: 'auto',
          lastPriceUpdate: new Date().toISOString(),
        };
      }

      return { ...asset };
    })
  );

  return updatedAssets;
}

// ─── 手動設定價格 ─────────────────────────────────────────────────────────────

/**
 * 手動設定指定資產的每單位價格。
 * 設定後 priceSource 標記為 'manual'，覆蓋自動抓取的價格。
 *
 * @param {import('./types.js').Asset[]} assets - 資產陣列
 * @param {string} id - 資產 ID
 * @param {number} price - 手動設定的每單位價格
 * @returns {import('./types.js').Asset[]} 更新後的新資產陣列（不修改原陣列）
 */
export function setManualPrice(assets, id, price) {
  return assets.map((asset) => {
    if (asset.id === id) {
      return {
        ...asset,
        pricePerUnit: price,
        priceSource: 'manual',
      };
    }
    return { ...asset };
  });
}

// ─── 自動更新排程 ─────────────────────────────────────────────────────────────

/**
 * 啟動價格自動更新排程。
 * 每 intervalMs 毫秒呼叫一次 callback（callback 負責呼叫 fetchAllPrices 並更新 state）。
 *
 * @param {() => void} callback - 每次更新時執行的回呼函式
 * @param {number} [intervalMs=300000] - 更新間隔（毫秒），預設 5 分鐘
 * @returns {number} setInterval 的 ID，可用於 clearInterval 停止自動更新
 */
export function startPriceAutoRefresh(callback, intervalMs = 300000) {
  return setInterval(callback, intervalMs);
}
