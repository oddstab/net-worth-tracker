/**
 * searchService.js — 股票 / 加密貨幣搜尋與詳細資訊
 *
 * 從原有 js/searchService.js 遷移至 SvelteKit 架構。
 *
 * 台股資料來源：TWSE openapi（全部上市股票，每日更新）
 * CORS 策略：直連優先，被擋時自動走 corsproxy.io
 */

// ─── CORS Proxy ───────────────────────────────────────────────────────────────

const PROXY = 'https://corsproxy.io/?url=';

/**
 * 將 URL 包裝為 corsproxy.io 代理 URL。
 * @param {string} url
 * @returns {string}
 */
function proxied(url) {
  return `${PROXY}${encodeURIComponent(url)}`;
}

/**
 * 依序嘗試 urls，回傳第一個成功的 Response。
 * 用於直連優先、CORS 阻擋時自動走代理。
 * @param {string[]} urls
 * @returns {Promise<Response|null>}
 */
async function fetchWithFallback(urls) {
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (res.ok) return res;
    } catch {
      continue;
    }
  }
  return null;
}

// ─── 安全解析浮點數 ──────────────────────────────────────────────────────────

/**
 * 安全解析浮點數，處理 null、undefined、'-'、空字串等情況。
 * @param {*} val
 * @returns {number|null}
 */
function parseFloatSafe(val) {
  if (val === undefined || val === null || val === '-' || val === '') return null;
  const n = parseFloat(String(val).replace(/,/g, ''));
  return isNaN(n) ? null : n;
}

// ─── ETF 靜態基本資料（不常變動）────────────────────────────────────────────

const ETF_META = {
  '0050':   { feature: '追蹤台灣50指數，投資台股市值前50大上市公司', aum: '3,521 億', listedDate: '2003/06', expenseRatio: '0.43%', holders: '逾 100 萬人', dividendCycle: '季配息', fundType: '股票型ETF', indexCurrency: 'NTD', trackIndex: '臺灣50指數', fundName: '元大台灣卓越50證券投資信託基金' },
  '0056':   { feature: '追蹤台灣高股息指數，精選高殖利率成分股', aum: '2,890 億', listedDate: '2007/12', expenseRatio: '0.66%', holders: '約 113 萬人', dividendCycle: '季配息', fundType: '股票型ETF', indexCurrency: 'NTD', trackIndex: '臺灣高股息指數', fundName: '元大台灣高股息證券投資信託基金' },
  '00631L': { feature: '投資台股市值前50大上市公司，採正向槓桿操作', aum: '1,116.5 億', listedDate: '2014/10', expenseRatio: '1.14%', holders: '158,964 人', dividendCycle: '不配息', fundType: '股票型ETF', indexCurrency: 'NTD', trackIndex: '臺灣50指數', fundName: '元大ETF傘型證券投資信託基金之台灣50單日正向2倍證券投資信託基金' },
  '00632R': { feature: '投資台股市值前50大上市公司，採反向操作', aum: '156 億', listedDate: '2014/10', expenseRatio: '1.07%', holders: '約 3.2 萬人', dividendCycle: '不配息', fundType: '股票型ETF', indexCurrency: 'NTD', trackIndex: '臺灣50指數', fundName: '元大ETF傘型證券投資信託基金之台灣50單日反向1倍證券投資信託基金' },
  '00685L': { feature: '追蹤台灣加權指數單日正向2倍報酬，適合短線操作', aum: '約 200 億', listedDate: '2015/01', expenseRatio: '1.05%', holders: '約 4.5 萬人', dividendCycle: '不配息', fundType: '股票型ETF', indexCurrency: 'NTD', trackIndex: '臺灣加權股價指數', fundName: '富邦台灣加權股價指數單日正向2倍證券投資信託基金' },
  '00686R': { feature: '追蹤台灣加權指數單日反向1倍報酬', aum: '約 50 億', listedDate: '2015/01', expenseRatio: '1.05%', holders: '約 1.2 萬人', dividendCycle: '不配息', fundType: '股票型ETF', indexCurrency: 'NTD', trackIndex: '臺灣加權股價指數', fundName: '富邦台灣加權股價指數單日反向1倍證券投資信託基金' },
  '00878':  { feature: '追蹤MSCI台灣ESG永續高股息精選30指數', aum: '2,150 億', listedDate: '2020/07', expenseRatio: '0.46%', holders: '約 96 萬人', dividendCycle: '季配息', fundType: '股票型ETF', indexCurrency: 'NTD', trackIndex: 'MSCI台灣ESG永續高股息精選30指數', fundName: '國泰永續高股息證券投資信託基金' },
  '00919':  { feature: '精選台灣高息且具成長潛力的優質股票', aum: '1,380 億', listedDate: '2022/10', expenseRatio: '0.60%', holders: '約 68 萬人', dividendCycle: '月配息', fundType: '股票型ETF', indexCurrency: 'NTD', trackIndex: '台灣精選高息指數', fundName: '群益台灣精選高息證券投資信託基金' },
  '00929':  { feature: '精選台灣科技產業高息股，月月配息', aum: '980 億', listedDate: '2023/06', expenseRatio: '0.69%', holders: '約 52 萬人', dividendCycle: '月配息', fundType: '股票型ETF', indexCurrency: 'NTD', trackIndex: '台灣科技優息指數', fundName: '復華台灣科技優息證券投資信託基金' },
};

