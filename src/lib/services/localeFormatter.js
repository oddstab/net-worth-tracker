/**
 * localeFormatter.js — 數字與日期本地化格式化
 *
 * 使用 Intl.NumberFormat 與 Intl.DateTimeFormat 根據當前 Locale 格式化。
 * 語言切換時立即以新 Locale 重新格式化。
 *
 * 當顯示貨幣非 TWD 時，自動將 TWD 金額除以對應匯率後以目標貨幣格式化。
 */

import { locale } from '$lib/stores/locale.js';
import { displayCurrency } from '$lib/stores/displayCurrency.js';
import { exchangeRateMap, CURRENCY_DECIMALS } from '$lib/stores/exchangeRateMap.js';

/** 快取當前語言值 */
let currentLocale = 'zh-TW';
locale.subscribe(v => { currentLocale = v; });

/** 快取當前顯示貨幣 */
let currentDisplayCurrency = 'TWD';
displayCurrency.subscribe(v => { currentDisplayCurrency = v; });

/** 快取當前匯率對照表 */
let currentRateMap = { TWD: 1, USD: 31.5, CNY: 4.35, JPY: 0.21, KRW: 0.023 };
exchangeRateMap.subscribe(v => { currentRateMap = v; });

/**
 * 將 TWD 金額轉換為目標顯示貨幣金額。
 * 若顯示貨幣為 TWD，直接回傳原始金額（不換算）。
 *
 * @param {number} twdAmount — TWD 金額
 * @returns {number} 轉換後的金額
 */
export function convertAmount(twdAmount) {
  if (currentDisplayCurrency === 'TWD') {
    return twdAmount;
  }
  const rate = currentRateMap[currentDisplayCurrency];
  if (rate && rate > 0) {
    return twdAmount / rate;
  }
  return twdAmount;
}

/**
 * 格式化貨幣金額。
 * 若 displayCurrency 非 TWD，先將 TWD 金額除以匯率再格式化。
 * 使用 Intl.NumberFormat 根據當前 Locale 與目標貨幣格式化。
 *
 * @param {number} amount — TWD 金額
 * @param {string} [currency='TWD'] — 原始幣別（保留向後相容）
 * @returns {string} 格式化後的貨幣字串
 */
export function formatCurrency(amount, currency = 'TWD') {
  const target = currentDisplayCurrency;
  const displayAmount = convertAmount(amount);
  const decimals = CURRENCY_DECIMALS[target] ?? 0;

  return new Intl.NumberFormat(currentLocale, {
    style: 'currency',
    currency: target,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(displayAmount);
}

/**
 * 格式化金額為簡潔格式（compact notation）。
 * PieChart 中央淨資產等需要簡潔顯示的場景使用。
 * 套用與 formatCurrency 相同的貨幣換算邏輯。
 *
 * @param {number} value — TWD 金額
 * @returns {string} 簡潔格式化後的貨幣字串
 */
export function formatCompact(value) {
  const target = currentDisplayCurrency;
  const displayAmount = convertAmount(value);
  const decimals = CURRENCY_DECIMALS[target] ?? 0;
  const abs = Math.abs(displayAmount);

  // 金額 >= 10000 時使用 compact notation
  if (abs >= 10000) {
    try {
      return new Intl.NumberFormat(currentLocale, {
        style: 'currency',
        currency: target,
        notation: 'compact',
        maximumFractionDigits: 0,
      }).format(displayAmount);
    } catch {
      // compact notation 不支援時 fallback 至一般格式
    }
  }

  return new Intl.NumberFormat(currentLocale, {
    style: 'currency',
    currency: target,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(displayAmount);
}

/**
 * 格式化百分比數值。
 * 輸入值為百分比數字（如 5.25 代表 5.25%），內部除以 100 後格式化。
 *
 * @param {number} value — 百分比數值（如 5.25）
 * @returns {string} 格式化後的百分比字串
 */
export function formatPercent(value) {
  return new Intl.NumberFormat(currentLocale, {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value / 100);
}

/**
 * 格式化日期字串。
 * 使用 Intl.DateTimeFormat 根據當前 Locale 格式化。
 *
 * @param {string} dateStr — 日期字串（如 '2024-01-15'）
 * @returns {string} 格式化後的日期字串
 */
export function formatDate(dateStr) {
  return new Intl.DateTimeFormat(currentLocale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date(dateStr));
}
