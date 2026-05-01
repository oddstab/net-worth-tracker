/**
 * localeFormatter.js — 數字與日期本地化格式化
 *
 * 使用 Intl.NumberFormat 與 Intl.DateTimeFormat 根據當前 Locale 格式化。
 * 語言切換時立即以新 Locale 重新格式化。
 */

import { locale } from '$lib/stores/locale.js';

/** 快取當前語言值 */
let currentLocale = 'zh-TW';
locale.subscribe(v => { currentLocale = v; });

/**
 * 格式化貨幣金額。
 * 使用 Intl.NumberFormat 根據當前 Locale 格式化。
 *
 * @param {number} amount — 金額
 * @param {string} [currency='TWD'] — 幣別代碼
 * @returns {string} 格式化後的貨幣字串
 */
export function formatCurrency(amount, currency = 'TWD') {
  return new Intl.NumberFormat(currentLocale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
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