// ─── 全市場股價快取 ──────────────────────────────────────────────────────────

/** @type {Map<string, object>|null} */
let stockDayAllCache = null;

/** 上次載入時間戳 */
let stockDayAllFetchedAt = 0;

/** 快取有效期：1 分鐘 */
const CACHE_TTL_MS = 1 * 60 * 1000;

/** TWSE openapi STOCK_DAY_ALL 端點 */
const STOCK_DAY_ALL_URL = 'https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL';

/**
 * 載入全市場股價資料（STOCK_DAY_ALL）。
 * 快取有效期內直接回傳快取，過期或強制刷新時重新載入。
 * 直連失敗時自動透過 corsproxy.io 代理重試。
 *
 * @param {boolean} [forceRefresh=false] 是否強制刷新
 * @returns {Promise<Map<string, object>|null>}
 */
async function loadStockDayAll(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && stockDayAllCache && now - stockDayAllFetchedAt < CACHE_TTL_MS) {
    console.log('[SearchService] 使用快取的股價資料');
    return stockDayAllCache;
  }

  console.log('[SearchService] 重新載入股價資料...', forceRefresh ? '(強制刷新)' : '');
  const res = await fetchWithFallback([
    STOCK_DAY_ALL_URL,
    proxied(STOCK_DAY_ALL_URL),
  ]);
  if (!res) {
    console.warn('[SearchService] 無法載入股價資料');
    return stockDayAllCache; // 回傳舊快取而非 null
  }

  try {
    const json = await res.json();
    const map = new Map();

    if (Array.isArray(json)) {
      for (const item of json) {
        if (!item.Code) continue;
        map.set(item.Code.toUpperCase(), {
          code:   item.Code,
          name:   item.Name || '',
          close:  parseFloatSafe(item.ClosingPrice),
          change: parseFloatSafe(item.Change),
          open:   parseFloatSafe(item.OpeningPrice),
          high:   parseFloatSafe(item.HighestPrice),
          low:    parseFloatSafe(item.LowestPrice),
          volume: item.TradeVolume ? Number(item.TradeVolume).toLocaleString('zh-TW') : null,
          date:   convertTWSEDate(item.Date),
        });
      }
    }

    if (map.size > 0) {
      stockDayAllCache = map;
      stockDayAllFetchedAt = now;
      console.log(`[SearchService] 成功載入 ${map.size} 筆股價資料，日期: ${json[0]?.Date}`);
    }
    return map.size > 0 ? map : stockDayAllCache;
  } catch (error) {
    console.error('[SearchService] 解析股價資料失敗:', error);
    return stockDayAllCache; // 回傳舊快取而非 null
  }
}

/**
 * 將 TWSE 民國年日期轉換為西元年日期字串。
 * 例如 "1150424" → "2026/04/24"
 * @param {string|number} d
 * @returns {string|null}
 */
function convertTWSEDate(d) {
  if (!d) return null;
  const s = String(d);
  if (s.length < 7) return null;
  const year = parseInt(s.slice(0, s.length - 4)) + 1911;
  return `${year}/${s.slice(-4, -2)}/${s.slice(-2)}`;
}

// ─── 台股搜尋 ─────────────────────────────────────────────────────────────────

