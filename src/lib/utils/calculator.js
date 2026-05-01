/**
 * calculator.js — 純函式計算模組
 *
 * 負責淨資產計算、分類小計、月增率、圓餅圖資料、輸入驗證。
 * 不依賴任何 Svelte 或 DOM API，所有函式皆為純函式。
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
 * 計算單一資產的 TWD 值。
 *
 * @param {number} quantity      持有數量
 * @param {number} pricePerUnit  每單位價格
 * @param {string} currency      計價幣別（'TWD' | 'USD'）
 * @param {number} exchangeRate  USD/TWD 匯率
 * @returns {number} 資產的 TWD 值
 */
export function calculateAssetTWD(quantity, pricePerUnit, currency, exchangeRate) {
  return quantity * pricePerUnit * (currency === 'USD' ? exchangeRate : 1);
}

/**
 * 將負債項目換算為 TWD 值。
 *
 * @param {{ amount: number, currency: string }} liability  負債項目
 * @param {number} exchangeRate  USD/TWD 匯率
 * @returns {number} 負債的 TWD 值
 */
function liabilityToTWD(liability, exchangeRate) {
  const rate = liability.currency === 'USD' ? exchangeRate : 1;
  return liability.amount * rate;
}

// ─── 總計計算 ────────────────────────────────────────────────────────────────

/**
 * 計算所有資產與負債的分類小計及淨資產。
 *
 * @param {Array<{
 *   category: string,
 *   quantity: number,
 *   pricePerUnit: number,
 *   currency: string
 * }>} assets  資產陣列
 * @param {Array<{
 *   category: string,
 *   amount: number,
 *   currency: string
 * }>} liabilities  負債陣列
 * @param {number} exchangeRate  USD/TWD 匯率
 * @returns {{
 *   investmentTotal: number,
 *   liquidTotal: number,
 *   totalAssets: number,
 *   creditTotal: number,
 *   homeLoanTotal: number,
 *   pledgeTotal: number,
 *   mortgageTotal: number,
 *   otherLiabilityTotal: number,
 *   totalLiabilities: number,
 *   netWorth: number
 * }}
 */
export function calculateTotals(assets, liabilities, exchangeRate) {
  // 投資資產小計
  const investmentTotal = assets
    .filter(a => a.category === 'investment')
    .reduce((sum, a) => sum + calculateAssetTWD(a.quantity, a.pricePerUnit, a.currency, exchangeRate), 0);

  // 流動資產小計
  const liquidTotal = assets
    .filter(a => a.category === 'liquid')
    .reduce((sum, a) => sum + calculateAssetTWD(a.quantity, a.pricePerUnit, a.currency, exchangeRate), 0);

  // 資產總計
  const totalAssets = investmentTotal + liquidTotal;

  // 各類負債小計
  const creditTotal = liabilities
    .filter(l => l.category === 'credit')
    .reduce((sum, l) => sum + liabilityToTWD(l, exchangeRate), 0);

  const homeLoanTotal = liabilities
    .filter(l => l.category === 'home_loan')
    .reduce((sum, l) => sum + liabilityToTWD(l, exchangeRate), 0);

  const pledgeTotal = liabilities
    .filter(l => l.category === 'pledge')
    .reduce((sum, l) => sum + liabilityToTWD(l, exchangeRate), 0);

  const mortgageTotal = liabilities
    .filter(l => l.category === 'mortgage')
    .reduce((sum, l) => sum + liabilityToTWD(l, exchangeRate), 0);

  const otherLiabilityTotal = liabilities
    .filter(l => l.category === 'other')
    .reduce((sum, l) => sum + liabilityToTWD(l, exchangeRate), 0);

  // 債務總計
  const totalLiabilities = creditTotal + homeLoanTotal + pledgeTotal + mortgageTotal + otherLiabilityTotal;

  // 淨資產
  const netWorth = totalAssets - totalLiabilities;

  return {
    investmentTotal,
    liquidTotal,
    totalAssets,
    creditTotal,
    homeLoanTotal,
    pledgeTotal,
    mortgageTotal,
    otherLiabilityTotal,
    totalLiabilities,
    netWorth,
  };
}

// ─── 月增率與漲跌幅 ──────────────────────────────────────────────────────────

