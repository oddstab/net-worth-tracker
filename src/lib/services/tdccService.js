/**
 * tdccService.js — 集保戶股權分散表 API 服務
 *
 * 呼叫 TDCC OpenAPI 取得各股票的持股分級資料，
 * 根據使用者持股數量計算其在所有股東中的排名百分比。
 *
 * API: https://openapi.tdcc.com.tw/v1/opendata/1-5
 * 回傳格式: [{ 證券代號, 持股分級, 人數, 股數, 占集保庫存數比例%, 資料日期 }]
 *
 * 持股分級對照：
 *  1: 1-999
 *  2: 1,000-5,000
 *  3: 5,001-10,000
 *  4: 10,001-15,000
 *  5: 15,001-20,000
 *  6: 20,001-30,000
 *  7: 30,001-40,000
 *  8: 40,001-50,000
 *  9: 50,001-100,000
 * 10: 100,001-200,000
 * 11: 200,001-400,000
 * 12: 400,001-600,000
 * 13: 600,001-800,000
 * 14: 800,001-1,000,000
 * 15: 1,000,001以上
 * 16: 差異數調整
 * 17: 合計
 */

const TDCC_API_URL = 'https://openapi.tdcc.com.tw/v1/opendata/1-5';

/** 持股分級標籤對照 */
export const LEVEL_LABELS = {
  1:  '1-999',
  2:  '1,000-5,000',
  3:  '5,001-10,000',
  4:  '10,001-15,000',
  5:  '15,001-20,000',
  6:  '20,001-30,000',
  7:  '30,001-40,000',
  8:  '40,001-50,000',
  9:  '50,001-100,000',
  10: '100,001-200,000',
  11: '200,001-400,000',
  12: '400,001-600,000',
  13: '600,001-800,000',
  14: '800,001-1,000,000',
  15: '1,000,001+',
};

/** 快取：symbol → { data, fetchedAt } */
const cache = new Map();

/** 快取有效期：24 小時（TDCC 資料每週更新一次） */
const CACHE_TTL = 24 * 60 * 60 * 1000;

/**
 * 從 TDCC API 取得所有股票的持股分級資料。
 * 使用記憶體快取避免重複呼叫。
 *
 * @returns {Promise<Map<string, Array>>} symbol → 該股票的分級資料陣列
 */
async function fetchTDCCData() {
  // 檢查是否有全域快取
  if (cache.has('__all__')) {
    const cached = cache.get('__all__');
    if (Date.now() - cached.fetchedAt < CACHE_TTL) {
      return cached.data;
    }
  }

  const res = await fetch(TDCC_API_URL, {
    headers: { 'accept': 'application/json' }
  });

  if (!res.ok) {
    throw new Error(`TDCC API 回應錯誤: ${res.status}`);
  }

  const rawData = await res.json();

  // 依證券代號分組
  /** @type {Map<string, Array>} */
  const grouped = new Map();

  for (const row of rawData) {
    const symbol = row['證券代號']?.trim();
    if (!symbol) continue;
    if (!grouped.has(symbol)) grouped.set(symbol, []);
    grouped.get(symbol).push({
      level: parseInt(row['持股分級'], 10),
      holders: parseInt(row['人數'], 10) || 0,
      shares: parseInt(row['股數'], 10) || 0,
      percentage: parseFloat(row['占集保庫存數比例%']) || 0,
      date: row['資料日期'] || '',
    });
  }

  // 存入快取
  cache.set('__all__', { data: grouped, fetchedAt: Date.now() });

  return grouped;
}

/**
 * 計算使用者在某股票中的持股排名百分比。
 *
 * 邏輯：找到使用者所在的持股分級，
 * 將該分級及以上所有分級的人數加總，除以總人數，即為「前 X%」。
 *
 * @param {string} symbol - 股票代號
 * @param {number} quantity - 使用者持股數量（股）
 * @returns {Promise<{ topPercent: number, level: number, totalHolders: number, date: string } | null>}
 */