/**
 * 搜尋台股：精確代號匹配 → 代號前綴匹配 → 名稱包含匹配，最多 10 筆。
 *
 * @param {string} query 搜尋關鍵字
 * @returns {Promise<Array<{symbol: string, name: string, type: string, close: number|null}>>}
 */
export async function searchTWStock(query) {
  if (!query || query.trim().length === 0) return [];
  const q     = query.trim().toUpperCase();
  const qOrig = query.trim();

  const cache = await loadStockDayAll();
  if (!cache || cache.size === 0) return [];

  const exact = [], startsWith = [], nameMatch = [];
  for (const [code, item] of cache) {
    const entry = {
      symbol: item.code,
      name:   item.name,
      type:   guessType(item.code),
      close:  item.close,   // 帶回收盤價，供下拉顯示與自動帶入
    };
    if (code === q)
      exact.push(entry);
    else if (code.startsWith(q))
      startsWith.push(entry);
    else if (item.name.includes(qOrig))
      nameMatch.push(entry);
  }
  return [...exact, ...startsWith, ...nameMatch].slice(0, 10);
}

/**
 * 根據代號猜測資產類型（ETF 或股票）。
 * @param {string} code
 * @returns {string}
 */
function guessType(code) {
  return /^00\d/.test(code) ? 'ETF' : '股票';
}

// ─── 加密貨幣清單（20 種主流幣種）─────────────────────────────────────────────

const CRYPTO_LIST = [
  { id: 'bitcoin',       symbol: 'BTC',   name: 'Bitcoin',    category: 'Layer 1' },
  { id: 'ethereum',      symbol: 'ETH',   name: 'Ethereum',   category: 'Layer 1' },
  { id: 'tether',        symbol: 'USDT',  name: 'Tether',     category: 'Stablecoin' },
  { id: 'usd-coin',      symbol: 'USDC',  name: 'USD Coin',   category: 'Stablecoin' },
  { id: 'binancecoin',   symbol: 'BNB',   name: 'BNB',        category: 'Exchange' },
  { id: 'solana',        symbol: 'SOL',   name: 'Solana',     category: 'Layer 1' },
  { id: 'ripple',        symbol: 'XRP',   name: 'XRP',        category: 'Payment' },
  { id: 'cardano',       symbol: 'ADA',   name: 'Cardano',    category: 'Layer 1' },
  { id: 'avalanche-2',   symbol: 'AVAX',  name: 'Avalanche',  category: 'Layer 1' },
  { id: 'dogecoin',      symbol: 'DOGE',  name: 'Dogecoin',   category: 'Meme' },
  { id: 'polkadot',      symbol: 'DOT',   name: 'Polkadot',   category: 'Layer 0' },
  { id: 'chainlink',     symbol: 'LINK',  name: 'Chainlink',  category: 'Oracle' },
  { id: 'matic-network', symbol: 'MATIC', name: 'Polygon',    category: 'Layer 2' },
  { id: 'uniswap',       symbol: 'UNI',   name: 'Uniswap',    category: 'DeFi' },
  { id: 'litecoin',      symbol: 'LTC',   name: 'Litecoin',   category: 'Payment' },
  { id: 'dai',           symbol: 'DAI',   name: 'Dai',        category: 'Stablecoin' },
  { id: 'shiba-inu',     symbol: 'SHIB',  name: 'Shiba Inu',  category: 'Meme' },
  { id: 'tron',          symbol: 'TRX',   name: 'TRON',       category: 'Layer 1' },
  { id: 'stellar',       symbol: 'XLM',   name: 'Stellar',    category: 'Payment' },
  { id: 'monero',        symbol: 'XMR',   name: 'Monero',     category: 'Privacy' },
];

// ─── 加密貨幣搜尋 ─────────────────────────────────────────────────────────────

/**
 * 搜尋加密貨幣：從預定義 20 種主流幣種中搜尋。
 * 搜尋順序：精確代號匹配 → 代號前綴匹配 → 名稱包含匹配，最多 10 筆。
 *
 * @param {string} query 搜尋關鍵字
 * @returns {Array<{id: string, symbol: string, name: string, category: string}>}
 */
