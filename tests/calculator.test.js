/**
 * calculator.test.js — Calculator 純函式模組單元測試
 *
 * 測試 src/lib/utils/calculator.js 的所有匯出函式。
 */
import { describe, it, expect } from 'vitest';
import {
  calculateAssetTWD,
  calculateTotals,
  calculateGrowthRates,
  calculatePieChartData,
  validateQuantity,
  validatePrice,
  validateAmount,
  validateExchangeRate,
} from '../src/lib/utils/calculator.js';

// ─── calculateAssetTWD ───────────────────────────────────────────────────────

describe('calculateAssetTWD', () => {
  it('TWD 資產：quantity × pricePerUnit（匯率不影響）', () => {
    expect(calculateAssetTWD(10, 50, 'TWD', 31.5)).toBe(500);
  });

  it('USD 資產：quantity × pricePerUnit × exchangeRate', () => {
    expect(calculateAssetTWD(2, 100, 'USD', 31.5)).toBe(6300);
  });

  it('數量為小數時計算正確', () => {
    expect(calculateAssetTWD(0.5, 200, 'TWD', 31.5)).toBe(100);
  });

  it('匯率為 1 時 USD 與 TWD 結果相同', () => {
    const twdResult = calculateAssetTWD(10, 100, 'TWD', 1);
    const usdResult = calculateAssetTWD(10, 100, 'USD', 1);
    expect(twdResult).toBe(usdResult);
  });
});

// ─── calculateTotals ─────────────────────────────────────────────────────────

describe('calculateTotals', () => {
  const assets = [
    { quantity: 100, pricePerUnit: 30, currency: 'TWD', category: 'investment' },
    { quantity: 1, pricePerUnit: 100, currency: 'USD', category: 'liquid' },
  ];
  const liabilities = [
    { amount: 1000, currency: 'TWD', category: 'credit' },
    { amount: 10, currency: 'USD', category: 'pledge' },
  ];
  const rate = 31.5;

  it('investmentTotal 正確', () => {
    const { investmentTotal } = calculateTotals(assets, liabilities, rate);
    expect(investmentTotal).toBe(3000); // 100 × 30 × 1
  });

  it('liquidTotal 正確', () => {
    const { liquidTotal } = calculateTotals(assets, liabilities, rate);
    expect(liquidTotal).toBe(3150); // 1 × 100 × 31.5
  });

  it('totalAssets = investmentTotal + liquidTotal', () => {
    const { investmentTotal, liquidTotal, totalAssets } = calculateTotals(assets, liabilities, rate);
    expect(totalAssets).toBe(investmentTotal + liquidTotal);
  });

  it('creditTotal 正確', () => {
    const { creditTotal } = calculateTotals(assets, liabilities, rate);
    expect(creditTotal).toBe(1000);
  });

  it('pledgeTotal 正確', () => {
    const { pledgeTotal } = calculateTotals(assets, liabilities, rate);
    expect(pledgeTotal).toBe(315); // 10 × 31.5
  });

  it('totalLiabilities 包含所有負債分類', () => {
    const { creditTotal, pledgeTotal, totalLiabilities } = calculateTotals(assets, liabilities, rate);
    expect(totalLiabilities).toBe(creditTotal + pledgeTotal);
  });

  it('netWorth = totalAssets - totalLiabilities', () => {
    const { totalAssets, totalLiabilities, netWorth } = calculateTotals(assets, liabilities, rate);
    expect(netWorth).toBe(totalAssets - totalLiabilities);
  });

  it('空陣列時所有值為 0', () => {
    const totals = calculateTotals([], [], 31.5);
    expect(totals.investmentTotal).toBe(0);
    expect(totals.liquidTotal).toBe(0);
    expect(totals.totalAssets).toBe(0);
    expect(totals.creditTotal).toBe(0);
    expect(totals.homeLoanTotal).toBe(0);
    expect(totals.pledgeTotal).toBe(0);
    expect(totals.mortgageTotal).toBe(0);
    expect(totals.otherLiabilityTotal).toBe(0);
    expect(totals.totalLiabilities).toBe(0);
    expect(totals.netWorth).toBe(0);
  });

  it('所有五種負債分類皆正確計算', () => {
    const allLiabilities = [
      { amount: 100, currency: 'TWD', category: 'credit' },
      { amount: 200, currency: 'TWD', category: 'home_loan' },
      { amount: 300, currency: 'TWD', category: 'pledge' },
      { amount: 400, currency: 'TWD', category: 'mortgage' },
      { amount: 500, currency: 'TWD', category: 'other' },
    ];
    const totals = calculateTotals([], allLiabilities, 31.5);
    expect(totals.creditTotal).toBe(100);
    expect(totals.homeLoanTotal).toBe(200);
    expect(totals.pledgeTotal).toBe(300);
    expect(totals.mortgageTotal).toBe(400);
    expect(totals.otherLiabilityTotal).toBe(500);
    expect(totals.totalLiabilities).toBe(1500);
  });
});

