<!--
  +layout.svelte — 共用佈局

  包含 NavBar、FAB、Toast 通知、確認對話框。
  匯入全域 CSS。
  註冊 Service Worker 並在新版本可用時顯示更新提示。
-->
<script>
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { base } from '$app/paths';
  import '../app.css';
  import NavBar from '../components/NavBar.svelte';
  import Toast from '../components/Toast.svelte';
  import FAB from '../components/FAB.svelte';
  import Icon from '../components/Icon.svelte';
  import ConfirmDialog from '../components/ConfirmDialog.svelte';
  import { showToast } from '$lib/stores/toast.js';
  import { locale } from '$lib/stores/locale.js';
  import { theme } from '$lib/stores/theme.js';
  import { assets } from '$lib/stores/assets.js';
  import { initPriceSystem } from '$lib/price/init.js';
  import { get } from 'svelte/store';

  /** 頁面順序（左右滑動切換） */
  const PAGES = ['/', '/assets', '/tools', '/settings'];

  /** Swipe 偵測 */
  let touchStartX = 0;
  let touchStartY = 0;
  let swiping = false;

  /** 頁面過渡動畫 */
  let transitionClass = '';
  let touchStartEl = null;

  /** 檢查元素或其祖先是否可水平滾動 */
  function isHorizontallyScrollable(el) {
    while (el && el !== document.body) {
      if (el.scrollWidth > el.clientWidth + 1) {
        const style = getComputedStyle(el);
        const overflow = style.overflowX;
        if (overflow === 'auto' || overflow === 'scroll') return true;
      }
      el = el.parentElement;
    }
    return false;
  }

  function handleTouchStart(e) {
    const t = e.touches[0];
    touchStartX = t.clientX;
    touchStartY = t.clientY;
    touchStartEl = e.target;
    swiping = true;
  }

  function handleTouchEnd(e) {
    if (!swiping) return;
    swiping = false;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;

    // 水平滑動距離 > 60px 且水平 > 垂直（避免誤觸）
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;

    // Modal 開啟時不切換
    if (document.body.classList.contains('modal-open')) return;

    // 觸控起點在可水平滾動的元素內時不切換頁面
    if (touchStartEl && isHorizontallyScrollable(touchStartEl)) return;

    const currentPath = get(page).url.pathname;
    // 移除 base path 前綴來匹配 PAGES
    const relativePath = currentPath.startsWith(base) ? currentPath.slice(base.length) || '/' : currentPath;
    const idx = PAGES.indexOf(relativePath);
    if (idx === -1) return;

    let targetIdx = -1;
    let direction = '';

    if (dx < 0 && idx < PAGES.length - 1) {
      targetIdx = idx + 1;
      direction = 'left';
    } else if (dx > 0 && idx > 0) {
      targetIdx = idx - 1;
      direction = 'right';
    }

    if (targetIdx === -1) return;

    // 用 opacity 淡出 → 切頁 → 淡入（不用 transform 避免破壞 fixed 定位）
    transitionClass = `slide-out-${direction}`;
    setTimeout(() => {
      goto(base + PAGES[targetIdx], { replaceState: false }).then(() => {
        transitionClass = `slide-in-${direction}`;
        setTimeout(() => {
          transitionClass = '';
        }, 200);
      });
    }, 120);
  }

  /** 是否顯示 SW 更新提示 */
  let showUpdatePrompt = false;

  /** 等待中的新 Service Worker */
  let waitingWorker = null;

  /** PWA 安裝提示 */
  let deferredInstallPrompt = null;

  /** 價格系統控制物件 */
  let priceSystem = null;

  /** 響應式語言 key — 用於 {#key} 強制重新渲染子元件 */
  $: localeKey = $locale;

  onMount(() => {
    registerServiceWorker();

    // 監聯 PWA 安裝提示（儲存事件供設定頁使用）
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;
      window.__pwaInstallPrompt = e;
    });

    // 初始化價格系統：自動更新台股/加密貨幣市場價格
    priceSystem = initPriceSystem({
      getAssets: () => get(assets),
      onPricesUpdated: (updatedAssets, count) => {
        assets.replaceAll(updatedAssets);
      },
      showToast,
    });

    // 首次載入時立即更新一次價格
    priceSystem.refresh();
  });

  onDestroy(() => {
    if (priceSystem) priceSystem.stop();
  });

  /**
   * 註冊 Service Worker 並監聽更新事件。
   */
  async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    // 開發環境下不註冊 SW，避免快取干擾 HMR
    if (import.meta.env.DEV) {
      // 開發模式：移除已註冊的 SW
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        await reg.unregister();
      }
      // 清除所有快取
      const cacheNames = await caches.keys();
      for (const name of cacheNames) {
        await caches.delete(name);
      }
      console.log('[Layout] 開發模式：已移除 Service Worker 並清除快取');
      return;
    }

    try {
      const registration = await navigator.serviceWorker.register(`${base}/sw.js`);

      // 監聽新 SW 安裝完成（waiting 狀態）
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          // 新 SW 已安裝完成且有舊 SW 正在控制頁面
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            waitingWorker = newWorker;
            showUpdatePrompt = true;
          }
        });
      });

      // 監聽 controller 變更（新 SW 接管後重新載入）
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
      });
    } catch (err) {
      console.warn('[Layout] Service Worker 註冊失敗:', err);
    }
  }

  /**
   * 使用者確認更新：通知等待中的 SW 執行 skipWaiting。
   */
  function applyUpdate() {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    }
    showUpdatePrompt = false;
  }

  /**
   * 使用者暫時忽略更新。
   */
  function dismissUpdate() {
    showUpdatePrompt = false;
  }
