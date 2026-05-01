/**
 * toast.js — Toast 通知 store
 *
 * 提供全域 showToast(message, type) 函式，
 * 顯示後 2.5 秒自動隱藏。
 */

import { writable } from 'svelte/store';

/** Toast 訊息內容 */
export const toastMessage = writable('');

/** Toast 類型：'success' | 'error' */
export const toastType = writable('success');

/** Toast 是否可見 */
export const toastVisible = writable(false);

/** 自動隱藏計時器 ID */
let hideTimer = null;

/** 自動隱藏延遲（毫秒） */
const AUTO_HIDE_MS = 2500;

/**
 * 顯示全域 Toast 通知。
 * @param {string} message — 通知訊息
 * @param {'success' | 'error'} [type='success'] — 通知類型
 */
export function showToast(message, type = 'success') {
  /* 清除前一個計時器，避免提前隱藏 */
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }

  toastMessage.set(message);
  toastType.set(type);
  toastVisible.set(true);

  /* 2.5 秒後自動隱藏 */
  hideTimer = setTimeout(() => {
    toastVisible.set(false);
    hideTimer = null;
  }, AUTO_HIDE_MS);
}