// ─── calculateGrowthRates ────────────────────────────────────────────────────

describe('calculateGrowthRates', () => {
  it('空陣列回傳所有值為 null', () => {
    const result = calculateGrowthRates([]);
    expect(result.monthlyGrowthRate).toBeNull();
    expect(result.dailyGrowthRate).toBeNull();
    expect(result.estimatedMonthlyRate).toBeNull();
  });

  it('只有一筆快照回傳所有值為 null', () => {
    const result = calculateGrowthRates([{ date: '2025-01-01', netWorth: 100 }]);
    expect(result.monthlyGrowthRate).toBeNull();
    expect(result.dailyGrowthRate).toBeNull();
    expect(result.estimatedMonthlyRate).toBeNull();
  });

  it('null 輸入回傳所有值為 null', () => {
    const result = calculateGrowthRates(null);
    expect(result.monthlyGrowthRate).toBeNull();
    expect(result.dailyGrowthRate).toBeNull();
    expect(result.estimatedMonthlyRate).toBeNull();
  });

  it('上月同日快照存在時計算正確月增率', () => {
    const snapshots = [
      { date: '2025-06-15', netWorth: 110 },
      { date: '2025-05-15', netWorth: 100 },
    ];
    const { monthlyGrowthRate } = calculateGrowthRates(snapshots);
    expect(monthlyGrowthRate).toBeCloseTo(10, 5);
  });

  it('上月快照在容差範圍內（+2天）仍可計算', () => {
    const snapshots = [
      { date: '2025-06-15', netWorth: 110 },
      { date: '2025-05-17', netWorth: 100 }, // 目標 05-15，+2 天在容差內
    ];
    const { monthlyGrowthRate } = calculateGrowthRates(snapshots);
    expect(monthlyGrowthRate).toBeCloseTo(10, 5);
  });

  it('上月淨資產為 0 時月增率為 null', () => {
    const snapshots = [
      { date: '2025-06-15', netWorth: 110 },
      { date: '2025-05-15', netWorth: 0 },
    ];
    const { monthlyGrowthRate } = calculateGrowthRates(snapshots);
    expect(monthlyGrowthRate).toBeNull();
  });

  it('負增長計算正確', () => {
    const snapshots = [
      { date: '2025-06-15', netWorth: 90 },
      { date: '2025-05-15', netWorth: 100 },
    ];
    const { monthlyGrowthRate } = calculateGrowthRates(snapshots);
    expect(monthlyGrowthRate).toBeCloseTo(-10, 5);
  });

  it('今日漲跌幅計算正確', () => {
    const snapshots = [
      { date: '2025-06-15', netWorth: 105 },
      { date: '2025-06-14', netWorth: 100 },
    ];
    const { dailyGrowthRate } = calculateGrowthRates(snapshots);
    expect(dailyGrowthRate).toBeCloseTo(5, 5);
  });

  it('估算月增率基於可用天數按比例推算', () => {
    const snapshots = [
      { date: '2025-06-15', netWorth: 110 },
      { date: '2025-04-01', netWorth: 100 }, // 75 天前
    ];
    const { estimatedMonthlyRate } = calculateGrowthRates(snapshots);
    // (110-100)/100 * 100 = 10%，期間 75 天，估算 30 天增率 = 10/75*30 = 4%
    expect(estimatedMonthlyRate).toBeCloseTo(4, 1);
  });
});

// ─── calculatePieChartData ───────────────────────────────────────────────────