export function searchCrypto(query) {
  if (!query || query.trim().length === 0) return [];
  const q = query.trim().toUpperCase();
  const exact      = CRYPTO_LIST.filter(c => c.symbol.toUpperCase() === q);
  const startsWith = CRYPTO_LIST.filter(c => c.symbol.toUpperCase().startsWith(q) && c.symbol.toUpperCase() !== q);
  const nameMatch  = CRYPTO_LIST.filter(c => c.name.toUpperCase().includes(q) && !c.symbol.toUpperCase().startsWith(q));
  return [...exact, ...startsWith, ...nameMatch].slice(0, 10);
}

// ─── 台股詳細資訊 ─────────────────────────────────────────────────────────────

/**
 * 取得台股詳細資訊（即時價格、漲跌幅、高低、成交量、ETF 基本資料）。
 *
 * 優先嘗試即時 API（盤中/盤後），失敗時使用 STOCK_DAY_ALL 收盤價。
 *
 * @param {string} symbol 股票代號
 * @returns {Promise<object|null>}
 */
export async function getTWStockDetail(symbol) {
  const sym     = symbol.toUpperCase();
  const etfMeta = ETF_META[sym] || null;

  console.log(`[SearchService] 獲取 ${symbol} 的詳細資訊...`);

  // 1. 優先嘗試即時 API（盤中和盤後都嘗試）
  const realtime = await fetchRealtimeDetail(symbol, etfMeta);
  if (realtime) {
    console.log(`[SearchService] ${symbol} 使用即時價格: ${realtime.price}`);
    return realtime;
  }

  // 2. 使用 STOCK_DAY_ALL 最後收盤價（強制刷新）
  console.log(`[SearchService] ${symbol} 即時API無資料，使用每日收盤價`);
  const cache = await loadStockDayAll(true); // 強制刷新
  if (cache) {
    const item = cache.get(sym);
    if (item && item.close !== null) {
      const prevClose = item.close - (item.change ?? 0);
      const changePercent = item.change !== null && prevClose !== 0
        ? (item.change / prevClose) * 100 : null;
      const yearsListed = etfMeta?.listedDate ? calcYearsListed(etfMeta.listedDate) : null;

      console.log(`[SearchService] ${symbol} 使用收盤價: ${item.close} (日期: ${item.date})`);
      return {
        symbol: item.code, name: item.name,
        price: item.close, isHistorical: true, priceDate: item.date,
        change: item.change, changePercent,
        high: item.high, low: item.low, volume: item.volume,
        type: guessType(item.code), exchange: 'TSE',
        etfMeta: etfMeta ? { ...etfMeta, yearsListed } : null,
      };
    }
  }

  console.warn(`[SearchService] ${symbol} 無法獲取任何價格資料`);
  return null;
}

/**
 * 從 TWSE 即時 API 抓取個股詳細資訊。
 * 依序嘗試上市（tse）與上櫃（otc）市場，直連失敗時走代理。
 *
 * @param {string} symbol 股票代號
 * @param {object|null} etfMeta ETF 靜態基本資料
 * @returns {Promise<object|null>}
 */
