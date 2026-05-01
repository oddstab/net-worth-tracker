/**
 * modalState.js — 全域 Modal 狀態 store
 *
 * 讓 FAB（在 layout 層級）能觸發資產/負債 Modal 的開啟，
 * 由資產頁面訂閱並回應。
 */

import { writable } from 'svelte/store';

/**
 * 待開啟的 Modal 類型。
 * 值為 null 表示無待開啟的 Modal。
 * @type {import('svelte/store').Writable<'asset' | 'liability' | null>}
 */
export const pendingModal = writable(null);

/**
 * 請求開啟新增資產 Modal。
 */
export function requestAddAsset() {
  pendingModal.set('asset');
}

/**
 * 請求開啟新增負債 Modal。
 */
export function requestAddLiability() {
  pendingModal.set('liability');
}

/**
 * 清除待開啟狀態（由頁面消費後呼叫）。
 */
export function clearPendingModal() {
  pendingModal.set(null);
}
