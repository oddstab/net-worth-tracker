<!--
  +layout.svelte — 共用佈局

  包含 NavBar、FAB、Toast 通知、確認對話框。
  匯入全域 CSS。
  註冊 Service Worker 並在新版本可用時顯示更新提示。
-->
<script>
  import { onMount, onDestroy } from 'svelte';
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
  import { snapshots } from '$lib/stores/snapshots.js';
  import { totals } from '$lib/stores/derived.js';
  import { autoSnapshot } from '$lib/services/snapshotManager.js';
  import { initDB } from '$lib/services/idb.js';
  import { hydrateStoresFromIDB } from '$lib/stores/hydrate.js';
  import { backgroundImage, backgroundImages, currentImageIndex, loadBackgroundImage, backgroundOpacity, modalOpacity } from '$lib/stores/backgroundImage.js';

  /**
   * 漸變切換：使用兩層 overlay 交替顯示。
   * layerA / layerB 各持有一張圖片，activeLayer 指示哪層在前面。
   */
  let layerA = { url: null, visible: false };
  let layerB = { url: null, visible: false };
  let activeLayer = 'A'; // 'A' 或 'B'

  // 監聽 backgroundImage 變化，觸發漸變
  $: handleImageChange($backgroundImage);

  // 監聯 modalOpacity 變化，更新 CSS 變數
  $: if (typeof document !== 'undefined') {
    document.documentElement.style.setProperty('--modal-bg-opacity', String($modalOpacity));
  }

  function handleImageChange(newImage) {
    if (!newImage) {
      // 清除所有
      layerA = { url: null, visible: false };
      layerB = { url: null, visible: false };
      return;
    }

    if (activeLayer === 'A') {
      if (layerA.url === newImage) return; // 沒變
      // 新圖放到 B 層，淡入 B、淡出 A
      layerB = { url: newImage, visible: true };
      layerA = { ...layerA, visible: false };
      activeLayer = 'B';
    } else {
      if (layerB.url === newImage) return; // 沒變
      // 新圖放到 A 層，淡入 A、淡出 B
      layerA = { url: newImage, visible: true };
      layerB = { ...layerB, visible: false };
      activeLayer = 'A';
    }
  }

  /** 是否顯示 SW 更新提示 */
  let showUpdatePrompt = false;

  /** 等待中的新 Service Worker */
  let waitingWorker = null;

  /** PWA 安裝提示 */
  let deferredInstallPrompt = null;

  /** 是否顯示 PWA 安裝橫幅 */
  let showInstallBanner = false;

  /** 價格系統控制物件 */
  let priceSystem = null;

  /** 響應式語言 key — 用於 {#key} 強制重新渲染子元件 */
  $: localeKey = $locale;

  onMount(async () => {
    // 初始化 IndexedDB 並從 localStorage 遷移資料
    await initDB();
    // 從 IndexedDB 載入最新資料更新各 store（覆蓋同步初始值）
    await hydrateStoresFromIDB();
    // 載入背景圖片設定
    await loadBackgroundImage();

    registerServiceWorker();

    // 設定 Modal 透明度 CSS 變數
    document.documentElement.style.setProperty('--modal-bg-opacity', String($modalOpacity));

    // 監聽 PWA 安裝提示（儲存事件供設定頁使用，並顯示安裝橫幅）
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;
      window.__pwaInstallPrompt = e;
      // 延遲 3 秒顯示安裝橫幅，避免頁面剛載入就彈出
      setTimeout(() => {
        showInstallBanner = true;
      }, 3000);
    });

    // 已安裝時隱藏橫幅
    window.addEventListener('appinstalled', () => {
      showInstallBanner = false;
      deferredInstallPrompt = null;
      window.__pwaInstallPrompt = null;
    });

    // 初始化價格系統：自動更新台股/加密貨幣市場價格
    priceSystem = initPriceSystem({
      getAssets: () => get(assets),
      onPricesUpdated: (updatedAssets, count) => {
        assets.replaceAll(updatedAssets);
        // 價格更新後同步更新當日快照
        performAutoSnapshot();
      },
      showToast,
    });

    // 首次載入時立即更新一次價格
    priceSystem.refresh();

    // 啟動時建立/更新當日快照（記錄當前淨資產）
    performAutoSnapshot();
  });

  onDestroy(() => {
    if (priceSystem) priceSystem.stop();
  });

  /**
   * 自動建立/更新當日快照：取得當前淨資產並寫入 snapshots store。
   * 每次 APP 啟動和價格更新後呼叫。
   */
  function performAutoSnapshot() {
    const currentTotals = get(totals);
    const currentSnapshots = get(snapshots);
    const updated = autoSnapshot(currentSnapshots, currentTotals.netWorth);
    snapshots.replaceAll(updated);
  }

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

  /**
   * 使用者點擊安裝 PWA。
   */
  async function handleInstallBanner() {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    if (outcome === 'accepted') {
      showInstallBanner = false;
    }
    deferredInstallPrompt = null;
    window.__pwaInstallPrompt = null;
  }

  /**
   * 使用者關閉安裝橫幅。
   */
  function dismissInstallBanner() {
    showInstallBanner = false;
  }
