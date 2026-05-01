/**
 * scrollLock.js — Modal 背景滾動鎖定工具
 *
 * 使用 position:fixed + 記錄 scrollY 的方式鎖定背景，
 * 避免 scrollbar 消失造成版面閃動。
 */

let scrollY = 0;
let lockCount = 0;

/**
 * 鎖定背景滾動。支援巢狀呼叫（多個 modal 同時開啟）。
 */
export function lockScroll() {
  if (lockCount === 0) {
    scrollY = window.scrollY;
    document.body.classList.add('modal-open');
    document.body.style.top = `-${scrollY}px`;
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
    document.body.classList.remove('modal-open');
    document.body.style.top = '';
    window.scrollTo(0, scrollY);
  }
}