describe('calculatePieChartData', () => {
  it('回傳正確的 labels', () => {
    const data = calculatePieChartData({ investmentTotal: 300, liquidTotal: 100, totalLiabilities: 100 });
    expect(data.labels).toEqual(['投資資產', '債務']);
  });

  it('回傳正確的 values（投資+流動合併）', () => {
    const data = calculatePieChartData({ investmentTotal: 300, liquidTotal: 100, totalLiabilities: 100 });
    expect(data.values).toEqual([400, 100]);
  });

  it('percentages 加總約為 100', () => {
    const data = calculatePieChartData({ investmentTotal: 300, liquidTotal: 100, totalLiabilities: 100 });
    const sum = data.percentages.reduce((a, b) => a + b, 0);
    expect(Math.abs(sum - 100)).toBeLessThan(0.1);
  });

  it('所有值為 0 時 percentages 全為 0', () => {
    const data = calculatePieChartData({ investmentTotal: 0, liquidTotal: 0, totalLiabilities: 0 });
    expect(data.percentages).toEqual([0, 0]);
  });

  it('比例計算正確（80% 資產、20% 債務）', () => {
    const data = calculatePieChartData({ investmentTotal: 300, liquidTotal: 100, totalLiabilities: 100 });
    expect(data.percentages[0]).toBeCloseTo(80, 5);
    expect(data.percentages[1]).toBeCloseTo(20, 5);
  });

  it('缺少 liquidTotal 時視為 0', () => {
    const data = calculatePieChartData({ investmentTotal: 100, totalLiabilities: 100 });
    expect(data.values[0]).toBe(100);
  });
});

// ─── 驗證函式 ────────────────────────────────────────────────────────────────

describe('validateQuantity', () => {
  it('正數回傳 true', () => expect(validateQuantity(1)).toBe(true));
  it('小數正數回傳 true', () => expect(validateQuantity(0.001)).toBe(true));
  it('0 回傳 false', () => expect(validateQuantity(0)).toBe(false));
  it('負數回傳 false', () => expect(validateQuantity(-1)).toBe(false));
  it('Infinity 回傳 false', () => expect(validateQuantity(Infinity)).toBe(false));
  it('NaN 回傳 false', () => expect(validateQuantity(NaN)).toBe(false));
  it('字串回傳 false', () => expect(validateQuantity('1')).toBe(false));
});

describe('validatePrice', () => {
  it('正數回傳 true', () => expect(validatePrice(100)).toBe(true));
  it('0 回傳 false', () => expect(validatePrice(0)).toBe(false));
  it('負數回傳 false', () => expect(validatePrice(-0.01)).toBe(false));
  it('Infinity 回傳 false', () => expect(validatePrice(Infinity)).toBe(false));
});

describe('validateAmount', () => {
  it('正數回傳 true', () => expect(validateAmount(1000)).toBe(true));
  it('0 回傳 false', () => expect(validateAmount(0)).toBe(false));
  it('負數回傳 false', () => expect(validateAmount(-5)).toBe(false));
  it('Infinity 回傳 false', () => expect(validateAmount(Infinity)).toBe(false));
});

describe('validateExchangeRate', () => {
  it('正數回傳 true', () => expect(validateExchangeRate(31.5)).toBe(true));
  it('0 回傳 false', () => expect(validateExchangeRate(0)).toBe(false));
  it('負數回傳 false', () => expect(validateExchangeRate(-1)).toBe(false));
  it('Infinity 回傳 false', () => expect(validateExchangeRate(Infinity)).toBe(false));
});

// ─── calculateLoanSchedule（等額本息） ────────────────────────────────────────

import {
  calculateLoanSchedule,
  calculateEqualPrincipalSchedule,
} from '../src/lib/utils/calculator.js';

