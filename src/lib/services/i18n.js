/**
 * i18n.js — 國際化核心服務
 *
 * 提供翻譯函式 t(key, params)，支援巢狀 key（如 'nav.dashboard'）與 {param} 插值。
 * 回退機制：當前語言 → zh-TW → key 本身。
 * 建立 tStore derived store 供 Svelte 模板使用。
 */

import { derived } from 'svelte/store';
import { locale } from '$lib/stores/locale.js';
import zhTW from '$lib/i18n/zh-TW.json';
import zhCN from '$lib/i18n/zh-CN.json';
import ja from '$lib/i18n/ja.json';
import en from '$lib/i18n/en.json';
import ko from '$lib/i18n/ko.json';

/** 所有語言翻譯對照表 */
const TRANSLATIONS = { 'zh-TW': zhTW, 'zh-CN': zhCN, ja, en, ko };

/** 預設語言（回退目標） */
const DEFAULT_LOCALE = 'zh-TW';

/** 支援的語言清單 */
export const SUPPORTED_LOCALES = ['zh-TW', 'zh-CN', 'ja', 'en', 'ko'];

/** 語言原生名稱對照 */
export const LOCALE_NAMES = {
  'zh-TW': '繁體中文',
  'zh-CN': '简体中文',
  'ja': '日本語',
  'en': 'English',
  'ko': '한국어'
};

/**
 * 從巢狀物件中依路徑取值。
 * @param {object} obj — 翻譯物件
 * @param {string} path — 以 '.' 分隔的鍵路徑
 * @returns {string|undefined}
 */
function getNestedValue(obj, path) {
  return path.split('.').reduce((o, k) => o?.[k], obj);
}

/** 快取當前語言值，避免每次呼叫 t() 都建立新的 subscription */
let _currentLocale = DEFAULT_LOCALE;
locale.subscribe(v => { _currentLocale = v; });

/**
 * 翻譯函式 — 支援巢狀 key 與插值參數。
 *
 * 回退機制：
 * 1. 當前語言翻譯
 * 2. zh-TW 翻譯（預設語言）
 * 3. 回傳 key 本身
 *
 * @param {string} key — 翻譯鍵（支援巢狀，如 'nav.dashboard'）
 * @param {Record<string, string|number>} [params={}] — 插值參數
 * @returns {string} 翻譯後的字串
 */
export function t(key, params = {}) {
  // 嘗試當前語言
  let value = getNestedValue(TRANSLATIONS[_currentLocale], key);

  // 回退至 zh-TW
  if (value === undefined && _currentLocale !== DEFAULT_LOCALE) {
    value = getNestedValue(TRANSLATIONS[DEFAULT_LOCALE], key);
  }

  // 若仍找不到，回傳 key 本身
  if (value === undefined) return key;

  // 插值替換 {param}
  return value.replace(/\{(\w+)\}/g, (_, k) =>
    params[k] !== undefined ? String(params[k]) : `{${k}}`
  );
}

/**
 * 響應式翻譯 store — 供 Svelte 模板中使用 $tStore('key')。
 * 每次語言切換時自動更新。
 */
export const tStore = derived(locale, () => t);

/**
 * 切換語言。
 * 更新 locale store（自動觸發 localStorage 持久化與 <html lang> 更新）。
 * @param {string} newLocale — 語言代碼
 */
export function setLocale(newLocale) {
  if (SUPPORTED_LOCALES.includes(newLocale)) {
    locale.set(newLocale);
  }
}

/**
 * 取得當前語言代碼。
 * @returns {string}
 */
export function getCurrentLocale() {
  return _currentLocale;
}

/**
 * 取得翻譯物件（供測試使用）。
 * @returns {object}
 */
export function getTranslations() {
  return TRANSLATIONS;
}
