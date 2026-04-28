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
 *   mortgageTotal: number,
 *   otherLiabilityTotal: number,
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

  const homeLoanTotal = liabilities
    .filter(l => l.category === 'home_loan')
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

  const totalLiabilities = creditTotal + homeLoanTotal + pledgeTotal + mortgageTotal + otherLiabilityTotal;

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

// ─── 月增率 ──────────────────────────────────────────────────────────────────

/**
 * 計算資產月增率（%）和今日漲跌幅（%）。
 *
 * 演算法：
 *   月增率：
 *   1. 找出本月最新快照（日期最大者）
 *   2. 找出上月同日（±3 天容差）快照
 *   3. 公式：(本月淨資產 - 上月淨資產) / |上月淨資產| × 100
 *
 *   今日漲跌幅：
 *   1. 找出今日最新快照
 *   2. 找出昨日快照（±1 天容差）
 *   3. 如果沒有足夠歷史資料，用可用天數按比例計算月增率
 *
 * @param {import('./types.js').Snapshot[]} snapshots
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
      estimatedMonthlyRate: null
    };
  }

  // 依日期排序（最新在前）
  const sorted = [...snapshots].sort((a, b) => b.date.localeCompare(a.date));

  // 今日最新快照
  const latest = sorted[0];
  const latestDate = new Date(latest.date);

  // 計算今日漲跌幅
  const dailyGrowthRate = calculateDailyGrowthRate(sorted, latest, latestDate);

  // 計算真實月增率
  const monthlyGrowthRate = calculateRealMonthlyGrowthRate(snapshots);

  // 計算估算月增率（基於可用天數）
  const estimatedMonthlyRate = calculateEstimatedMonthlyRate(sorted, latest, latestDate);

  return {
    monthlyGrowthRate,
    dailyGrowthRate,
    estimatedMonthlyRate
  };
}

/**
 * 計算真實月增率（原邏輯）
 */