/**
 * 計算資產月增率（%）和今日漲跌幅（%）。
 *
 * 演算法：
 *   真實月增率：
 *   1. 找出最新快照
 *   2. 找出約 30 天前（±3 天容差）的快照
 *   3. 公式：(最新淨資產 - 舊淨資產) / |舊淨資產| × 100
 *
 *   今日漲跌幅：
 *   1. 找出最新快照
 *   2. 找出前一日快照（±3 天容差）
 *   3. 公式：(最新淨資產 - 前日淨資產) / |前日淨資產| × 100
 *
 *   估算月增率：
 *   1. 若無足夠歷史資料計算真實月增率
 *   2. 基於可用天數按比例推算 30 天增率
 *
 * @param {Array<{ date: string, netWorth: number }>} snapshots  快照陣列
 * @returns {{
 *   monthlyGrowthRate: number | null,
 *   dailyGrowthRate: number | null,
 *   estimatedMonthlyRate: number | null
 * }}
 */
export function calculateGrowthRates(snapshots) {
  if (!snapshots || snapshots.length < 2) {
    return {
      monthlyGrowthRate: null,
      dailyGrowthRate: null,
      estimatedMonthlyRate: null,
    };
  }

  // 依日期排序（最新在前）
  const sorted = [...snapshots].sort((a, b) => b.date.localeCompare(a.date));

  // 最新快照
  const latest = sorted[0];
  const latestDate = new Date(latest.date);

  // 計算今日漲跌幅
  const dailyGrowthRate = _calculateDailyGrowthRate(sorted, latest, latestDate);

  // 計算真實月增率（30 天前 ±3 天容差）
  const monthlyGrowthRate = _calculateRealMonthlyGrowthRate(snapshots);

  // 計算估算月增率（基於可用天數按比例推算）
  const estimatedMonthlyRate = _calculateEstimatedMonthlyRate(sorted, latest, latestDate);

  return {
    monthlyGrowthRate,
    dailyGrowthRate,
    estimatedMonthlyRate,
  };
}

/**
 * 計算真實月增率（與約 30 天前快照比較）。
 *
 * @param {Array<{ date: string, netWorth: number }>} snapshots
 * @returns {number | null}
 */