async function fetchRealtimeDetail(symbol, etfMeta) {
  for (const market of ['tse', 'otc']) {
    const direct = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=${market}_${encodeURIComponent(symbol)}.tw&json=1&delay=0`;
    const res = await fetchWithFallback([direct, proxied(direct)]);
    if (!res) continue;

    try {
      const data = await res.json();
      const info = data?.msgArray?.[0];
      if (!info) continue;

      const realtimePrice = parseFloatSafe(info.z);
      if (realtimePrice === null) continue; // 非盤中，跳過

      const prevClose = parseFloatSafe(info.y);
      const change = prevClose !== null ? realtimePrice - prevClose : null;
      const changePercent = change !== null && prevClose ? (change / prevClose) * 100 : null;
      const yearsListed = etfMeta?.listedDate ? calcYearsListed(etfMeta.listedDate) : null;

      return {
        symbol: info.c || symbol, name: info.n || symbol,
        price: realtimePrice, isHistorical: false, priceDate: null,
        change, changePercent,
        high: parseFloatSafe(info.h), low: parseFloatSafe(info.l),
        volume: info.v ? Number(info.v).toLocaleString('zh-TW') : null,
        type: guessType(symbol),
        exchange: market === 'tse' ? 'TSE' : 'OTC',
        etfMeta: etfMeta ? { ...etfMeta, yearsListed } : null,
      };
    } catch {
      continue;
    }
  }
  return null;
}

// ─── 公司基本資料快取 ─────────────────────────────────────────────────────────

/** @type {Map<string, object>|null} */
let companyInfoCache = null;

/** 上次載入時間戳 */
let companyInfoFetchedAt = 0;

/** 公司基本資料快取有效期：1 小時 */
const COMPANY_CACHE_TTL = 60 * 60 * 1000;

/** TWSE opendata 上市公司基本資料端點 */
const COMPANY_INFO_URL = 'https://openapi.twse.com.tw/v1/opendata/t187ap03_L';

/**
 * 載入上市公司基本資料。
 * 快取有效期 1 小時，直連失敗時自動走代理。
 * @returns {Promise<Map<string, object>|null>}
 */
async function loadCompanyInfo() {
  const now = Date.now();
  if (companyInfoCache && now - companyInfoFetchedAt < COMPANY_CACHE_TTL) {
    return companyInfoCache;
  }

  const res = await fetchWithFallback([
    COMPANY_INFO_URL,
    proxied(COMPANY_INFO_URL),
  ]);
  if (!res) return companyInfoCache || null;

  try {
    const list = await res.json();
    const map = new Map();
    for (const item of list) {
      const code = item['公司代號']?.trim();
      if (!code) continue;
      map.set(code.toUpperCase(), {
        code,
        fullName:   item['公司名稱']?.trim() || '',
        shortName:  item['公司簡稱']?.trim() || '',
        industry:   item['產業別']?.trim() || '',
        listedDate: item['上市日期']?.trim() || '',
        capital:    item['實收資本額']?.trim() || '',
        shares:     item['已發行普通股數或TDR原股發行股數']?.trim() || '',
        chairman:   item['董事長']?.trim() || '',
        ceo:        item['總經理']?.trim() || '',
        website:    item['網址']?.trim() || '',
      });
    }
    if (map.size > 0) {
      companyInfoCache = map;
      companyInfoFetchedAt = now;
    }
    return map.size > 0 ? map : (companyInfoCache || null);
  } catch {
    return companyInfoCache || null;
  }
}

/**
 * 取得個股公司基本資料。
 * @param {string} symbol 股票代號
 * @returns {Promise<object|null>}
 */
export async function getStockCompanyInfo(symbol) {
  const map = await loadCompanyInfo();
  return map?.get(symbol.toUpperCase()) || null;
}

// ─── 加密貨幣詳細資訊 ─────────────────────────────────────────────────────────

/**
 * 取得加密貨幣詳細資訊（TWD/USD 價格、24h 漲跌幅、市值、簡介）。
 *
 * @param {string} coinId CoinGecko coin ID
 * @returns {Promise<object|null>}
 */
export async function getCryptoDetail(coinId) {
  const staticInfo = CRYPTO_LIST.find(c => c.id === coinId);
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(coinId)}&vs_currencies=twd,usd&include_market_cap=true&include_24hr_change=true`;

  const res = await fetchWithFallback([url, proxied(url)]);
  if (!res) return buildCryptoFallback(coinId, staticInfo);

  try {
    const data = await res.json();
    const coin = data[coinId];
    if (!coin) return buildCryptoFallback(coinId, staticInfo);
    return {
      id: coinId,
      symbol:       staticInfo?.symbol || coinId.toUpperCase(),
      name:         staticInfo?.name   || coinId,
      priceTWD:     coin.twd           ?? null,
      priceUSD:     coin.usd           ?? null,
      change24h:    coin.usd_24h_change ?? null,
      marketCapTWD: coin.twd_market_cap ?? null,
      description:  getCryptoDescription(coinId),
      category:     staticInfo?.category || '',
    };
  } catch {
    return buildCryptoFallback(coinId, staticInfo);
  }
}

/**
 * 建立加密貨幣 fallback 資料（API 失敗時使用靜態資料）。
 * @param {string} coinId
 * @param {object|null} staticInfo
 * @returns {object|null}
 */
function buildCryptoFallback(coinId, staticInfo) {
  if (!staticInfo) return null;
  return {
    id: coinId, symbol: staticInfo.symbol, name: staticInfo.name,
    priceTWD: null, priceUSD: null, change24h: null, marketCapTWD: null,
    description: getCryptoDescription(coinId), category: staticInfo.category,
  };
}

// ─── 加密貨幣簡介 ─────────────────────────────────────────────────────────────

const CRYPTO_DESCRIPTIONS = {
  'bitcoin':       '全球首個去中心化加密貨幣，由中本聰於 2009 年創建。總供應量上限 2100 萬枚，被視為數位黃金與價值儲存工具。',
  'ethereum':      '支援智能合約的去中心化平台，是 DeFi、NFT 與 Web3 應用的主要基礎設施。2022 年完成 The Merge，轉為 PoS 共識機制。',
  'tether':        '與美元 1:1 錨定的穩定幣，由 Tether Limited 發行。是加密市場中流動性最高的穩定幣，廣泛用於交易所間轉帳。',
  'usd-coin':      '由 Circle 與 Coinbase 共同發行的美元穩定幣，受美國監管，定期接受第三方審計，透明度較高。',
  'binancecoin':   'Binance 交易所的原生代幣，可用於支付手續費享折扣。BNB Chain 的原生貨幣，支援 DeFi 生態系。',
  'solana':        '高效能 Layer 1 區塊鏈，採用 PoH + PoS 共識，理論 TPS 超過 65,000。以低手續費與快速確認著稱，是 NFT 與 DeFi 熱門平台。',
  'ripple':        '專為跨境支付設計的數位資產，與多家銀行及金融機構合作。XRP Ledger 可在 3-5 秒內完成交易。',
  'cardano':       '以學術研究為基礎的 Layer 1 區塊鏈，採用 Ouroboros PoS 共識。強調形式化驗證與可持續發展。',
  'avalanche-2':   '高速 Layer 1 平台，採用三鏈架構（X/P/C Chain），支援 EVM 相容智能合約，最終確認時間不到 2 秒。',
  'dogecoin':      '源自網路迷因的加密貨幣，由 Billy Markus 與 Jackson Palmer 於 2013 年創建。擁有活躍社群，Elon Musk 多次公開支持。',
  'polkadot':      '跨鏈互操作協議，允許不同區塊鏈（平行鏈）共享安全性並互相通信。由以太坊聯合創始人 Gavin Wood 創建。',
  'chainlink':     '去中心化預言機網路，為智能合約提供可靠的鏈外數據（如價格、天氣、隨機數）。是 DeFi 生態的關鍵基礎設施。',
  'matic-network': '以太坊 Layer 2 擴容解決方案，提供低費用、高速度的 EVM 相容環境。已更名為 Polygon，持續擴展 ZK 技術。',
  'uniswap':       '以太坊上最大的去中心化交易所（DEX），採用自動做市商（AMM）模型。UNI 為治理代幣，持有者可參與協議決策。',
  'litecoin':      '比特幣的輕量版，由 Charlie Lee 於 2011 年創建。出塊時間 2.5 分鐘，總量 8400 萬枚，常被稱為「數位白銀」。',
  'dai':           'MakerDAO 發行的去中心化穩定幣，以超額抵押加密資產維持與美元的軟錨定。無需中心化機構即可鑄造。',
  'shiba-inu':     '以柴犬為主題的迷因幣，自稱「Dogecoin 殺手」。擁有 ShibaSwap DEX 與 Shibarium Layer 2 生態系。',
  'tron':          '高吞吐量 Layer 1 區塊鏈，專注於數位內容與娛樂應用。USDT 在 TRON 網路上的流通量極大，手續費極低。',
  'stellar':       '專為跨境支付與金融普惠設計的開放網路，與 IBM 等企業合作。XLM 用於支付網路手續費。',
  'monero':        '注重隱私的加密貨幣，使用環形簽名、隱身地址與 RingCT 技術，使交易完全不可追蹤。',
};

/**
 * 取得加密貨幣簡介文字。
 * @param {string} id CoinGecko coin ID
 * @returns {string}
 */
function getCryptoDescription(id) {
  return CRYPTO_DESCRIPTIONS[id] || '';
}

// ─── 輔助函式 ────────────────────────────────────────────────────────────────

/**
 * 計算 ETF 上市年數。
 * @param {string} listedDate 上市日期（格式 YYYY/MM）
 * @returns {string}
 */
function calcYearsListed(listedDate) {
  const [year, month] = listedDate.split('/').map(Number);
  const years = (Date.now() - new Date(year, month - 1, 1)) / (1000 * 60 * 60 * 24 * 365.25);
  return `${years.toFixed(1)}年 (${listedDate}上市)`;
}

// ─── 月漲幅計算 ───────────────────────────────────────────────────────────────

/**
 * 從 TWSE STOCK_DAY API 抓取個股月報，計算近一個月漲幅。
 * 邏輯：取 30 天前最接近的交易日收盤價，與當前價格比較。
 *
 * @param {string} symbol 股票代號
 * @returns {Promise<{monthChange: number|null, monthChangePercent: number|null, monthAgoPrice: number|null}>}
 */
export async function getMonthlyChange(symbol) {
  const empty = { monthChange: null, monthChangePercent: null, monthAgoPrice: null };
  try {
    const now = new Date();
    // 目標：30 天前的收盤價
    const targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() - 30);

    // 需要抓目標日期所在月份的資料
    const targetMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
    const twseDate = `${targetMonth.getFullYear()}${String(targetMonth.getMonth() + 1).padStart(2, '0')}01`;

    const stockNo = encodeURIComponent(symbol);
    const url = `https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&date=${twseDate}&stockNo=${stockNo}`;

    const res = await fetchWithFallback([url, proxied(url)]);
    if (!res) return empty;

    const data = await res.json();
    if (data.stat !== 'OK' || !data.data || data.data.length === 0) return empty;

    // data.data 每行: [日期(民國), 成交股數, 成交金額, 開盤價, 最高價, 最低價, 收盤價, 漲跌價差, 成交筆數]
    // 日期格式: "114/03/28" (民國年)
    // 找最接近 30 天前的那筆
    const targetTime = targetDate.getTime();
    let bestRow = null;
    let bestDiff = Infinity;

    for (const row of data.data) {
      // 解析民國年日期 "114/03/28" → 2025/03/28
      const parts = row[0].trim().split('/');
      if (parts.length !== 3) continue;
      const y = parseInt(parts[0]) + 1911;
      const m = parseInt(parts[1]) - 1;
      const d = parseInt(parts[2]);
      const rowDate = new Date(y, m, d);
      const diff = Math.abs(rowDate.getTime() - targetTime);

      if (diff < bestDiff) {
        bestDiff = diff;
        bestRow = row;
      }
    }

    if (!bestRow) return empty;

    const monthAgoPrice = parseFloatSafe(bestRow[6]);
    if (!monthAgoPrice || monthAgoPrice === 0) return empty;

    // 取得當前價格（用已經載入的 detail，避免重複 API 呼叫）
    const detail = await getTWStockDetail(symbol);
    if (!detail?.price) return { ...empty, monthAgoPrice };

    const monthChange = detail.price - monthAgoPrice;
    const monthChangePercent = (monthChange / monthAgoPrice) * 100;

    return { monthChange, monthChangePercent, monthAgoPrice };
  } catch { /* 靜默失敗 */ }

  return empty;
}

