/**
 * app.js — 主應用程式入口
 */

import { initState, getState, setState, updateAssets } from './state.js';
import { fetchAllPrices, startPriceAutoRefresh } from './priceFetcher.js';
import { initDashboard } from './ui/dashboard.js';
import { initAssetList } from './ui/assetList.js';
import { initTrendChart } from './ui/trendChart.js';
import { initSettings } from './ui/settings.js';
import { openAssetModal, openLiabilityModal } from './ui/modal.js';
import { preloadStockCache } from './searchService.js';
import './services/googleSheetsService.js';
import './ui/googleIntegration.js';

// ─── 頁籤導覽 ────────────────────────────────────────────────────────────────

function initNavigation() {
  const tabs = document.querySelectorAll('.nav-tab');
  const pages = document.querySelectorAll('.page');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetPage = tab.dataset.page;
      tabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      pages.forEach(page => {
        page.classList.toggle('hidden', page.id !== `page-${targetPage}`);
      });
    });
  });
}

// ─── FAB 按鈕 ────────────────────────────────────────────────────────────────

function initFAB() {
  const fab = document.getElementById('fab-add');
  const fabMenu = document.getElementById('fab-menu');
  if (!fab || !fabMenu) return;

  let menuOpen = false;

  function openMenu() {
    menuOpen = true;
    fabMenu.classList.remove('hidden');
    fab.setAttribute('aria-expanded', 'true');
    fab.textContent = '✕';
  }

  function closeMenu() {
    menuOpen = false;
    fabMenu.classList.add('hidden');
    fab.setAttribute('aria-expanded', 'false');
    fab.textContent = '+';
  }

  fab.addEventListener('click', e => {
    e.stopPropagation();
    menuOpen ? closeMenu() : openMenu();
  });

  document.getElementById('fab-add-asset')?.addEventListener('click', () => {
    closeMenu();
    openAssetModal(null);
  });

  document.getElementById('fab-add-liability')?.addEventListener('click', () => {
    closeMenu();
    openLiabilityModal(null);
  });

  document.addEventListener('click', () => {
    if (menuOpen) closeMenu();
  });
}

// ─── 價格自動更新 ────────────────────────────────────────────────────────────

async function initPriceFetcher() {
  const doFetch = async (forceUpdate = false) => {
    const { assets } = getState();
    if (assets.length === 0) return;
    
    try {
      const updatedAssets = await fetchAllPrices(assets);
      const hasChanges = forceUpdate || updatedAssets.some((a, i) => 
        a.pricePerUnit !== assets[i].pricePerUnit || 
        a.lastPriceUpdate !== assets[i].lastPriceUpdate
      );
      
      if (hasChanges) {
        updateAssets(updatedAssets);
        const toast = document.getElementById('toast');
        if (toast) {
          const cnt = updatedAssets.filter((a, i) => a.pricePerUnit !== assets[i].pricePerUnit).length;
          if (cnt > 0) {
            toast.textContent = `已更新 ${cnt} 個資產價格`;
            toast.className = 'toast success';
            toast.classList.remove('hidden');
            setTimeout(() => toast.classList.add('hidden'), 3000);
          }
        }
      }
    } catch { /* silently ignore */ }
  };

  await doFetch(true);

  // 每 1 分鐘自動更新
  startPriceAutoRefresh(() => doFetch(false), 60000);
  // 每 10 分鐘強制更新
  setInterval(() => doFetch(true), 600000);
  
  window.addEventListener('manualPriceRefresh', () => doFetch(true));
  window.addEventListener('clearStockCache', () => {
    import('./searchService.js').then(m => { m.clearStockCache(); doFetch(true); }).catch(() => {});
  });
}

// ─── Service Worker 註冊 ─────────────────────────────────────────────────────

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then(reg => {
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        if (nw) {
          nw.addEventListener('statechange', () => {
            if (nw.state === 'installed' && navigator.serviceWorker.controller) {
              // 新版本已下載但尚未啟用，顯示更新提示讓使用者決定
              showUpdateToast(nw);
            }
          });
        }
      });
      reg.update();
    }).catch(() => {});

    // 當新 SW 接管後才刷新（使用者主動觸發）
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  }
}

function showUpdateToast(worker) {
  const toast = document.getElementById('toast');
  if (!toast) return;

  toast.innerHTML = '有新版本可用 '
    + '<button id="update-btn" style="margin-left:8px;padding:2px 10px;'
    + 'border:1px solid #fff;border-radius:4px;background:transparent;'
    + 'color:#fff;cursor:pointer;font-size:inherit;">更新</button>';
  toast.className = 'toast info';
  toast.classList.remove('hidden');

  document.getElementById('update-btn')?.addEventListener('click', () => {
    worker.postMessage({ type: 'SKIP_WAITING' });
    toast.classList.add('hidden');
  });
}

// ─── 應用程式初始化 ──────────────────────────────────────────────────────────

async function init() {
  initState();

  // 確保有今日快照
  const currentState = getState();
  if (currentState.assets.length > 0 || currentState.liabilities.length > 0) {
    const { autoSnapshot } = await import('./snapshotManager.js');
    const newSnapshots = autoSnapshot(
      currentState.assets, currentState.liabilities,
      currentState.exchangeRate, currentState.snapshots
    );
    if (newSnapshots.length !== currentState.snapshots.length) {
      setState({ snapshots: newSnapshots });
    }
  }

  initDashboard();
  initAssetList();
  initTrendChart();
  initSettings();
  initNavigation();
  initFAB();

  initPriceFetcher().catch(() => {});
  preloadStockCache().catch(() => {});
  registerServiceWorker();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
