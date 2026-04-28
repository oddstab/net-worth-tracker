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
 * 積極嘗試獲取最新價格，包括盤後價格。
 *
 * @param {string} symbol - 股票代號（例：00631L、2330）
 * @returns {Promise<number | null>} 最新成交價，失敗時回傳 null
 */
export async function fetchTWStockPrice(symbol) {
  console.log(`[PriceFetcher] 開始獲取 ${symbol} 的股價...`);
  
  // 嘗試多個市場和方法
  const markets = ['tse', 'otc'];
  
  for (const market of markets) {
    try {
      const url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=${market}_${encodeURIComponent(symbol)}.tw&json=1&delay=0`;
      console.log(`[PriceFetcher] 嘗試 ${market} 市場: ${url}`);
      
      const response = await fetch(url);
      console.log(`[PriceFetcher] ${symbol} ${market} API回應狀態: ${response.status}`);

      if (!response.ok) {
        console.warn(`[PriceFetcher] ${symbol} ${market} API請求失敗: ${response.statusText}`);
        continue;
      }

      const data = await response.json();
      console.log(`[PriceFetcher] ${symbol} ${market} API數據:`, data);

      const stockInfo = data?.msgArray?.[0];
      if (!stockInfo) {
        console.warn(`[PriceFetcher] ${symbol} ${market} 無股票資訊`);
        continue;
      }

      // 嘗試多個價格欄位
      let price = stockInfo.z; // 最新成交價
      if (!price || price === '-') {
        price = stockInfo.y; // 昨收價
      }
      if (!price || price === '-') {
        price = stockInfo.o; // 開盤價
      }

      if (price && price !== '-') {
        const parsed = parseFloat(price);
        if (!isNaN(parsed) && parsed > 0) {
          console.log(`[PriceFetcher] ${symbol} 成功獲取價格: ${parsed} (來源: ${market}, 更新時間: ${stockInfo?.t || '未知'})`);
          return parsed;
        }
      }
    } catch (error) {
      console.error(`[PriceFetcher] ${symbol} ${market} 獲取價格時發生錯誤:`, error);
      continue;
    }
  }

  // 如果即時API都失敗，嘗試從每日資料獲取
  console.log(`[PriceFetcher] ${symbol} 即時API失敗，嘗試每日資料...`);
  try {
    // 動態導入searchService來避免循環依賴
    const { getTWStockDetail } = await import('./searchService.js');
    const detail = await getTWStockDetail(symbol);
    if (detail && detail.price) {
      console.log(`[PriceFetcher] ${symbol} 從每日資料獲取價格: ${detail.price}`);
      return detail.price;
    }
  } catch (error) {
    console.error(`[PriceFetcher] ${symbol} 從每日資料獲取價格失敗:`, error);
  }

  console.error(`[PriceFetcher] ${symbol} 所有方法都無法獲取價格`);
  return null;
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
    console.warn(`[PriceFetcher] 不支援的加密貨幣代號: ${symbol}`);
    return null;
  }

  console.log(`[PriceFetcher] 開始獲取 ${symbol} (${coinId}) 的價格...`);

  try {
    const currencyLower = currency.toLowerCase();
    const url = `${COINGECKO_API_BASE}?ids=${encodeURIComponent(coinId)}&vs_currencies=${encodeURIComponent(currencyLower)}`;
    console.log(`[PriceFetcher] 請求URL: ${url}`);
    
    const response = await fetch(url);
    console.log(`[PriceFetcher] ${symbol} CoinGecko API回應狀態: ${response.status}`);

    if (!response.ok) {
      console.warn(`[PriceFetcher] ${symbol} CoinGecko API請求失敗: ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    console.log(`[PriceFetcher] ${symbol} CoinGecko API數據:`, data);

    // 解析 { "bitcoin": { "twd": 2443703 } }
    const price = data?.[coinId]?.[currencyLower];

    if (price === undefined || price === null) {
      console.warn(`[PriceFetcher] ${symbol} 無有效價格數據`);
      return null;
    }

    const parsed = parseFloat(price);
    if (isNaN(parsed)) {
      console.warn(`[PriceFetcher] ${symbol} 價格解析失敗: ${price}`);
      return null;
    }

    console.log(`[PriceFetcher] ${symbol} 成功獲取價格: ${parsed} ${currency}`);
    return parsed;
  } catch (error) {
    console.error(`[PriceFetcher] ${symbol} 獲取價格時發生錯誤:`, error);
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
  console.log(`[PriceFetcher] 開始批次更新 ${assets.length} 個資產的價格...`);
  
  // 並行抓取所有需要更新的資產價格
  const updatedAssets = await Promise.all(
    assets.map(async (asset, index) => {
      console.log(`[PriceFetcher] 處理資產 ${index + 1}/${assets.length}: ${asset.name || asset.symbol} (${asset.type})`);
      
      let newPrice = null;

      if (asset.type === 'tw_stock' && asset.symbol) {
        newPrice = await fetchTWStockPrice(asset.symbol);
      } else if (asset.type === 'crypto' && asset.symbol) {
        newPrice = await fetchCryptoPrice(asset.symbol, asset.currency);
      } else {
        console.log(`[PriceFetcher] 跳過資產 ${asset.name || asset.symbol}: 類型 ${asset.type} 不支援自動更新`);
      }

      // 成功時更新價格資訊，失敗時保留原有資料
      if (newPrice !== null) {
        console.log(`[PriceFetcher] ✅ ${asset.name || asset.symbol} 價格更新: ${asset.pricePerUnit} → ${newPrice}`);
        return {
          ...asset,
          pricePerUnit: newPrice,
          priceSource: 'auto',
          lastPriceUpdate: new Date().toISOString(),
        };
      } else {
        console.log(`[PriceFetcher] ❌ ${asset.name || asset.symbol} 價格更新失敗，保持原價格: ${asset.pricePerUnit}`);
      }

      return { ...asset };
    })
  );

  const updatedCount = updatedAssets.filter((asset, index) => 
    asset.pricePerUnit !== assets[index].pricePerUnit
  ).length;
  
  console.log(`[PriceFetcher] 批次更新完成，成功更新 ${updatedCount}/${assets.length} 個資產`);
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
 * @param {number} [intervalMs=30000] - 更新間隔（毫秒），預設 30 秒
 * @returns {number} setInterval 的 ID，可用於 clearInterval 停止自動更新
 */
export function startPriceAutoRefresh(callback, intervalMs = 30000) {
  console.log(`[PriceFetcher] 啟動自動價格更新，間隔 ${intervalMs/1000} 秒`);
  return setInterval(callback, intervalMs);
}

/**
 * 手動觸發價格更新
 * @returns {Promise<void>}
 */
export async function manualPriceRefresh() {
  console.log('[PriceFetcher] 手動觸發價格更新...');
  
  // 觸發自定義事件，通知應用程式執行價格更新
  const event = new CustomEvent('manualPriceRefresh');
  window.dispatchEvent(event);
}
