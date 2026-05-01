/**
 * derived.js — 衍生 stores
 *
 * 使用 Svelte derived store 從基礎 stores 計算衍生資料。
 * - totals：從 assets、liabilities、exchangeRate 計算淨資產與分類小計
 * - growthRates：從 snapshots 計算月增率與今日漲跌幅
 * - pieChartData：從 totals 計算圓餅圖標籤、金額與百分比
 */

import { derived } from 'svelte/store';
import { assets } from './assets.js';
import { liabilities } from './liabilities.js';
import { exchangeRate } from './exchangeRate.js';
import { snapshots } from './snapshots.js';
import { calculateTotals, calculateGrowthRates, calculatePieChartData } from '$lib/utils/calculator.js';

/**
 * 淨資產與分類小計 — derived from [assets, liabilities, exchangeRate]。
 * 每當任一來源 store 變更時自動重新計算。
 */
export const totals = derived(
  [assets, liabilities, exchangeRate],
  ([$assets, $liabilities, $rate]) => calculateTotals($assets, $liabilities, $rate)
);

/**
 * 月增率與今日漲跌幅 — derived from snapshots。
 * 每當快照陣列變更時自動重新計算。
 */
export const growthRates = derived(
  snapshots,
  ($snapshots) => calculateGrowthRates($snapshots)
);

/**
 * 圓餅圖資料（標籤、金額、百分比） — derived from totals。
 * 每當 totals 變更時自動重新計算。
 */
export const pieChartData = derived(
  totals,
  ($totals) => calculatePieChartData($totals)
);
