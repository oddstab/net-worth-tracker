/**
 * assetList.js — 資產與負債清單渲染
 */

import * as state from '../state.js';
import { calculateAssetTWD, calculateTotals, toTWD, consolidateAssets } from '../calculator.js';
import { openAssetModal, openLiabilityModal } from './modal.js';

const container  = document.getElementById('asset-list-container');
const emptyState = document.getElementById('empty-state');

// NT$ 用 charCode 避免工具截斷
const NTD = 'NT' + String.fromCharCode(36);

function formatTWD(amount) {
  return NTD + Math.round(amount).toLocaleString('zh-TW');
}

function formatLastUpdate(ts) {
  if (!ts) return '手動輸入';
  return new Date(ts).toLocaleString('zh-TW');
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ─── 資產清單 ─────────────────────────────────────────────────────────────────

function renderAssetCategory(label, assets, subtotal) {
  if (assets.length === 0) return '';
  const rate = state.getState().exchangeRate;
  
  // 調試信息
  console.log('renderAssetCategory called with:', label, assets.length, 'assets');
  console.log('Original assets:', assets.map(a => ({ name: a.name, symbol: a.symbol, id: a.id })));
  
  // 整合相同股票
  const consolidatedAssets = consolidateAssets(assets, rate);
  console.log('Consolidated assets:', consolidatedAssets.map(a => ({ 
    name: a.name, 
    symbol: a.symbol, 
    id: a.id, 
    holdings: a.holdings?.length || 1 
  })));

    const items = consolidatedAssets.map(asset => {
    const twd = calculateAssetTWD(asset, rate);
    const isMultipleHoldings = asset.holdings && asset.holdings.length > 1;
    
    // 顯示股票代號和名稱 - 股票代號在最前面
    const displayName = asset.symbol 
      ? `${asset.symbol} ${asset.name}`
      : asset.name;
    
    const lastUpdate = formatLastUpdate(asset.lastPriceUpdate);
    const priceDisplay = asset.pricePerUnit.toLocaleString('zh-TW', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 4 
    }) + ' ' + asset.currency;

    // 如果是多筆持股，顯示詳細信息
    let holdingsDetail = '';
    if (isMultipleHoldings) {
      holdingsDetail = '<div class="holdings-detail">' +
        asset.holdings.map(holding => 
          `<div class="holding-item">
            <span class="holding-quantity">${holding.quantity.toLocaleString('zh-TW')}</span>
            <span class="holding-price">@ ${holding.pricePerUnit.toLocaleString('zh-TW')} ${holding.currency}</span>
            <span class="holding-actions">
              <button class="btn-icon btn-edit-small" data-action="edit-asset" data-id="${esc(holding.id)}" title="編輯">✏️</button>
              <button class="btn-icon btn-delete-small" data-action="delete-asset" data-id="${esc(holding.id)}" title="刪除">🗑️</button>
            </span>
          </div>`
        ).join('') +
        '</div>';
    }

    return '<div class="asset-item" data-id="' + esc(asset.id) + '">'
      + '<div class="asset-item-info">'
      + '<div class="asset-item-header">'
      + '<div class="asset-item-name">'
      + '<span class="asset-name">' + esc(displayName) + '</span>'
      + (isMultipleHoldings ? '<span class="multiple-badge">' + asset.holdings.length + '筆</span>' : '')
      + '</div>'
      + '<div class="asset-item-value">' + formatTWD(twd) + '</div>'
      + '</div>'
      + '<div class="asset-item-details">'
      + '<div class="asset-detail-row">'
      + '<span class="asset-label">總數量:</span>'
      + '<span class="asset-value">' + asset.quantity.toLocaleString('zh-TW') + '</span>'
      + '</div>'
      + '<div class="asset-detail-row">'
      + '<span class="asset-label">平均成本:</span>'
      + '<span class="asset-value">' + priceDisplay + '</span>'
      + '</div>'
      + '<div class="asset-detail-row">'
      + '<span class="asset-label">更新:</span>'
      + '<span class="asset-value">' + esc(lastUpdate) + '</span>'
      + '</div>'
      + '</div>'
      + holdingsDetail
      + '</div>'
      + '<div class="asset-item-actions">'
      + (isMultipleHoldings 
          ? '<button class="btn-icon btn-expand" data-action="toggle-holdings" data-id="' + esc(asset.id) + '" aria-label="展開持股明細">📋</button>'
          : '<button class="btn-icon btn-edit" data-action="edit-asset" data-id="' + esc(asset.holdings[0].id) + '" aria-label="編輯 ' + esc(asset.name) + '">✏️</button>'
            + '<button class="btn-icon btn-delete" data-action="delete-asset" data-id="' + esc(asset.holdings[0].id) + '" aria-label="刪除 ' + esc(asset.name) + '">🗑️</button>'
        )
      + '<button class="btn-icon btn-add" data-action="add-same-stock" data-symbol="' + esc(asset.symbol || '') + '" data-name="' + esc(asset.name) + '" aria-label="新增相同股票">➕</button>'
      + '</div>'
      + '</div>';
  }).join('');

  return '<div class="asset-category">'
    + '<div class="category-header">'
    + '<h3 class="category-title">' + esc(label) + '</h3>'
    + '<span class="category-subtotal">' + formatTWD(subtotal) + '</span>'
    + '</div>'
    + '<div class="category-items">' + items + '</div>'
    + '</div>';
}