</script>

{#key localeKey}
  <NavBar />
  <main class="main-content {transitionClass}" on:touchstart={handleTouchStart} on:touchend={handleTouchEnd}>
    <slot />
  </main>
  <FAB />
{/key}
<Toast />
<ConfirmDialog />

{#if showUpdatePrompt}
  <div class="sw-update-banner" role="alert">
    <span>有新版本可用！</span>
    <button class="sw-update-btn" on:click={applyUpdate}>立即更新</button>
    <button class="sw-update-dismiss" on:click={dismissUpdate} aria-label="關閉"><Icon name="x" size={16}/></button>
  </div>
{/if}

<style>
  .sw-update-banner {
    position: fixed;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--color-accent, #4fc3f7);
    color: var(--color-bg, #0f0f1a);
    padding: 12px 20px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    gap: 12px;
    z-index: 9999;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
    font-size: 0.9rem;
    font-weight: 600;
  }

  .sw-update-btn {
    background: var(--color-bg, #0f0f1a);
    color: var(--color-accent, #4fc3f7);
    border: none;
    padding: 6px 16px;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.85rem;
    min-height: 36px;
  }

  .sw-update-btn:hover {
    opacity: 0.9;
  }

  .sw-update-dismiss {
    background: none;
    border: none;
    color: var(--color-bg, #0f0f1a);
    cursor: pointer;
    font-size: 1.1rem;
    padding: 4px;
    line-height: 1;
    min-width: 28px;
    min-height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* ── 頁面滑動過渡動畫 ── */
  :global(.slide-out-left) {
    animation: slideOutLeft 150ms ease-in forwards;
  }
  :global(.slide-out-right) {
    animation: slideOutRight 150ms ease-in forwards;
  }
  :global(.slide-in-left) {
    animation: slideInLeft 250ms ease-out forwards;
  }
  :global(.slide-in-right) {
    animation: slideInRight 250ms ease-out forwards;
  }

  @keyframes slideOutLeft {
    from { opacity: 1; }
    to   { opacity: 0; }
  }
  @keyframes slideOutRight {
    from { opacity: 1; }
    to   { opacity: 0; }
  }
  @keyframes slideInLeft {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes slideInRight {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
</style>