// ─── 快取管理 ────────────────────────────────────────────────────────────────

/**
 * 預載股價快取和公司基本資料（並行載入）。
 * @returns {Promise<void>}
 */
export async function preloadStockCache() {
  await Promise.all([
    loadStockDayAll(),
    loadCompanyInfo(),
  ]);
}

/**
 * 清除股價快取，強制重新載入。
 */
export function clearStockCache() {
  console.log('[SearchService] 清除股價快取');
  stockDayAllCache = null;
  stockDayAllFetchedAt = 0;
  companyInfoCache = null;
  companyInfoFetchedAt = 0;
}

/**
 * 獲取快取狀態資訊。
 * @returns {{ stockCache: object, companyCache: object }}
 */
export function getCacheStatus() {
  const now = Date.now();
  return {
    stockCache: {
      exists: !!stockDayAllCache,
      size: stockDayAllCache?.size || 0,
      age: stockDayAllCache ? Math.floor((now - stockDayAllFetchedAt) / 1000) : 0,
      ttl: Math.floor(CACHE_TTL_MS / 1000),
    },
    companyCache: {
      exists: !!companyInfoCache,
      size: companyInfoCache?.size || 0,
      age: companyInfoCache ? Math.floor((now - companyInfoFetchedAt) / 1000) : 0,
      ttl: Math.floor(COMPANY_CACHE_TTL / 1000),
    }
  };
}