export function renderAssetList(currentState) {
  const { assets, liabilities, exchangeRate } = currentState;
  const totals = calculateTotals(assets, liabilities, exchangeRate);
  return renderAssetCategory('投資資產', assets.filter(a => a.category === 'investment'), totals.investmentTotal);
}

// ─── 負債清單 ─────────────────────────────────────────────────────────────────

function renderLiabilityCategory(label, liabilities, subtotal) {
  if (liabilities.length === 0) return '';
  const rate = state.getState().exchangeRate;

  const items = liabilities.map(l => {
    const twd = toTWD(l, rate);
    const amountDisplay = l.amount.toLocaleString('zh-TW') + ' ' + l.currency;
    
    return '<div class="liability-item" data-id="' + esc(l.id) + '">'
      + '<div class="liability-item-info">'
      + '<div class="liability-item-header">'
      + '<div class="liability-item-name">'
      + '<span class="liability-name">' + esc(l.name) + '</span>'
      + '</div>'
      + '<div class="liability-item-value">' + formatTWD(twd) + '</div>'
      + '</div>'
      + '<div class="liability-item-details">'
      + '<div class="liability-detail-row">'
      + '<span class="liability-label">金額:</span>'
      + '<span class="liability-value">' + amountDisplay + '</span>'
      + '</div>'
      + '</div>'
      + '</div>'
      + '<div class="liability-item-actions">'
      + '<button class="btn-icon btn-edit" data-action="edit-liability" data-id="' + esc(l.id) + '" aria-label="編輯 ' + esc(l.name) + '">✏️</button>'
      + '<button class="btn-icon btn-delete" data-action="delete-liability" data-id="' + esc(l.id) + '" aria-label="刪除 ' + esc(l.name) + '">🗑️</button>'
      + '</div>'
      + '</div>';
  }).join('');

  return '<div class="liability-category">'
    + '<div class="category-header">'
    + '<h3 class="category-title">' + esc(label) + '</h3>'
    + '<span class="category-subtotal">' + formatTWD(subtotal) + '</span>'
    + '</div>'
    + '<div class="category-items">' + items + '</div>'
    + '</div>';
}