describe('calculateLoanSchedule（等額本息）', () => {
  it('無效參數回傳空陣列', () => {
    expect(calculateLoanSchedule(0, 2.5, 12)).toEqual([]);
    expect(calculateLoanSchedule(-1000, 2.5, 12)).toEqual([]);
    expect(calculateLoanSchedule(1000, 2.5, 0)).toEqual([]);
    expect(calculateLoanSchedule(1000, 2.5, -1)).toEqual([]);
  });

  it('回傳正確的期數', () => {
    const schedule = calculateLoanSchedule(120000, 2.4, 12);
    expect(schedule.length).toBe(12);
    expect(schedule[0].period).toBe(1);
    expect(schedule[11].period).toBe(12);
  });

  it('最後一期 remainingBalance 為 0', () => {
    const schedule = calculateLoanSchedule(1000000, 3.0, 36);
    const last = schedule[schedule.length - 1];
    expect(last.remainingBalance).toBe(0);
  });

  it('所有期數 principalPart 加總等於本金', () => {
    const principal = 1000000;
    const schedule = calculateLoanSchedule(principal, 2.5, 24);
    const totalPrincipal = schedule.reduce((sum, r) => sum + r.principalPart, 0);
    expect(totalPrincipal).toBe(principal);
  });

  it('每期回傳正確的欄位結構', () => {
    const schedule = calculateLoanSchedule(100000, 2.0, 6);
    const first = schedule[0];
    expect(first).toHaveProperty('period');
    expect(first).toHaveProperty('principalPart');
    expect(first).toHaveProperty('interestPart');
    expect(first).toHaveProperty('monthlyPayment');
    expect(first).toHaveProperty('remainingBalance');
    expect(first).toHaveProperty('cumulativeInterest');
  });

  it('cumulativeInterest 逐期遞增', () => {
    const schedule = calculateLoanSchedule(500000, 3.0, 12);
    for (let i = 1; i < schedule.length; i++) {
      expect(schedule[i].cumulativeInterest).toBeGreaterThanOrEqual(schedule[i - 1].cumulativeInterest);
    }
  });

  it('零利率時無利息，本金平均分攤', () => {
    const schedule = calculateLoanSchedule(12000, 0, 12);
    expect(schedule.length).toBe(12);
    // 每期利息為 0
    for (const row of schedule) {
      expect(row.interestPart).toBe(0);
    }
    // 最後一期餘額歸零
    expect(schedule[schedule.length - 1].remainingBalance).toBe(0);
    // 還本加總等於本金
    const totalPrincipal = schedule.reduce((sum, r) => sum + r.principalPart, 0);
    expect(totalPrincipal).toBe(12000);
  });

  it('monthlyPayment = principalPart + interestPart（每期）', () => {
    const schedule = calculateLoanSchedule(500000, 2.5, 24);
    for (const row of schedule) {
      expect(row.monthlyPayment).toBe(row.principalPart + row.interestPart);
    }
  });
});

// ─── calculateEqualPrincipalSchedule（本金平均攤還） ──────────────────────────

describe('calculateEqualPrincipalSchedule（本金平均攤還）', () => {
  it('無效參數回傳空陣列', () => {
    expect(calculateEqualPrincipalSchedule(0, 2.5, 12)).toEqual([]);
    expect(calculateEqualPrincipalSchedule(-1000, 2.5, 12)).toEqual([]);
    expect(calculateEqualPrincipalSchedule(1000, 2.5, 0)).toEqual([]);
    expect(calculateEqualPrincipalSchedule(1000, 2.5, -1)).toEqual([]);
  });

  it('回傳正確的期數', () => {
    const schedule = calculateEqualPrincipalSchedule(120000, 2.4, 12);
    expect(schedule.length).toBe(12);
    expect(schedule[0].period).toBe(1);
    expect(schedule[11].period).toBe(12);
  });

  it('最後一期 remainingBalance 為 0', () => {
    const schedule = calculateEqualPrincipalSchedule(1000000, 3.0, 36);
    const last = schedule[schedule.length - 1];
    expect(last.remainingBalance).toBe(0);
  });

  it('所有期數 principalPart 加總等於本金', () => {
    const principal = 1000000;
    const schedule = calculateEqualPrincipalSchedule(principal, 2.5, 24);
    const totalPrincipal = schedule.reduce((sum, r) => sum + r.principalPart, 0);
    expect(totalPrincipal).toBe(principal);
  });

  it('每期回傳正確的欄位結構', () => {
    const schedule = calculateEqualPrincipalSchedule(100000, 2.0, 6);
    const first = schedule[0];
    expect(first).toHaveProperty('period');
    expect(first).toHaveProperty('principalPart');
    expect(first).toHaveProperty('interestPart');
    expect(first).toHaveProperty('monthlyPayment');
    expect(first).toHaveProperty('remainingBalance');
    expect(first).toHaveProperty('cumulativeInterest');
  });

  it('利息逐期遞減（或持平）', () => {
    const schedule = calculateEqualPrincipalSchedule(500000, 3.0, 12);
    for (let i = 1; i < schedule.length; i++) {
      expect(schedule[i].interestPart).toBeLessThanOrEqual(schedule[i - 1].interestPart);
    }
  });

  it('零利率時無利息，本金平均分攤', () => {
    const schedule = calculateEqualPrincipalSchedule(12000, 0, 12);
    expect(schedule.length).toBe(12);
    for (const row of schedule) {
      expect(row.interestPart).toBe(0);
    }
    expect(schedule[schedule.length - 1].remainingBalance).toBe(0);
    const totalPrincipal = schedule.reduce((sum, r) => sum + r.principalPart, 0);
    expect(totalPrincipal).toBe(12000);
  });

  it('monthlyPayment = principalPart + interestPart（每期）', () => {
    const schedule = calculateEqualPrincipalSchedule(500000, 2.5, 24);
    for (const row of schedule) {
      expect(row.monthlyPayment).toBe(row.principalPart + row.interestPart);
    }
  });

  it('非最後一期的 principalPart 固定（除最後一期調整）', () => {
    const schedule = calculateEqualPrincipalSchedule(100000, 2.0, 10);
    const fixedPrincipal = schedule[0].principalPart;
    for (let i = 0; i < schedule.length - 1; i++) {
      expect(schedule[i].principalPart).toBe(fixedPrincipal);
    }
  });
});


