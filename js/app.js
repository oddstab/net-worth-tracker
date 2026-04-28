/**
 * app.js — 主應用程式入口
 *
 * 負責：
 *   - 初始化狀態（從 localStorage 載入）
 *   - 頁籤導覽（儀表板 / 資產 / 設定）
 *   - 初始化所有 UI 元件
 *   - 啟動價格自動抓取
 *   - 註冊 Service Worker
 *
 * 對應需求：5.2, 5.3, 6.1, 6.2, 6.3, 6.4, 7.1, 7.2, 7.3, 7.4
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

/**
 * 初始化頁籤導覽。
 * 點擊頁籤時切換對應的 page section 顯示。
 */
function initNavigation() {
  const tabs = document.querySelectorAll('.nav-tab');
  const pages = document.querySelectorAll('.page');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetPage = tab.dataset.page;

      // 更新頁籤 active 狀態
      tabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');

      // 切換頁面顯示
      pages.forEach(page => {
        if (page.id === `page-${targetPage}`) {
          page.classList.remove('hidden');
        } else {
          page.classList.add('hidden');
        }
      });
    });
  });
}

// ─── FAB 按鈕 ────────────────────────────────────────────────────────────────

/**
 * 初始化 FAB（浮動新增按鈕）。
 * 點擊後顯示「新增資產 / 新增負債」選單。
 */
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

  // 點擊外部關閉選單
  document.addEventListener('click', () => {
    if (menuOpen) closeMenu();
  });
}

// ─── 空資料引導提示 ──────────────────────────────────────────────────────────

/**
 * 若資產與負債均為空，顯示引導提示。
 * （assetList.js 也會處理 #empty-state，此處為初始狀態的額外提示）
 */
function checkEmptyState() {
  const { assets, liabilities } = getState();
  const emptyState = document.getElementById('empty-state');
  if (emptyState) {
    if (assets.length === 0 && liabilities.length === 0) {
      emptyState.classList.remove('hidden');
    } else {
      emptyState.classList.add('hidden');
    }
  }
}

// ─── 價格自動更新 ────────────────────────────────────────────────────────────

/**
 * 啟動價格抓取：
 * 1. 立即抓取一次
 * 2. 每 30 秒自動更新（大幅提高頻率）
 * 3. 每日自動快照
 */
async function initPriceFetcher() {
  console.log('[App] 初始化價格抓取服務...');
  
  const doFetch = async (forceUpdate = false) => {
    console.log('[App] 執行價格更新...', forceUpdate ? '(強制更新)' : '');
    const { assets } = getState();
    
    if (assets.length === 0) {
      console.log('[App] 無資產需要更新價格');
      return;
    }
    
    try {
      const updatedAssets = await fetchAllPrices(assets);
      
      // 強制更新或檢查是否有價格變化
      const hasChanges = forceUpdate || updatedAssets.some((a, i) => 
        a.pricePerUnit !== assets[i].pricePerUnit || 
        a.lastPriceUpdate !== assets[i].lastPriceUpdate
      );
      
      if (hasChanges) {
        console.log('[App] 更新資產價格和狀態');
        updateAssets(updatedAssets); // 使用新的批量更新方法
        
        // 顯示更新通知
        const toast = document.getElementById('toast');
        if (toast) {
          const updatedCount = updatedAssets.filter((a, i) => a.pricePerUnit !== assets[i].pricePerUnit).length;
          toast.textContent = `已更新 ${updatedCount} 個資產價格`;
          toast.className = 'toast success';
          toast.classList.remove('hidden');
          setTimeout(() => toast.classList.add('hidden'), 3000);
        }
      } else {
        console.log('[App] 無價格變化');
      }
    } catch (error) {
      console.error('[App] 價格更新過程中發生錯誤:', error);
    }
  };

  // 立即執行一次強制更新
  console.log('[App] 執行初始價格抓取...');
  await doFetch(true);

  // 每 30 秒自動更新（大幅提高頻率）
  console.log('[App] 啟動高頻自動價格更新，間隔 30 秒');
  startPriceAutoRefresh(() => doFetch(false), 30000); // 30秒
  
  // 每 5 分鐘強制更新一次
  console.log('[App] 啟動強制更新，間隔 5 分鐘');
  setInterval(() => doFetch(true), 300000); // 5分鐘強制更新
  
  // 監聽手動刷新事件
  window.addEventListener('manualPriceRefresh', () => doFetch(true));
  console.log('[App] 已註冊手動價格刷新監聽器');
  
  // 監聽清除快取事件
  window.addEventListener('clearStockCache', () => {
    console.log('[App] 收到清除快取請求');
    try {
      import('./searchService.js').then(module => {
        module.clearStockCache();
        console.log('[App] 快取已清除');
        // 清除快取後立即更新
        doFetch(true);
      });
    } catch (error) {
      console.error('[App] 清除快取失敗:', error);
    }
  });
  console.log('[App] 已註冊清除快取監聽器');
}

// ─── Service Worker 註冊 ─────────────────────────────────────────────────────

/**
 * 註冊 Service Worker（僅在支援的瀏覽器中執行）。
 */
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').then(() => {
      console.log('[App] Service Worker 已註冊');
    }).catch(err => {
      console.warn('[App] Service Worker 註冊失敗：', err);
    });
  }
}

// ─── 應用程式初始化 ──────────────────────────────────────────────────────────

/**
 * 主初始化函式。
 * 依序執行：狀態載入 → UI 初始化 → 導覽 → FAB → 價格抓取 → SW 註冊
 */
async function init() {
  // 1. 從 localStorage 載入所有資料
  initState();

  // 1.5. 確保有今日快照（如果有資產的話）
  const currentState = getState();
  if (currentState.assets.length > 0 || currentState.liabilities.length > 0) {
    const { autoSnapshot } = await import('./snapshotManager.js');
    const newSnapshots = autoSnapshot(
      currentState.assets, 
      currentState.liabilities, 
      currentState.exchangeRate, 
      currentState.snapshots
    );
    if (newSnapshots.length !== currentState.snapshots.length) {
      setState({ snapshots: newSnapshots });
      console.log('[App] 已創建今日快照');
    }
  }

  // 2. 初始化所有 UI 元件（訂閱 state，自動響應變更）
  initDashboard();
  initAssetList();
  initTrendChart();
  initSettings();

  // 3. 初始化頁籤導覽
  initNavigation();

  // 4. 初始化 FAB
  initFAB();

  // 5. 檢查空資料狀態
  checkEmptyState();

  // 6. 啟動價格自動抓取（非同步，不阻塞 UI）
  initPriceFetcher().catch(err => {
    console.warn('[App] 價格抓取初始化失敗：', err);
  });

  // 7. 預載台股全市場快取（背景執行，讓搜尋更快）
  preloadStockCache().catch(() => {});

  // 8. 註冊 Service Worker
  registerServiceWorker();
}

// ─── 啟動 ────────────────────────────────────────────────────────────────────

// DOM 載入完成後啟動
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
