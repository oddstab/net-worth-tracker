/**
 * confirmDialog.js — 確認對話框 store
 *
 * 提供全域 showConfirmDialog(title, message, onConfirm) 函式，
 * 取代瀏覽器原生 confirm()。
 */

import { writable } from 'svelte/store';

/** 對話框是否可見 */
export const confirmVisible = writable(false);

/** 對話框標題 */
export const confirmTitle = writable('');

/** 對話框訊息 */
export const confirmMessage = writable('');

/** 確認回呼函式 */
export const confirmOnConfirm = writable(null);

/**
 * 顯示確認對話框。
 * @param {string} title — 對話框標題
 * @param {string} message — 對話框訊息
 * @param {Function} onConfirm — 使用者確認後的回呼函式
 */
export function showConfirmDialog(title, message, onConfirm) {
  confirmTitle.set(title);
  confirmMessage.set(message);
  confirmOnConfirm.set(onConfirm);
  confirmVisible.set(true);
}

/**
 * 隱藏確認對話框。
 */
export function hideConfirmDialog() {
  confirmVisible.set(false);
  confirmOnConfirm.set(null);
}