// ─── Property-Based Tests（屬性測試）────────────────────────────────────────
import fc from 'fast-check';

// ─── 共用 Arbitrary 定義 ─────────────────────────────────────────────────────

/** 產生有效的資產物件 */
const assetArb = fc.record({
  quantity: fc.double({ min: 0.01, max: 1e8, noNaN: true, noDefaultInfinity: true }),
  pricePerUnit: fc.double({ min: 0.01, max: 1e8, noNaN: true, noDefaultInfinity: true }),
  currency: fc.constantFrom('TWD', 'USD'),
  category: fc.constantFrom('investment', 'liquid'),
});

/** 產生有效的負債物件 */
const liabilityArb = fc.record({
  amount: fc.double({ min: 0.01, max: 1e8, noNaN: true, noDefaultInfinity: true }),
  currency: fc.constantFrom('TWD', 'USD'),
  category: fc.constantFrom('credit', 'home_loan', 'pledge', 'mortgage', 'other'),
});

/** 產生有效的正數匯率 */
const exchangeRateArb = fc.double({ min: 0.01, max: 1000, noNaN: true, noDefaultInfinity: true });

// Feature: sveltekit-spa-migration, Property 3: 淨資產不變量
// **Validates: Requirements 15.4, 15.7**
describe('Property 3: 淨資產不變量', () => {
  it('netWorth === totalAssets - totalLiabilities for any valid inputs', () => {
    fc.assert(
      fc.property(
        fc.array(assetArb, { minLength: 0, maxLength: 20 }),
        fc.array(liabilityArb, { minLength: 0, maxLength: 20 }),
        exchangeRateArb,
        (assets, liabilities, rate) => {
          const result = calculateTotals(assets, liabilities, rate);
          // 使用容差比較浮點數
          const diff = Math.abs(result.netWorth - (result.totalAssets - result.totalLiabilities));
          return diff < 1e-6;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: sveltekit-spa-migration, Property 4: TWD 轉換正數不變量
// **Validates: Requirements 15.2, 15.8**
describe('Property 4: TWD 轉換正數不變量', () => {
  it('positive quantity × pricePerUnit × exchangeRate produces positive TWD value', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.01, max: 1e8, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: 0.01, max: 1e8, noNaN: true, noDefaultInfinity: true }),
        exchangeRateArb,
        fc.constantFrom('TWD', 'USD'),
        (quantity, pricePerUnit, rate, currency) => {
          const result = calculateAssetTWD(quantity, pricePerUnit, currency, rate);
          return result > 0;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: sveltekit-spa-migration, Property 5: 貸款還本加總等於本金
// **Validates: Requirements 16.1, 16.2, 16.4**
// 注意：annualRate 使用 fc.oneof 分別測試零利率與正常利率範圍，
// 避免 fc.double 產生極小的非正規浮點數（如 3.2e-321）導致 Math.pow(1+r,n)-1 === 0 的除零問題。
describe('Property 5: 貸款還本加總等於本金', () => {
  /** 產生有效的年利率：0（零利率）或 0.01~30 之間的正常利率 */
  const annualRateArb = fc.oneof(
    fc.constant(0),
    fc.double({ min: 0.01, max: 30, noNaN: true, noDefaultInfinity: true })
  );

  it('sum of all principalPart equals original principal (等額本息)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 10_000_000 }),
        annualRateArb,
        fc.integer({ min: 1, max: 360 }),
        (principal, annualRate, terms) => {
          const schedule = calculateLoanSchedule(principal, annualRate, terms);
          if (schedule.length === 0) return false; // should not happen with valid params
          const totalPrincipal = schedule.reduce((sum, r) => sum + r.principalPart, 0);
          return totalPrincipal === principal;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('sum of all principalPart equals original principal (本金平均攤還)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 10_000_000 }),
        annualRateArb,
        fc.integer({ min: 1, max: 360 }),
        (principal, annualRate, terms) => {
          const schedule = calculateEqualPrincipalSchedule(principal, annualRate, terms);
          if (schedule.length === 0) return false;
          const totalPrincipal = schedule.reduce((sum, r) => sum + r.principalPart, 0);
          return totalPrincipal === principal;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: sveltekit-spa-migration, Property 6: 貸款最終餘額為零
// **Validates: Requirements 16.3, 16.5**
describe('Property 6: 貸款最終餘額為零', () => {
  /** 產生有效的年利率：0（零利率）或 0.01~30 之間的正常利率 */
  const annualRateArb = fc.oneof(
    fc.constant(0),
    fc.double({ min: 0.01, max: 30, noNaN: true, noDefaultInfinity: true })
  );

  it('last period remainingBalance is zero (等額本息)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 10_000_000 }),
        annualRateArb,
        fc.integer({ min: 1, max: 360 }),
        (principal, annualRate, terms) => {
          const schedule = calculateLoanSchedule(principal, annualRate, terms);
          if (schedule.length === 0) return false;
          return schedule[schedule.length - 1].remainingBalance === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('last period remainingBalance is zero (本金平均攤還)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 10_000_000 }),
        annualRateArb,
        fc.integer({ min: 1, max: 360 }),
        (principal, annualRate, terms) => {
          const schedule = calculateEqualPrincipalSchedule(principal, annualRate, terms);
          if (schedule.length === 0) return false;
          return schedule[schedule.length - 1].remainingBalance === 0;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: sveltekit-spa-migration, Property 18: 輸入驗證函式正確性
// **Validates: Requirements 15.5**
describe('Property 18: 輸入驗證函式正確性', () => {
  const validators = [
    { name: 'validateQuantity', fn: validateQuantity },
    { name: 'validatePrice', fn: validatePrice },
    { name: 'validateAmount', fn: validateAmount },
    { name: 'validateExchangeRate', fn: validateExchangeRate },
  ];

  for (const { name, fn } of validators) {
    it(`${name} returns true for finite positive numbers`, () => {
      fc.assert(
        fc.property(
          fc.double({ min: Number.MIN_VALUE, max: 1e15, noNaN: true, noDefaultInfinity: true }),
          (value) => {
            return fn(value) === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it(`${name} returns false for non-positive numbers`, () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant(0),
            fc.constant(-0),
            fc.double({ min: -1e15, max: 0, noNaN: true, noDefaultInfinity: true }),
            fc.constant(NaN),
            fc.constant(Infinity),
            fc.constant(-Infinity)
          ),
          (value) => {
            // -0 is treated as 0 by > 0 check, so it should return false
            // 0 should return false
            return fn(value) === false;
          }
        ),
        { numRuns: 100 }
      );
    });
  }
});

// Feature: sveltekit-spa-migration, Property 19: 圓餅圖百分比加總
// **Validates: Requirements 15.6**
describe('Property 19: 圓餅圖百分比加總', () => {
  it('percentages sum to ~100% (tolerance 0.1%) or all zero when totals are zero', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1e8, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: 0, max: 1e8, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: 0, max: 1e8, noNaN: true, noDefaultInfinity: true }),
        (investmentTotal, liquidTotal, totalLiabilities) => {
          const totals = { investmentTotal, liquidTotal, totalLiabilities };
          const data = calculatePieChartData(totals);
          const sum = data.percentages.reduce((a, b) => a + b, 0);

          // If all values are zero, percentages should all be 0
          if (investmentTotal + liquidTotal + totalLiabilities === 0) {
            return data.percentages.every(p => p === 0);
          }

          // Otherwise, percentages should sum to ~100% with 0.1% tolerance
          return Math.abs(sum - 100) < 0.1;
        }
      ),
      { numRuns: 100 }
    );
  });
});