export function renderLiabilityList(currentState) {
  const { assets, liabilities, exchangeRate } = currentState;
  const totals = calculateTotals(assets, liabilities, exchangeRate);

  // 分類標籤對照
  const CATEGORY_LABELS = {
    credit:   '信貸',
    pledge:   '質押借款',
    mortgage: '理財型房貸',
    other:    '其他負債',
  };

  // 依分類分組，保持順序
  const groups = ['credit', 'pledge', 'mortgage', 'other'];
  const subtotals = {
    credit:   totals.creditTotal,
    pledge:   totals.pledgeTotal,
    mortgage: totals.mortgageTotal,
    other:    totals.otherLiabilityTotal,
  };

  return groups.map(cat => {
    const items = liabilities.filter(l => l.category === cat);
    return renderLiabilityCategory(CATEGORY_LABELS[cat], items, subtotals[cat]);
  }).join('');
}

// ─── 事件委派 ─────────────────────────────────────────────────────────────────

function bindEvents() {
  container.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, id, symbol, name } = btn.dataset;
    const s = state.getState();

    if (action === 'edit-asset') {
      const asset = s.assets.find(a => a.id === id);
      if (asset) openAssetModal(asset);
    } else if (action === 'delete-asset') {
      state.removeAsset(id);
    } else if (action === 'edit-liability') {
      const liability = s.liabilities.find(l => l.id === id);
      if (liability) openLiabilityModal(liability);
    } else if (action === 'delete-liability') {
      state.removeLiability(id);
    } else if (action === 'toggle-holdings') {
      toggleHoldingsDetail(id);
    } else if (action === 'add-same-stock') {
      openAssetModalWithPreset(symbol, name);
    }
  });
}

// ─── 展開/收合持股明細 ─────────────────────────────────────────────────────────

function toggleHoldingsDetail(assetId) {
  const assetItem = container.querySelector(`[data-id="${assetId}"]`);
  if (!assetItem) return;
  
  const holdingsDetail = assetItem.querySelector('.holdings-detail');
  const expandBtn = assetItem.querySelector('[data-action="toggle-holdings"]');
  
  if (holdingsDetail && expandBtn) {
    const isExpanded = holdingsDetail.classList.contains('expanded');
    
    if (isExpanded) {
      holdingsDetail.classList.remove('expanded');
      expandBtn.textContent = '📋';
      expandBtn.setAttribute('aria-label', '展開持股明細');
    } else {
      holdingsDetail.classList.add('expanded');
      expandBtn.textContent = '📁';
      expandBtn.setAttribute('aria-label', '收合持股明細');
    }
  }
}

// ─── 開啟新增相同股票 Modal ─────────────────────────────────────────────────────

function openAssetModalWithPreset(symbol, name) {
  // 先開啟空的 modal
  openAssetModal();
  
  // 等 DOM 更新後填入預設值
  setTimeout(() => {
    const symbolInput = document.getElementById('asset-symbol');
    const nameInput = document.getElementById('asset-name');
    
    if (symbolInput && symbol) {
      symbolInput.value = symbol;
    }
    if (nameInput && name) {
      nameInput.value = name;
    }
    
    // 如果有股票代號，觸發搜尋以載入摘要
    if (symbol && symbolInput) {
      const event = new Event('input', { bubbles: true });
      symbolInput.dispatchEvent(event);
    }
  }, 100);
}

// ─── 渲染 ─────────────────────────────────────────────────────────────────────

function render(currentState) {
  const { assets, liabilities } = currentState;
  const isEmpty = assets.length === 0 && liabilities.length === 0;

  if (isEmpty) {
    emptyState.classList.remove('hidden');
  } else {
    emptyState.classList.add('hidden');
  }

  container.querySelectorAll('.asset-category, .liability-category').forEach(el => el.remove());

  if (!isEmpty) {
    const html = renderAssetList(currentState) + renderLiabilityList(currentState);
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    while (tmp.firstChild) container.insertBefore(tmp.firstChild, emptyState);
  }
}

export function initAssetList() {
  bindEvents();
  state.subscribe(render);
  render(state.getState());
}
