/**
 * scrollLock.js — Modal 背景滾動鎖定工具
 *
 * 使用 overflow:hidden 立即阻止滾動，再於下一幀套用 position:fixed
 * 以確保 iOS Safari 也能正確鎖定。延遲 position:fixed 可避免與
 * modal 進場動畫同幀觸發 reflow，減少卡頓感。
 */

let scrollY = 0;
let lockCount = 0;
let rafId = 0;

/**
 * 鎖定背景滾動。支援巢狀呼叫（多個 modal 同時開啟）。
 */
export function lockScroll() {
  if (lockCount === 0) {
    scrollY = window.scrollY;
    // 第一步：立即設 overflow:hidden（桌面瀏覽器即刻生效）
    document.body.style.overflow = 'hidden';
    // 第二步：下一幀才套用 position:fixed（避免與動畫同幀 reflow）
    rafId = requestAnimationFrame(() => {
      document.body.classList.add('modal-open');
      document.body.style.top = `-${scrollY}px`;
    });
  }
  lockCount++;
}

/**
 * 解除背景滾動鎖定。僅在最後一個 modal 關閉時才真正解鎖。
 */
export function unlockScroll() {
  lockCount--;
  if (lockCount <= 0) {
    lockCount = 0;
    cancelAnimationFrame(rafId);
    document.body.classList.remove('modal-open');
    document.body.style.overflow = '';
    document.body.style.top = '';
    window.scrollTo({ top: scrollY, behavior: 'instant' });
  }
}