function calculateRealMonthlyGrowthRate(snapshots) {
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

/**
 * 計算今日漲跌幅
 */
function calculateDailyGrowthRate(sorted, latest, latestDate) {
  if (sorted.length < 2) return null;
  
  // 尋找昨日快照（±3天容差，更寬鬆）
  const yesterdayTarget = new Date(latestDate);
  yesterdayTarget.setDate(yesterdayTarget.getDate() - 1);
  
  const DAILY_TOLERANCE_MS = 3 * 24 * 60 * 60 * 1000; // 3天容差
  
  let bestSnapshot = null;
  let bestDiff = Infinity;
  
  for (const snapshot of sorted) {
    if (snapshot === latest) continue; // 跳過今日
    
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
 * 計算估算月增率（基於可用天數按比例推算）
 */
function calculateEstimatedMonthlyRate(sorted, latest, latestDate) {
  if (sorted.length < 2) return null;
  
  // 找到最早的快照
  const earliest = sorted[sorted.length - 1];
  const earliestDate = new Date(earliest.date);
  
  // 計算實際天數
  const daysDiff = Math.floor((latestDate.getTime() - earliestDate.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysDiff <= 0 || earliest.netWorth === 0) return null;
  
  // 計算期間增率
  const periodGrowthRate = ((latest.netWorth - earliest.netWorth) / Math.abs(earliest.netWorth)) * 100;
  
  // 按比例推算30天增率
  const estimatedMonthlyRate = (periodGrowthRate / daysDiff) * 30;
  
  return estimatedMonthlyRate;
}

// ─── 資產整合輔助函數 ─────────────────────────────────────────────────────────

/**
 * 為現有資產添加股票代號（遷移函數）
 * @param {Array} assets 資產陣列
 * @returns {Array} 更新後的資產陣列
 */
function migrateAssetsWithSymbols(assets) {
  const symbolMap = {
    '元大台灣50正2': '00631L',
    '智邦': '2345',
    '台積電': '2330',
    '聯發科': '2454',
    '鴻海': '2317',
    '台達電': '2308',
    '群益臺灣加權正2': '00685L',
    '群益臺灣加權正二': '00685L',
    '群益台灣加權正2': '00685L',
    '群益台灣加權正二': '00685L',
    // 可以繼續添加更多股票代號對應
  };
  
  return assets.map(asset => {
    if (!asset.symbol && asset.name) {
      // 嘗試從名稱中提取或對應股票代號
      const symbol = symbolMap[asset.name.trim()];
      if (symbol) {
        return { ...asset, symbol };
      }
    }
    return asset;
  });
}

/**
 * 將相同股票代號的資產整合在一起
 * @param {Array} assets 資產陣列
 * @param {number} rate 匯率
 * @returns {Array} 整合後的資產陣列
 */
export function consolidateAssets(assets, rate) {
  // 先進行遷移，為現有資產添加股票代號
  const migratedAssets = migrateAssetsWithSymbols(assets);
  
  const consolidated = new Map();
  
  migratedAssets.forEach(asset => {
    // 優先使用 symbol 作為整合的 key
    let key = asset.symbol;
    if (!key) {
      // 如果沒有 symbol，使用標準化的名稱
      key = asset.name.replace(/\s+/g, '').toLowerCase();
    }
    
    if (consolidated.has(key)) {
      // 合併相同股票
      const existing = consolidated.get(key);
      const existingTotalValue = existing.quantity * existing.pricePerUnit * (existing.currency === 'USD' ? rate : 1);
      const currentTotalValue = asset.quantity * asset.pricePerUnit * (asset.currency === 'USD' ? rate : 1);
      const totalValue = existingTotalValue + currentTotalValue;
      const totalQuantity = existing.quantity + asset.quantity;
      
      // 計算加權平均價格（以TWD為基準）
      const avgPriceTWD = totalValue / totalQuantity;
      // 轉換回原幣別（假設使用第一筆的幣別）
      const avgPrice = existing.currency === 'USD' ? avgPriceTWD / rate : avgPriceTWD;
      
      existing.quantity = totalQuantity;
      existing.pricePerUnit = avgPrice;
      existing.holdings.push(asset); // 保存原始持股記錄
      
      // 更新最後更新時間（取最新的）
      if (asset.lastPriceUpdate && (!existing.lastPriceUpdate || asset.lastPriceUpdate > existing.lastPriceUpdate)) {
        existing.lastPriceUpdate = asset.lastPriceUpdate;
      }
      
      // 確保使用有 symbol 的資產作為主要顯示
      if (asset.symbol && !existing.symbol) {
        existing.symbol = asset.symbol;
      }
    } else {
      // 新股票
      consolidated.set(key, {
        ...asset,
        holdings: [asset] // 保存原始持股記錄
      });
    }
  });
  
  return Array.from(consolidated.values());
}

/**
 * 計算資產和負債的詳細占比資訊
 * @param {import('./types.js').Asset[]} assets
 * @param {import('./types.js').Liability[]} liabilities
 * @param {number} rate USD/TWD 匯率
 * @returns {{
 *   investmentAssets: Array<{name: string, amount: number, percentage: number, details: string}>,
 *   liabilityItems: Array<{name: string, amount: number, percentage: number, details: string}>,
 *   totals: ReturnType<typeof calculateTotals>
 * }}
 */
export function calculateAssetBreakdown(assets, liabilities, rate) {
  const totals = calculateTotals(assets, liabilities, rate);
  const totalValue = totals.totalAssets + totals.totalLiabilities;
  
  // 先整合相同股票
  const consolidatedAssets = consolidateAssets(assets, rate);
  
  // 計算整合後的資產明細
  const investmentAssets = consolidatedAssets
    .map(asset => {
      const amount = calculateAssetTWD(asset, rate);
      const percentage = totalValue > 0 ? (amount / totalValue) * 100 : 0;
      const details = `${asset.quantity} × ${asset.pricePerUnit} ${asset.currency}`;
      
      // 顯示股票代號和名稱 - 股票代號在最前面
      const displayName = asset.symbol 
        ? `${asset.symbol} ${asset.name}`
        : asset.name;
      
      return {
        name: displayName || '未命名資產',
        amount,
        percentage,
        details,
        symbol: asset.symbol,
        type: asset.type,
        isMultiple: asset.holdings && asset.holdings.length > 1
      };
    })
    .sort((a, b) => b.amount - a.amount);

  // 計算負債明細
  const liabilityItems = liabilities
    .map(liability => {
      const amount = toTWD(liability, rate);
      const percentage = totalValue > 0 ? (amount / totalValue) * 100 : 0;
      const details = `${liability.amount} ${liability.currency}`;
      return {
        name: liability.name || '未命名負債',
        amount,
        percentage,
        details,
        category: liability.category,
        interestRate: liability.interestRate || null,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  return {
    investmentAssets,
    liabilityItems,
    totals
  };
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
/**
 * 計算資產月增率（%）- 向後兼容版本
 * 直接計算，避免循環調用
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

  // 嘗試計算真實月增率
  const targetDate = new Date(latestDate);
  targetDate.setMonth(targetDate.getMonth() - 1);

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

  // 如果找到上月資料，計算真實月增率
  if (bestSnapshot && bestSnapshot.netWorth !== 0) {
    return ((latest.netWorth - bestSnapshot.netWorth) / Math.abs(bestSnapshot.netWorth)) * 100;
  }

  // 否則計算估算月增率
  if (sorted.length < 2) return null;
  
  const earliest = sorted[sorted.length - 1];
  const earliestDate = new Date(earliest.date);
  
  const daysDiff = Math.floor((latestDate.getTime() - earliestDate.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysDiff <= 0 || earliest.netWorth === 0) return null;
  
  const periodGrowthRate = ((latest.netWorth - earliest.netWorth) / Math.abs(earliest.netWorth)) * 100;
  
  return (periodGrowthRate / daysDiff) * 30;
}

// ─── 貸款攤還計算 ─────────────────────────────────────────────────────────────

/**
 * 計算等額本息還款明細表。
 *
 * @param {number} principal  貸款本金
 * @param {number} annualRate 年利率 (%)，例如 2.5 代表 2.5%
 * @param {number} totalTerms 總期數（月）
 * @returns {{
 *   monthlyPayment: number,
 *   totalPayment: number,
 *   totalInterest: number,
 *   schedule: Array<{
 *     term: number,
 *     principalPart: number,
 *     interestPart: number,
 *     payment: number,
 *     remainingBalance: number,
 *     cumulativeInterest: number
 *   }>
 * }}
 */
export function calculateLoanSchedule(principal, annualRate, totalTerms) {
  if (!principal || principal <= 0 || !totalTerms || totalTerms <= 0) {
    return { monthlyPayment: 0, totalPayment: 0, totalInterest: 0, schedule: [] };
  }

  const monthlyRate = (annualRate / 100) / 12;
  let monthlyPayment;

  if (monthlyRate === 0) {
    monthlyPayment = Math.round(principal / totalTerms);
  } else {
    const factor = Math.pow(1 + monthlyRate, totalTerms);
    monthlyPayment = Math.round(principal * monthlyRate * factor / (factor - 1));
  }

  const schedule = [];
  let balance = principal; // 用整數追蹤餘額
  let cumulativeInterest = 0;

  for (let i = 1; i <= totalTerms; i++) {
    // 銀行做法：利息 = 餘額 × 月利率，取整
    const interestPart = Math.round(balance * monthlyRate);
    let principalPart;
    let payment;

    if (i === totalTerms) {
      // 最後一期：還清所有剩餘本金
      principalPart = balance;
      payment = balance + interestPart;
    } else {
      payment = monthlyPayment;
      principalPart = payment - interestPart;
    }

    balance -= principalPart;
    cumulativeInterest += interestPart;

    schedule.push({
      term: i,
      principalPart,
      interestPart,
      payment,
      remainingBalance: Math.max(0, balance),
      cumulativeInterest,
    });
  }

  const actualTotalPayment = schedule.reduce((sum, r) => sum + r.payment, 0);
  const lastPayment = schedule.length > 0 ? schedule[schedule.length - 1].payment : 0;
  const hasIrregularLast = lastPayment !== monthlyPayment;

  return {
    monthlyPayment,
    lastMonthPayment: lastPayment,
    hasIrregularLast,
    totalPayment: actualTotalPayment,
    totalInterest: cumulativeInterest,
    schedule,
  };
}

/**
 * 計算本金平均攤還（等額本金）還款明細表。
 * 每期還本金額固定，利息逐月遞減。
 *
 * @param {number} principal  貸款本金
 * @param {number} annualRate 年利率 (%)
 * @param {number} totalTerms 總期數（月）
 * @returns {same as calculateLoanSchedule}
 */
export function calculateEqualPrincipalSchedule(principal, annualRate, totalTerms) {
  if (!principal || principal <= 0 || !totalTerms || totalTerms <= 0) {
    return { monthlyPayment: 0, lastMonthPayment: 0, hasIrregularLast: false, totalPayment: 0, totalInterest: 0, schedule: [] };
  }

  const monthlyRate = (annualRate / 100) / 12;
  const fixedPrincipal = Math.round(principal / totalTerms);

  const schedule = [];
  let balance = principal;
  let cumulativeInterest = 0;

  for (let i = 1; i <= totalTerms; i++) {
    const interestPart = Math.round(balance * monthlyRate);
    const principalPart = (i === totalTerms) ? balance : fixedPrincipal;
    const payment = principalPart + interestPart;

    balance -= principalPart;
    cumulativeInterest += interestPart;

    schedule.push({
      term: i,
      principalPart,
      interestPart,
      payment,
      remainingBalance: Math.max(0, balance),
      cumulativeInterest,
    });
  }

  const firstPayment = schedule[0]?.payment || 0;
  const lastPayment = schedule[schedule.length - 1]?.payment || 0;
  const actualTotalPayment = schedule.reduce((sum, r) => sum + r.payment, 0);

  return {
    monthlyPayment: firstPayment,
    lastMonthPayment: lastPayment,
    hasIrregularLast: true, // 本金攤還每期都不同
    totalPayment: actualTotalPayment,
    totalInterest: cumulativeInterest,
    schedule,
  };
}
