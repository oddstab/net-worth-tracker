/**
 * locale.js — 語言 writable store
 *
 * 管理當前語言設定，初始值從 localStorage `nwt_locale` 讀取，預設 `zh-TW`。
 * 語言切換時自動持久化至 localStorage 並更新 <html lang> 屬性。
 */

import { writable } from 'svelte/store';

/** localStorage 儲存鍵 */
const STORAGE_KEY = 'nwt_locale';

/** 預設語言 */
const DEFAULT_LOCALE = 'zh-TW';

/**
 * 取得初始語言設定。
 * 優先從 localStorage 讀取，若無則使用預設值。
 * @returns {string} 語言代碼
 */
function getInitialLocale() {
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_LOCALE;
  }
  return DEFAULT_LOCALE;
}

/** 語言 writable store */
export const locale = writable(getInitialLocale());

// 語言切換時持久化並更新 <html lang>
locale.subscribe(($locale) => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, $locale);
  }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = $locale;
  }
});
