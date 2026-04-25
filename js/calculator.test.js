/**
 * calculator.test.js — 計算核心函式單元測試
 */
import { describe, it, expect } from 'vitest';
import {
  toTWD,
  calculateAssetTWD,
  calculateTotals,
  calculateMonthlyGrowthRate,
  calculatePieChartData,
  validateQuantity,
  validatePrice,
  validateAmount,
  validateExchangeRate,
} from './calculator.js';

// ─── toTWD ───────────────────────────────────────────────────────────────────

describe('toTWD', () => {
  it('USD 資產：quantity × pricePerUnit × rate', () => {
    const asset = { quantity: 2, pricePerUnit: 100, currency: 'USD' };
    expect(toTWD(asset, 31.5)).toBe(6300);
  });

  it('TWD 資產：quantity × pricePerUnit（rate 不影響）', () => {
    const asset = { quantity: 10, pricePerUnit: 50, currency: 'TWD' };
    expect(toTWD(asset, 31.5)).toBe(500);
  });

  it('USD 負債：amount × rate', () => {
    const liability = { amount: 1000, currency: 'USD' };
    expect(toTWD(liability, 31.5)).toBe(31500);
  });

  it('TWD 負債：直接回傳 amount', () => {
    const liability = { amount: 5000, currency: 'TWD' };
    expect(toTWD(liability, 31.5)).toBe(5000);
  });
});

// ─── calculateAssetTWD ───────────────────────────────────────────────────────

describe('calculateAssetTWD', () => {
  it('USD 資產：quantity × pricePerUnit × rate', () => {
    const asset = { quantity: 2, pricePerUnit: 100, currency: 'USD' };
    expect(calculateAssetTWD(asset, 31.5)).toBe(6300);
  });

  it('TWD 資產：quantity × pricePerUnit', () => {
    const asset = { quantity: 10, pricePerUnit: 50, currency: 'TWD' };
    expect(calculateAssetTWD(asset, 31.5)).toBe(500);
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

  it('totalLiabilities = creditTotal + pledgeTotal', () => {
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
    expect(totals.pledgeTotal).toBe(0);
    expect(totals.totalLiabilities).toBe(0);
    expect(totals.netWorth).toBe(0);
  });
});

// ─── calculateMonthlyGrowthRate ──────────────────────────────────────────────

describe('calculateMonthlyGrowthRate', () => {
  it('空陣列回傳 null', () => {
    expect(calculateMonthlyGrowthRate([])).toBeNull();
  });

  it('只有一筆快照回傳 null', () => {
    expect(calculateMonthlyGrowthRate([{ date: '2025-01-01', netWorth: 100 }])).toBeNull();
  });

  it('上月同日快照存在時計算正確月增率', () => {
    const snapshots = [
      { date: '2025-06-15', netWorth: 110 },
      { date: '2025-05-15', netWorth: 100 },
    ];
    const rate = calculateMonthlyGrowthRate(snapshots);
    expect(rate).toBeCloseTo(10, 5);
  });

  it('上月淨資產為 0 時回傳 null', () => {
    const snapshots = [
      { date: '2025-06-15', netWorth: 110 },
      { date: '2025-05-15', netWorth: 0 },
    ];
    expect(calculateMonthlyGrowthRate(snapshots)).toBeNull();
  });

  it('無上月同日（±3天容差）快照時回傳 null', () => {
    const snapshots = [
      { date: '2025-06-15', netWorth: 110 },
      { date: '2025-04-01', netWorth: 100 }, // 超過 ±3 天容差
    ];
    expect(calculateMonthlyGrowthRate(snapshots)).toBeNull();
  });

  it('上月快照在容差範圍內（+2天）仍可計算', () => {
    const snapshots = [
      { date: '2025-06-15', netWorth: 110 },
      { date: '2025-05-17', netWorth: 100 }, // 目標 05-15，+2 天
    ];
    const rate = calculateMonthlyGrowthRate(snapshots);
    expect(rate).toBeCloseTo(10, 5);
  });

  it('負增長計算正確', () => {
    const snapshots = [
      { date: '2025-06-15', netWorth: 90 },
      { date: '2025-05-15', netWorth: 100 },
    ];
    const rate = calculateMonthlyGrowthRate(snapshots);
    expect(rate).toBeCloseTo(-10, 5);
  });
});

// ─── calculatePieChartData ───────────────────────────────────────────────────

describe('calculatePieChartData', () => {
  it('回傳正確的 labels', () => {
    const data = calculatePieChartData({ investmentTotal: 300, liquidTotal: 100, totalLiabilities: 100 });
    expect(data.labels).toEqual(['投資資產', '流動資產', '債務']);
  });

  it('回傳正確的 values', () => {
    const data = calculatePieChartData({ investmentTotal: 300, liquidTotal: 100, totalLiabilities: 100 });
    expect(data.values).toEqual([300, 100, 100]);
  });

  it('percentages 加總約為 100', () => {
    const data = calculatePieChartData({ investmentTotal: 300, liquidTotal: 100, totalLiabilities: 100 });
    const sum = data.percentages.reduce((a, b) => a + b, 0);
    expect(Math.abs(sum - 100)).toBeLessThan(0.0001);
  });

  it('所有值為 0 時 percentages 全為 0', () => {
    const data = calculatePieChartData({ investmentTotal: 0, liquidTotal: 0, totalLiabilities: 0 });
    expect(data.percentages).toEqual([0, 0, 0]);
  });

  it('比例計算正確（各佔 60%、20%、20%）', () => {
    const data = calculatePieChartData({ investmentTotal: 300, liquidTotal: 100, totalLiabilities: 100 });
    expect(data.percentages[0]).toBeCloseTo(60, 5);
    expect(data.percentages[1]).toBeCloseTo(20, 5);
    expect(data.percentages[2]).toBeCloseTo(20, 5);
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
