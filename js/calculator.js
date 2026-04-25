/**
 * calculator.js — 淨資產、小計、月增率計算
 *
 * 計算規則：
 *   資產TWD值 = quantity × pricePerUnit × (currency === 'USD' ? exchangeRate : 1)
 *   投資總額   = sum(assets where category === 'investment' 的 TWD值)
 *   流動資產   = sum(assets where category === 'liquid' 的 TWD值)
 *   資產總計   = 投資總額 + 流動資產
 *   債務總計   = sum(liabilities 的 TWD值)
 *   淨資產     = 資產總計 - 債務總計
 */

// ─── 換算輔助 ────────────────────────────────────────────────────────────────

/**
 * 將資產或負債項目換算為 TWD 值。
 *
 * - Asset（有 quantity + pricePerUnit）：quantity × pricePerUnit × rate（若 USD）
 * - Liability（有 amount）：amount × rate（若 USD）
 *
 * @param {import('./types.js').Asset | import('./types.js').Liability} item
 * @param {number} exchangeRate  USD/TWD 匯率
 * @returns {number}
 */
export function toTWD(item, exchangeRate) {
  const rate = item.currency === 'USD' ? exchangeRate : 1;

  // Asset 型別：有 quantity 與 pricePerUnit
  if ('quantity' in item && 'pricePerUnit' in item) {
    return item.quantity * item.pricePerUnit * rate;
  }

  // Liability 型別：有 amount
  return item.amount * rate;
}

/**
 * 計算單一資產的 TWD 值。
 *
 * @param {import('./types.js').Asset} asset
 * @param {number} rate  USD/TWD 匯率
 * @returns {number}
 */
export function calculateAssetTWD(asset, rate) {
  return asset.quantity * asset.pricePerUnit * (asset.currency === 'USD' ? rate : 1);
}

// ─── 總計計算 ────────────────────────────────────────────────────────────────

/**
 * 計算所有資產與負債的分類小計及淨資產。
 *
 * @param {import('./types.js').Asset[]} assets
 * @param {import('./types.js').Liability[]} liabilities
 * @param {number} rate  USD/TWD 匯率
 * @returns {{
 *   investmentTotal: number,
 *   liquidTotal: number,
 *   totalAssets: number,
 *   creditTotal: number,
 *   pledgeTotal: number,
 *   totalLiabilities: number,
 *   netWorth: number
 * }}
 */
export function calculateTotals(assets, liabilities, rate) {
  const investmentTotal = assets
    .filter(a => a.category === 'investment')
    .reduce((sum, a) => sum + calculateAssetTWD(a, rate), 0);

  const liquidTotal = assets
    .filter(a => a.category === 'liquid')
    .reduce((sum, a) => sum + calculateAssetTWD(a, rate), 0);

  const totalAssets = investmentTotal + liquidTotal;

  const creditTotal = liabilities
    .filter(l => l.category === 'credit')
    .reduce((sum, l) => sum + toTWD(l, rate), 0);

  const pledgeTotal = liabilities
    .filter(l => l.category === 'pledge')
    .reduce((sum, l) => sum + toTWD(l, rate), 0);

  const mortgageTotal = liabilities
    .filter(l => l.category === 'mortgage')
    .reduce((sum, l) => sum + toTWD(l, rate), 0);

  const otherLiabilityTotal = liabilities
    .filter(l => l.category === 'other')
    .reduce((sum, l) => sum + toTWD(l, rate), 0);

  const totalLiabilities = creditTotal + pledgeTotal + mortgageTotal + otherLiabilityTotal;

  const netWorth = totalAssets - totalLiabilities;

  return {
    investmentTotal,
    liquidTotal,
    totalAssets,
    creditTotal,
    pledgeTotal,
    mortgageTotal,
    otherLiabilityTotal,
    totalLiabilities,
    netWorth,
  };
}

// ─── 月增率 ──────────────────────────────────────────────────────────────────

/**
 * 計算資產月增率（%）。
 *
 * 演算法：
 *   1. 找出本月最新快照（日期最大者）
 *   2. 找出上月同日（±3 天容差）快照
 *   3. 公式：(本月淨資產 - 上月淨資產) / |上月淨資產| × 100
 *
 * 若無足夠快照資料或上月淨資產為 0，回傳 null。
 *
 * @param {import('./types.js').Snapshot[]} snapshots
 * @returns {number | null}
 */
export function calculateMonthlyGrowthRate(snapshots) {
  if (!snapshots || snapshots.length < 2) return null;

  // 依日期排序（最新在前）
  const sorted = [...snapshots].sort((a, b) => b.date.localeCompare(a.date));

  // 本月最新快照
  const latest = sorted[0];
  const latestDate = new Date(latest.date);

  // 計算上月同日目標日期
  const targetDate = new Date(latestDate);
  targetDate.setMonth(targetDate.getMonth() - 1);

  // 在快照中尋找距離目標日期 ±3 天內最近的快照
  const TOLERANCE_MS = 3 * 24 * 60 * 60 * 1000; // 3 天（毫秒）

  let bestSnapshot = null;
  let bestDiff = Infinity;

  for (const snapshot of snapshots) {
    const snapshotDate = new Date(snapshot.date);
    const diff = Math.abs(snapshotDate.getTime() - targetDate.getTime());
    if (diff <= TOLERANCE_MS && diff < bestDiff) {
      bestDiff = diff;
      bestSnapshot = snapshot;
    }
  }

  if (!bestSnapshot) return null;
  if (bestSnapshot.netWorth === 0) return null;

  return ((latest.netWorth - bestSnapshot.netWorth) / Math.abs(bestSnapshot.netWorth)) * 100;
}

// ─── 圓餅圖資料 ──────────────────────────────────────────────────────────────

/**
 * 計算圓餅圖所需的標籤、金額與百分比。
 *
 * 若所有值為 0，percentages 全為 0。
 *
 * @param {{
 *   investmentTotal: number,
 *   liquidTotal: number,
 *   totalLiabilities: number
 * }} totals
 * @returns {{
 *   labels: string[],
 *   values: number[],
 *   percentages: number[]
 * }}
 */
export function calculatePieChartData(totals) {
  const labels = ['投資資產', '流動資產', '債務'];
  const values = [totals.investmentTotal, totals.liquidTotal, totals.totalLiabilities];

  const total = values.reduce((sum, v) => sum + v, 0);

  let percentages;
  if (total === 0) {
    percentages = [0, 0, 0];
  } else {
    percentages = values.map(v => (v / total) * 100);
  }

  return { labels, values, percentages };
}

// ─── 輸入驗證 ────────────────────────────────────────────────────────────────

/**
 * 驗證持有數量：必須為有限正數。
 * @param {*} x
 * @returns {boolean}
 */
export function validateQuantity(x) {
  return typeof x === 'number' && isFinite(x) && x > 0;
}

/**
 * 驗證每單位價格：必須為有限正數。
 * @param {*} x
 * @returns {boolean}
 */
export function validatePrice(x) {
  return typeof x === 'number' && isFinite(x) && x > 0;
}

/**
 * 驗證負債金額：必須為有限正數。
 * @param {*} x
 * @returns {boolean}
 */
export function validateAmount(x) {
  return typeof x === 'number' && isFinite(x) && x > 0;
}

/**
 * 驗證匯率：必須為有限正數。
 * @param {*} x
 * @returns {boolean}
 */
export function validateExchangeRate(x) {
  return typeof x === 'number' && isFinite(x) && x > 0;
}