function _calculateRealMonthlyGrowthRate(snapshots) {
  if (!snapshots || snapshots.length < 2) return null;

  // 依日期排序（最新在前）
  const sorted = [...snapshots].sort((a, b) => b.date.localeCompare(a.date));

  // 最新快照
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

/**
 * 計算今日漲跌幅（與前一日快照比較，±3 天容差）。
 *
 * @param {Array<{ date: string, netWorth: number }>} sorted  已排序快照（最新在前）
 * @param {{ date: string, netWorth: number }} latest  最新快照
 * @param {Date} latestDate  最新快照日期
 * @returns {number | null}
 */
function _calculateDailyGrowthRate(sorted, latest, latestDate) {
  if (sorted.length < 2) return null;

  // 尋找昨日快照（±3 天容差）
  const yesterdayTarget = new Date(latestDate);
  yesterdayTarget.setDate(yesterdayTarget.getDate() - 1);

  const DAILY_TOLERANCE_MS = 3 * 24 * 60 * 60 * 1000; // 3 天容差

  let bestSnapshot = null;
  let bestDiff = Infinity;

  for (const snapshot of sorted) {
    if (snapshot === latest) continue; // 跳過最新快照

    const snapshotDate = new Date(snapshot.date);
    const diff = Math.abs(snapshotDate.getTime() - yesterdayTarget.getTime());

    if (diff <= DAILY_TOLERANCE_MS && diff < bestDiff) {
      bestDiff = diff;
      bestSnapshot = snapshot;
    }
  }

  // 如果沒找到昨日附近的資料，使用最近的一個快照
  if (!bestSnapshot && sorted.length >= 2) {
    bestSnapshot = sorted[1]; // 使用第二新的快照
  }

  if (!bestSnapshot || bestSnapshot.netWorth === 0) return null;

  return ((latest.netWorth - bestSnapshot.netWorth) / Math.abs(bestSnapshot.netWorth)) * 100;
}

/**
 * 計算估算月增率（基於可用天數按比例推算 30 天增率）。
 *
 * @param {Array<{ date: string, netWorth: number }>} sorted  已排序快照（最新在前）
 * @param {{ date: string, netWorth: number }} latest  最新快照
 * @param {Date} latestDate  最新快照日期
 * @returns {number | null}
 */
function _calculateEstimatedMonthlyRate(sorted, latest, latestDate) {
  if (sorted.length < 2) return null;

  // 找到最早的快照
  const earliest = sorted[sorted.length - 1];
  const earliestDate = new Date(earliest.date);

  // 計算實際天數
  const daysDiff = Math.floor(
    (latestDate.getTime() - earliestDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysDiff <= 0 || earliest.netWorth === 0) return null;

  // 計算期間增率
  const periodGrowthRate =
    ((latest.netWorth - earliest.netWorth) / Math.abs(earliest.netWorth)) * 100;

  // 按比例推算 30 天增率
  const estimatedMonthlyRate = (periodGrowthRate / daysDiff) * 30;

  return estimatedMonthlyRate;
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
 * }} totals  calculateTotals 的回傳值
 * @returns {{
 *   labels: string[],
 *   values: number[],
 *   percentages: number[]
 * }}
 */
export function calculatePieChartData(totals) {
  const labels = ['投資資產', '債務'];
  const investTotal = (totals.investmentTotal || 0) + (totals.liquidTotal || 0);
  const values = [investTotal, totals.totalLiabilities];

  const total = values.reduce((sum, v) => sum + v, 0);

  let percentages;
  if (total === 0) {
    percentages = [0, 0];
  } else {
    percentages = values.map(v => (v / total) * 100);
  }

  return { labels, values, percentages };
}

// ─── 輸入驗證 ────────────────────────────────────────────────────────────────

/**
 * 驗證持有數量：必須為有限正數。
 * @param {*} value
 * @returns {boolean}
 */
export function validateQuantity(value) {
  return typeof value === 'number' && isFinite(value) && value > 0;
}

/**
 * 驗證每單位價格：必須為有限正數。
 * @param {*} value
 * @returns {boolean}
 */
export function validatePrice(value) {
  return typeof value === 'number' && isFinite(value) && value > 0;
}

/**
 * 驗證負債金額：必須為有限正數。
 * @param {*} value
 * @returns {boolean}
 */
export function validateAmount(value) {
  return typeof value === 'number' && isFinite(value) && value > 0;
}

/**
 * 驗證匯率：必須為有限正數。
 * @param {*} value
 * @returns {boolean}
 */
export function validateExchangeRate(value) {
  return typeof value === 'number' && isFinite(value) && value > 0;
}

// ─── 貸款攤還計算 ─────────────────────────────────────────────────────────────

/**
 * 計算等額本息還款明細表。
 *
 * 公式：月付金 = P × r × (1+r)^n / ((1+r)^n - 1)
 * 其中 P = 本金、r = 月利率、n = 期數。
 *
 * 最後一期調整還款金額，確保剩餘本金歸零。
 *
 * @param {number} principal   貸款本金
 * @param {number} annualRate  年利率（%），例如 2.5 代表 2.5%
 * @param {number} terms       總期數（月）
 * @returns {Array<{
 *   period: number,
 *   principalPart: number,
 *   interestPart: number,
 *   monthlyPayment: number,
 *   remainingBalance: number,
 *   cumulativeInterest: number
 * }>} 每期還款明細陣列
 */
export function calculateLoanSchedule(principal, annualRate, terms) {
  // 無效參數：回傳空陣列
  if (!principal || principal <= 0 || !terms || terms <= 0) {
    return [];
  }

  const monthlyRate = (annualRate / 100) / 12;
  let fixedPayment;

  if (monthlyRate === 0) {
    // 零利率：本金平均分攤
    fixedPayment = Math.round(principal / terms);
  } else {
    // 等額本息公式：P × r × (1+r)^n / ((1+r)^n - 1)
    const factor = Math.pow(1 + monthlyRate, terms);
    fixedPayment = Math.round(principal * monthlyRate * factor / (factor - 1));
  }

  const schedule = [];
  let balance = principal;
  let cumulativeInterest = 0;

  for (let i = 1; i <= terms; i++) {
    // 利息 = 剩餘本金 × 月利率，取整
    const interestPart = Math.round(balance * monthlyRate);
    let principalPart;
    let monthlyPayment;

    if (i === terms) {
      // 最後一期：還清所有剩餘本金，確保餘額歸零
      principalPart = balance;
      monthlyPayment = balance + interestPart;
    } else {
      monthlyPayment = fixedPayment;
      principalPart = monthlyPayment - interestPart;
    }

    balance -= principalPart;
    cumulativeInterest += interestPart;

    schedule.push({
      period: i,
      principalPart,
      interestPart,
      monthlyPayment,
      remainingBalance: Math.max(0, balance),
      cumulativeInterest,
    });
  }

  return schedule;
}

/**
 * 計算本金平均攤還（等額本金）還款明細表。
 *
 * 每期固定還本金額 = P / n，利息逐月遞減。
 * 最後一期調整還本金額，確保剩餘本金歸零。
 *
 * @param {number} principal   貸款本金
 * @param {number} annualRate  年利率（%）
 * @param {number} terms       總期數（月）
 * @returns {Array<{
 *   period: number,
 *   principalPart: number,
 *   interestPart: number,
 *   monthlyPayment: number,
 *   remainingBalance: number,
 *   cumulativeInterest: number
 * }>} 每期還款明細陣列
 */
export function calculateEqualPrincipalSchedule(principal, annualRate, terms) {
  // 無效參數：回傳空陣列
  if (!principal || principal <= 0 || !terms || terms <= 0) {
    return [];
  }

  const monthlyRate = (annualRate / 100) / 12;
  const fixedPrincipal = Math.round(principal / terms);

  const schedule = [];
  let balance = principal;
  let cumulativeInterest = 0;

  for (let i = 1; i <= terms; i++) {
    // 利息 = 剩餘本金 × 月利率，取整
    const interestPart = Math.round(balance * monthlyRate);

    // 最後一期：還清所有剩餘本金，確保餘額歸零
    const principalPart = (i === terms) ? balance : fixedPrincipal;
    const monthlyPayment = principalPart + interestPart;

    balance -= principalPart;
    cumulativeInterest += interestPart;

    schedule.push({
      period: i,
      principalPart,
      interestPart,
      monthlyPayment,
      remainingBalance: Math.max(0, balance),
      cumulativeInterest,
    });
  }

  return schedule;
}

// ─── 資產負債明細 ─────────────────────────────────────────────────────────────

/**
 * 計算資產和負債的詳細占比資訊（用於圓餅圖圖例）。
 *
 * @param {Array} assets  資產陣列
 * @param {Array} liabilities  負債陣列
 * @param {number} exchangeRate  USD/TWD 匯率
 * @returns {{
 *   investmentAssets: Array<{name: string, amount: number, percentage: number}>,
 *   liabilityItems: Array<{name: string, amount: number, percentage: number, interestRate: number|null}>,
 *   avgInterestRate: number|null
 * }}
 */
export function calculateAssetBreakdown(assets, liabilities, exchangeRate) {
  const totals = calculateTotals(assets, liabilities, exchangeRate);
  const totalValue = totals.totalAssets + totals.totalLiabilities;

  // 整合相同代號的資產
  const consolidated = new Map();
  for (const asset of assets) {
    const key = asset.symbol
      ? asset.symbol.toUpperCase()
      : asset.name.replace(/\s+/g, '').toLowerCase();

    if (consolidated.has(key)) {
      const existing = consolidated.get(key);
      const existingTWD = calculateAssetTWD(existing.quantity, existing.pricePerUnit, existing.currency, exchangeRate);
      const currentTWD = calculateAssetTWD(asset.quantity, asset.pricePerUnit, asset.currency, exchangeRate);
      existing._totalTWD = existingTWD + currentTWD;
      existing.quantity += asset.quantity;
      if (asset.symbol && !existing.symbol) existing.symbol = asset.symbol;
      if (!existing.name && asset.name) existing.name = asset.name;
    } else {
      const twdVal = calculateAssetTWD(asset.quantity, asset.pricePerUnit, asset.currency, exchangeRate);
      consolidated.set(key, { ...asset, _totalTWD: twdVal });
    }
  }

  const investmentAssets = Array.from(consolidated.values())
    .map(a => ({
      name: a.symbol ? `${a.symbol} ${a.name}` : a.name,
      amount: a._totalTWD,
      percentage: totalValue > 0 ? (a._totalTWD / totalValue) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const liabilityItems = liabilities
    .map(l => {
      const amount = l.amount * (l.currency === 'USD' ? exchangeRate : 1);
      return {
        name: l.name || '未命名負債',
        amount,
        percentage: totalValue > 0 ? (amount / totalValue) * 100 : 0,
        interestRate: l.interestRate || null,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  // 加權平均利率
  let weightedSum = 0, weightTotal = 0;
  for (const l of liabilities) {
    if (l.interestRate && l.amount > 0) {
      weightedSum += l.interestRate * l.amount;
      weightTotal += l.amount;
    }
  }
  const avgInterestRate = weightTotal > 0 ? weightedSum / weightTotal : null;

  return { investmentAssets, liabilityItems, avgInterestRate };
}