export async function getTDCCRanking(symbol, quantity) {
  try {
    const allData = await fetchTDCCData();
    const stockData = allData.get(symbol);

    if (!stockData || stockData.length === 0) return null;

    // 排除分級 16（差異數調整）和 17（合計）
    const levels = stockData
      .filter(d => d.level >= 1 && d.level <= 15)
      .sort((a, b) => a.level - b.level);

    if (levels.length === 0) return null;

    // 找到合計行取得總人數
    const totalRow = stockData.find(d => d.level === 17);
    const totalHolders = totalRow ? totalRow.holders : levels.reduce((s, l) => s + l.holders, 0);

    if (totalHolders === 0) return null;

    // 找到使用者所在的分級
    const userLevel = findUserLevel(quantity);

    // 計算該分級及以上的人數總和（即持股 >= 使用者的人數）
    const holdersAbove = levels
      .filter(l => l.level >= userLevel)
      .reduce((sum, l) => sum + l.holders, 0);

    const topPercent = (holdersAbove / totalHolders) * 100;
    const date = levels[0]?.date || '';

    return {
      topPercent: Math.round(topPercent * 100) / 100,
      level: userLevel,
      totalHolders,
      date,
      levels,
    };
  } catch (err) {
    console.warn('[TDCC] 取得排名失敗:', err.message);
    return null;
  }
}

/**
 * 批次取得多檔股票的 TDCC 排名。
 *
 * @param {Array<{ symbol: string, quantity: number }>} stocks
 * @returns {Promise<Map<string, { topPercent: number, level: number, totalHolders: number, date: string }>>}
 */
export async function batchGetTDCCRanking(stocks) {
  const results = new Map();

  try {
    const allData = await fetchTDCCData();

    for (const { symbol, quantity } of stocks) {
      const stockData = allData.get(symbol);
      if (!stockData || stockData.length === 0) continue;

      const levels = stockData
        .filter(d => d.level >= 1 && d.level <= 15)
        .sort((a, b) => a.level - b.level);

      if (levels.length === 0) continue;

      const totalRow = stockData.find(d => d.level === 17);
      const totalHolders = totalRow ? totalRow.holders : levels.reduce((s, l) => s + l.holders, 0);

      if (totalHolders === 0) continue;

      const userLevel = findUserLevel(quantity);
      const holdersAbove = levels
        .filter(l => l.level >= userLevel)
        .reduce((sum, l) => sum + l.holders, 0);

      const topPercent = (holdersAbove / totalHolders) * 100;

      results.set(symbol, {
        topPercent: Math.round(topPercent * 100) / 100,
        level: userLevel,
        totalHolders,
        date: levels[0]?.date || '',
        levels,
      });
    }
  } catch (err) {
    console.warn('[TDCC] 批次取得排名失敗:', err.message);
  }

  return results;
}

/**
 * 根據持股數量判斷所在分級。
 *
 * @param {number} quantity - 持股數量（股）
 * @returns {number} 分級 (1-15)
 */
function findUserLevel(quantity) {
  if (quantity >= 1000001) return 15;
  if (quantity >= 800001) return 14;
  if (quantity >= 600001) return 13;
  if (quantity >= 400001) return 12;
  if (quantity >= 200001) return 11;
  if (quantity >= 100001) return 10;
  if (quantity >= 50001) return 9;
  if (quantity >= 40001) return 8;
  if (quantity >= 30001) return 7;
  if (quantity >= 20001) return 6;
  if (quantity >= 15001) return 5;
  if (quantity >= 10001) return 4;
  if (quantity >= 5001) return 3;
  if (quantity >= 1000) return 2;
  return 1;
}

/**
 * 清除 TDCC 快取（供手動重新整理使用）。
 */
export function clearTDCCCache() {
  cache.clear();
}