</script>

{#if layerA.url}
  <div
    class="bg-overlay"
    style="background-image: url({layerA.url}); opacity: {layerA.visible ? $backgroundOpacity : 0};"
    aria-hidden="true"
  ></div>
{/if}
{#if layerB.url}
  <div
    class="bg-overlay"
    style="background-image: url({layerB.url}); opacity: {layerB.visible ? $backgroundOpacity : 0};"
    aria-hidden="true"
  ></div>
{/if}

{#key localeKey}
  <NavBar />
  <main class="main-content">
    <slot />
  </main>
  <FAB installBannerVisible={showInstallBanner} />
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

{#if showInstallBanner}
  <div class="pwa-install-banner" role="alert">
    <Icon name="download" size={18}/>
    <span>安裝到主畫面，享受更好的體驗</span>
    <button class="pwa-install-btn" on:click={handleInstallBanner}>安裝</button>
    <button class="pwa-install-dismiss" on:click={dismissInstallBanner} aria-label="關閉"><Icon name="x" size={16}/></button>
  </div>
{/if}

<style>
  /* ── 背景圖片覆蓋層 ── */
  .bg-overlay {
    position: fixed;
    inset: 0;
    z-index: 0;
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    pointer-events: none;
    transition: opacity 1s ease-in-out;
  }

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

  /* ── PWA 安裝橫幅 ── */
  .pwa-install-banner {
    position: fixed;
    bottom: 70px;
    left: 0;
    right: 0;
    margin: 0 auto;
    background: var(--accent-color, #4fc3f7);
    color: var(--color-bg, #0f0f1a);
    padding: 10px 16px;
    display: flex;
    align-items: center;
    gap: 8px;
    z-index: 9998;
    box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.3);
    font-size: 0.82rem;
    font-weight: 600;
  }

  /* 電腦版：限制寬度、置中、加圓角 */
  @media (min-width: 768px) {
    .pwa-install-banner {
      max-width: 480px;
      border-radius: 12px;
      bottom: 24px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    }
  }

  /* Modal 開啟時隱藏安裝橫幅，避免擋到操作 */
  :global(body.modal-open) .pwa-install-banner {
    display: none;
  }

  .pwa-install-banner span {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .pwa-install-btn {
    background: var(--color-bg, #0f0f1a);
    color: var(--accent-color, #4fc3f7);
    border: none;
    padding: 6px 14px;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.82rem;
    min-height: 32px;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .pwa-install-btn:hover {
    opacity: 0.9;
  }

  .pwa-install-dismiss {
    background: none;
    border: none;
    color: var(--color-bg, #0f0f1a);
    cursor: pointer;
    padding: 2px;
    line-height: 1;
    min-width: 24px;
    min-height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  @keyframes slideUp {
    from { transform: translateY(100%); opacity: 0; }
    to   { transform: translateY(0); opacity: 1; }
  }


</style>
