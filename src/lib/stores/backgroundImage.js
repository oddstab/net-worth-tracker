/**
 * backgroundImage.js — 背景圖片 store（多圖輪播版）
 *
 * 管理使用者自訂的背景圖片列表、透明度、切換間隔。
 * 圖片列表儲存於 IndexedDB（避免 localStorage 5MB 限制）。
 * 設定（透明度、間隔秒數）儲存於 localStorage。
 */
import { writable, derived, get } from 'svelte/store';
import { getItem, setItem, removeItem } from '$lib/services/idb.js';

// ── Keys ──
const IDB_KEY = 'nwt_background_images';       // 圖片陣列
const OPACITY_KEY = 'nwt_background_opacity';   // 透明度
const INTERVAL_KEY = 'nwt_background_interval'; // 切換秒數（0 = 不自動切換）
const ENABLED_KEY = 'nwt_background_enabled';   // 開關
const MODAL_OPACITY_KEY = 'nwt_modal_opacity';  // Modal 透明度

// ── 預設值 ──
const DEFAULT_OPACITY = 0.5;
const DEFAULT_INTERVAL = 10; // 預設 10 秒切換
const DEFAULT_MODAL_OPACITY = 0.85; // Modal 預設透明度

// ── Stores ──

/**
 * 背景圖片列表（有序陣列，每項為 base64 data URL）
 * @type {import('svelte/store').Writable<string[]>}
 */
export const backgroundImages = writable([]);

/**
 * 背景圖片開關（啟用/停用）
 */
function getInitialEnabled() {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem(ENABLED_KEY);
    if (saved !== null) return saved === 'true';
  }
  return true; // 預設啟用
}

export const backgroundEnabled = writable(getInitialEnabled());

backgroundEnabled.subscribe(($enabled) => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(ENABLED_KEY, String($enabled));
  }
});

/**
 * 當前顯示的圖片索引
 * @type {import('svelte/store').Writable<number>}
 */
export const currentImageIndex = writable(0);

/**
 * 當前顯示的圖片（derived）
 * 保持向後相容：layout 使用此 store
 * 當 backgroundEnabled 為 false 時回傳 null
 */
export const backgroundImage = derived(
  [backgroundImages, currentImageIndex, backgroundEnabled],
  ([$images, $index, $enabled]) => {
    if (!$enabled || $images.length === 0) return null;
    const safeIndex = $index % $images.length;
    return $images[safeIndex] || null;
  }
);

/**
 * 背景透明度 store（0.01 ~ 0.9）
 */
function getInitialOpacity() {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem(OPACITY_KEY);
    if (saved !== null) {
      const val = parseFloat(saved);
      if (!isNaN(val) && val >= 0.01 && val <= 0.9) return val;
    }
  }
  return DEFAULT_OPACITY;
}

export const backgroundOpacity = writable(getInitialOpacity());

backgroundOpacity.subscribe(($opacity) => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(OPACITY_KEY, String($opacity));
  }
});

/**
 * Modal 透明度 store（0.5 ~ 1.0）
 * 控制 Modal 背景的不透明度，讓背景圖片可以透出
 */
function getInitialModalOpacity() {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem(MODAL_OPACITY_KEY);
    if (saved !== null) {
      const val = parseFloat(saved);
      if (!isNaN(val) && val >= 0.5 && val <= 1.0) return val;
    }
  }
  return DEFAULT_MODAL_OPACITY;
}

export const modalOpacity = writable(getInitialModalOpacity());

modalOpacity.subscribe(($opacity) => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(MODAL_OPACITY_KEY, String($opacity));
  }
});

/**
 * 切換間隔（秒），0 表示不自動切換
 */
function getInitialInterval() {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem(INTERVAL_KEY);
    if (saved !== null) {
      const val = parseInt(saved, 10);
      if (!isNaN(val) && val >= 0) return val;
    }
  }
  return DEFAULT_INTERVAL;
}

export const backgroundInterval = writable(getInitialInterval());

backgroundInterval.subscribe(($interval) => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(INTERVAL_KEY, String($interval));
  }
});

// ── 輪播計時器 ──
let timer = null;

/**
 * 啟動/重啟輪播計時器。
 * 根據 interval 和圖片數量決定是否啟動。
 */
export function startSlideshow() {
  stopSlideshow();
  const interval = get(backgroundInterval);
  const images = get(backgroundImages);
  if (interval <= 0 || images.length <= 1) return;

  timer = setInterval(() => {
    const imgs = get(backgroundImages);
    if (imgs.length <= 1) { stopSlideshow(); return; }
    currentImageIndex.update(i => (i + 1) % imgs.length);
  }, interval * 1000);
}

/**
 * 停止輪播計時器。
 */
export function stopSlideshow() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

// ── 持久化操作 ──

/**
 * 從 IndexedDB 載入背景圖片列表。
 * 應在 App 啟動時呼叫。
 */
export async function loadBackgroundImage() {
  try {
    const saved = await getItem(IDB_KEY);
    if (saved && Array.isArray(saved) && saved.length > 0) {
      backgroundImages.set(saved);
      // 隨機起始位置
      currentImageIndex.set(Math.floor(Math.random() * saved.length));
      startSlideshow();
    } else if (saved && typeof saved === 'string') {
      // 向後相容：舊版單張圖片格式
      backgroundImages.set([saved]);
      currentImageIndex.set(0);
    }
  } catch (err) {
    console.warn('[backgroundImage] 載入失敗:', err);
  }
}

/**
 * 新增一張或多張圖片到列表末尾。
 * @param {string[]} dataUrls — base64 data URL 陣列
 */
export async function addBackgroundImages(dataUrls) {
  backgroundImages.update(imgs => [...imgs, ...dataUrls]);
  await persistImages();
  startSlideshow();
}

/**
 * 移除指定索引的圖片。
 * @param {number} index
 */
export async function removeBackgroundImage(index) {
  backgroundImages.update(imgs => {
    const next = [...imgs];
    next.splice(index, 1);
    return next;
  });
  // 修正當前索引
  const imgs = get(backgroundImages);
  if (imgs.length === 0) {
    currentImageIndex.set(0);
    stopSlideshow();
  } else {
    currentImageIndex.update(i => i >= imgs.length ? 0 : i);
    startSlideshow();
  }
  await persistImages();
}

/**
 * 移除所有圖片。
 */
export async function clearAllBackgroundImages() {
  backgroundImages.set([]);
  currentImageIndex.set(0);
  stopSlideshow();
  try {
    await removeItem(IDB_KEY);
  } catch (err) {
    console.warn('[backgroundImage] 移除失敗:', err);
  }
}

/**
 * 重新排序圖片列表。
 * @param {string[]} newOrder — 重新排序後的完整陣列
 */
export async function reorderBackgroundImages(newOrder) {
  backgroundImages.set(newOrder);
  currentImageIndex.set(0);
  await persistImages();
  startSlideshow();
}

/**
 * 將圖片列表持久化至 IndexedDB。
 */
async function persistImages() {
  try {
    const imgs = get(backgroundImages);
    if (imgs.length === 0) {
      await removeItem(IDB_KEY);
    } else {
      await setItem(IDB_KEY, imgs);
    }
  } catch (err) {
    console.warn('[backgroundImage] 儲存失敗:', err);
  }
}

// 向後相容的別名
export const setBackgroundImage = async (dataUrl) => addBackgroundImages([dataUrl]);
export const clearBackgroundImage = clearAllBackgroundImages;
