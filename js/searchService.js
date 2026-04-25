/**
 * searchService.js — 股票 / 加密貨幣搜尋與詳細資訊
 *
 * 台股資料來源：TWSE openapi（全部上市股票，每日更新）
 * CORS 策略：直連優先，被擋時自動走 corsproxy.io
 */

// ─── CORS Proxy ───────────────────────────────────────────────────────────────
const PROXY = 'https://corsproxy.io/?url=';

function proxied(url) {
  return `${PROXY}${encodeURIComponent(url)}`;
}

/** 依序嘗試 urls，回傳第一個成功的 Response */
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

// ─── ETF 靜態基本資料（不常變動）────────────────────────────────────────────
const ETF_META = {
  '0050':   { feature:'追蹤台灣50指數，投資台股市值前50大上市公司', aum:'3,521 億', listedDate:'2003/06', expenseRatio:'0.43%', holders:'逾 100 萬人', dividendCycle:'季配息', fundType:'股票型ETF', indexCurrency:'NTD', trackIndex:'臺灣50指數', fundName:'元大台灣卓越50證券投資信託基金' },
  '0056':   { feature:'追蹤台灣高股息指數，精選高殖利率成分股', aum:'2,890 億', listedDate:'2007/12', expenseRatio:'0.66%', holders:'約 113 萬人', dividendCycle:'季配息', fundType:'股票型ETF', indexCurrency:'NTD', trackIndex:'臺灣高股息指數', fundName:'元大台灣高股息證券投資信託基金' },
  '00631L': { feature:'投資台股市值前50大上市公司，採正向槓桿操作', aum:'1,116.5 億', listedDate:'2014/10', expenseRatio:'1.14%', holders:'158,964 人', dividendCycle:'不配息', fundType:'股票型ETF', indexCurrency:'NTD', trackIndex:'臺灣50指數', fundName:'元大ETF傘型證券投資信託基金之台灣50單日正向2倍證券投資信託基金' },
  '00632R': { feature:'投資台股市值前50大上市公司，採反向操作', aum:'156 億', listedDate:'2014/10', expenseRatio:'1.07%', holders:'約 3.2 萬人', dividendCycle:'不配息', fundType:'股票型ETF', indexCurrency:'NTD', trackIndex:'臺灣50指數', fundName:'元大ETF傘型證券投資信託基金之台灣50單日反向1倍證券投資信託基金' },
  '00685L': { feature:'追蹤台灣加權指數單日正向2倍報酬，適合短線操作', aum:'約 200 億', listedDate:'2015/01', expenseRatio:'1.05%', holders:'約 4.5 萬人', dividendCycle:'不配息', fundType:'股票型ETF', indexCurrency:'NTD', trackIndex:'臺灣加權股價指數', fundName:'富邦台灣加權股價指數單日正向2倍證券投資信託基金' },
  '00686R': { feature:'追蹤台灣加權指數單日反向1倍報酬', aum:'約 50 億', listedDate:'2015/01', expenseRatio:'1.05%', holders:'約 1.2 萬人', dividendCycle:'不配息', fundType:'股票型ETF', indexCurrency:'NTD', trackIndex:'臺灣加權股價指數', fundName:'富邦台灣加權股價指數單日反向1倍證券投資信託基金' },
  '00878':  { feature:'追蹤MSCI台灣ESG永續高股息精選30指數', aum:'2,150 億', listedDate:'2020/07', expenseRatio:'0.46%', holders:'約 96 萬人', dividendCycle:'季配息', fundType:'股票型ETF', indexCurrency:'NTD', trackIndex:'MSCI台灣ESG永續高股息精選30指數', fundName:'國泰永續高股息證券投資信託基金' },
  '00919':  { feature:'精選台灣高息且具成長潛力的優質股票', aum:'1,380 億', listedDate:'2022/10', expenseRatio:'0.60%', holders:'約 68 萬人', dividendCycle:'月配息', fundType:'股票型ETF', indexCurrency:'NTD', trackIndex:'台灣精選高息指數', fundName:'群益台灣精選高息證券投資信託基金' },
  '00929':  { feature:'精選台灣科技產業高息股，月月配息', aum:'980 億', listedDate:'2023/06', expenseRatio:'0.69%', holders:'約 52 萬人', dividendCycle:'月配息', fundType:'股票型ETF', indexCurrency:'NTD', trackIndex:'台灣科技優息指數', fundName:'復華台灣科技優息證券投資信託基金' },
};

// ─── 全市場快取 ───────────────────────────────────────────────────────────────
let stockDayAllCache = null;
let stockDayAllFetchedAt = 0;
const CACHE_TTL_MS = 10 * 60 * 1000;

const STOCK_DAY_ALL_URL = 'https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL';

async function loadStockDayAll() {
  const now = Date.now();
  if (stockDayAllCache && now - stockDayAllFetchedAt < CACHE_TTL_MS) {
    return stockDayAllCache;
  }

  const res = await fetchWithFallback([
    STOCK_DAY_ALL_URL,
    proxied(STOCK_DAY_ALL_URL),
  ]);
  if (!res) return null;

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
    }
    return map.size > 0 ? map : null;
  } catch {
    return null;
  }
}

/** "1150424" → '2026/04/24' */
function convertTWSEDate(d) {
  if (!d) return null;
  const s = String(d);
  if (s.length < 7) return null;
  const year = parseInt(s.slice(0, s.length - 4)) + 1911;
  return `${year}/${s.slice(-4, -2)}/${s.slice(-2)}`;
}

// ─── 台股搜尋 ─────────────────────────────────────────────────────────────────

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
      close:  item.close,   // ← 帶回收盤價，供下拉顯示與自動帶入
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

function guessType(code) {
  return /^00\d/.test(code) ? 'ETF' : '股票';
}

// ─── 加密貨幣搜尋 ─────────────────────────────────────────────────────────────

export function searchCrypto(query) {
  if (!query || query.trim().length === 0) return [];
  const q = query.trim().toUpperCase();
  const exact      = CRYPTO_LIST.filter(c => c.symbol.toUpperCase() === q);
  const startsWith = CRYPTO_LIST.filter(c => c.symbol.toUpperCase().startsWith(q) && c.symbol.toUpperCase() !== q);
  const nameMatch  = CRYPTO_LIST.filter(c => c.name.toUpperCase().includes(q) && !c.symbol.toUpperCase().startsWith(q));
  return [...exact, ...startsWith, ...nameMatch].slice(0, 10);
}

// ─── 台股詳細資訊 ─────────────────────────────────────────────────────────────

export async function getTWStockDetail(symbol) {
  const sym     = symbol.toUpperCase();
  const etfMeta = ETF_META[sym] || null;

  // 1. 嘗試即時 API（盤中）
  const realtime = await fetchRealtimeDetail(symbol, etfMeta);
  if (realtime) return realtime;

  // 2. 非開盤時間 → 用 STOCK_DAY_ALL 最後收盤
  const cache = await loadStockDayAll();
  if (cache) {
    const item = cache.get(sym);
    if (item && item.close !== null) {
      const prevClose = item.close - (item.change ?? 0);
      const changePercent = item.change !== null && prevClose !== 0
        ? (item.change / prevClose) * 100 : null;
      const yearsListed = etfMeta?.listedDate ? calcYearsListed(etfMeta.listedDate) : null;
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

  return null;
}

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
// 從 TWSE opendata t187ap03_L 取得上市公司基本資料
let companyInfoCache = null;
let companyInfoFetchedAt = 0;
const COMPANY_CACHE_TTL = 60 * 60 * 1000; // 1 小時

const COMPANY_INFO_URL = 'https://openapi.twse.com.tw/v1/opendata/t187ap03_L';

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
 * @param {string} symbol
 * @returns {Promise<object|null>}
 */
export async function getStockCompanyInfo(symbol) {
  const map = await loadCompanyInfo();
  return map?.get(symbol.toUpperCase()) || null;
}

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

function buildCryptoFallback(coinId, staticInfo) {
  if (!staticInfo) return null;
  return {
    id: coinId, symbol: staticInfo.symbol, name: staticInfo.name,
    priceTWD: null, priceUSD: null, change24h: null, marketCapTWD: null,
    description: getCryptoDescription(coinId), category: staticInfo.category,
  };
}

// ─── 加密貨幣清單 ─────────────────────────────────────────────────────────────
const CRYPTO_LIST = [
  { id:'bitcoin',       symbol:'BTC',  name:'Bitcoin',    category:'Layer 1' },
  { id:'ethereum',      symbol:'ETH',  name:'Ethereum',   category:'Layer 1' },
  { id:'tether',        symbol:'USDT', name:'Tether',     category:'Stablecoin' },
  { id:'usd-coin',      symbol:'USDC', name:'USD Coin',   category:'Stablecoin' },
  { id:'binancecoin',   symbol:'BNB',  name:'BNB',        category:'Exchange' },
  { id:'solana',        symbol:'SOL',  name:'Solana',     category:'Layer 1' },
  { id:'ripple',        symbol:'XRP',  name:'XRP',        category:'Payment' },
  { id:'cardano',       symbol:'ADA',  name:'Cardano',    category:'Layer 1' },
  { id:'avalanche-2',   symbol:'AVAX', name:'Avalanche',  category:'Layer 1' },
  { id:'dogecoin',      symbol:'DOGE', name:'Dogecoin',   category:'Meme' },
  { id:'polkadot',      symbol:'DOT',  name:'Polkadot',   category:'Layer 0' },
  { id:'chainlink',     symbol:'LINK', name:'Chainlink',  category:'Oracle' },
  { id:'matic-network', symbol:'MATIC',name:'Polygon',    category:'Layer 2' },
  { id:'uniswap',       symbol:'UNI',  name:'Uniswap',    category:'DeFi' },
  { id:'litecoin',      symbol:'LTC',  name:'Litecoin',   category:'Payment' },
  { id:'dai',           symbol:'DAI',  name:'Dai',        category:'Stablecoin' },
  { id:'shiba-inu',     symbol:'SHIB', name:'Shiba Inu',  category:'Meme' },
  { id:'tron',          symbol:'TRX',  name:'TRON',       category:'Layer 1' },
  { id:'stellar',       symbol:'XLM',  name:'Stellar',    category:'Payment' },
  { id:'monero',        symbol:'XMR',  name:'Monero',     category:'Privacy' },
];

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
function getCryptoDescription(id) { return CRYPTO_DESCRIPTIONS[id] || ''; }

// ─── 輔助 ────────────────────────────────────────────────────────────────────

function parseFloatSafe(val) {
  if (val === undefined || val === null || val === '-' || val === '') return null;
  const n = parseFloat(String(val).replace(/,/g, ''));
  return isNaN(n) ? null : n;
}

function calcYearsListed(listedDate) {
  const [year, month] = listedDate.split('/').map(Number);
  const years = (Date.now() - new Date(year, month - 1, 1)) / (1000 * 60 * 60 * 24 * 365.25);
  return `${years.toFixed(1)}年 (${listedDate}上市)`;
}

export async function preloadStockCache() {
  // 並行預載股價快取和公司基本資料
  await Promise.all([
    loadStockDayAll(),
    loadCompanyInfo(),
  ]);
}
