/**
 * assetList.js — 資產與負債清單渲染
 */

import * as state from '../state.js';
import { calculateAssetTWD, calculateTotals, toTWD } from '../calculator.js';
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

  const items = assets.map(asset => {
    const twd        = calculateAssetTWD(asset, rate);
    const symbolHtml = asset.symbol ? '<span class="asset-symbol">' + esc(asset.symbol) + '</span>' : '';
    const lastUpdate = formatLastUpdate(asset.lastPriceUpdate);

    return '<div class="asset-item" data-id="' + esc(asset.id) + '">'
      + '<div class="asset-item-info">'
      + '<div class="asset-item-name">'
      + '<span class="asset-name">' + esc(asset.name) + '</span>'
      + symbolHtml
      + '</div>'
      + '<div class="asset-item-details">'
      + '<span class="asset-quantity">數量：' + asset.quantity.toLocaleString('zh-TW') + '</span>'
      + '<span class="asset-twd-value">' + formatTWD(twd) + '</span>'
      + '</div>'
      + '<div class="asset-item-update">'
      + '<span class="asset-last-update">更新：' + esc(lastUpdate) + '</span>'
      + '</div>'
      + '</div>'
      + '<div class="asset-item-actions">'
      + '<button class="btn-icon btn-edit" data-action="edit-asset" data-id="' + esc(asset.id) + '" aria-label="編輯 ' + esc(asset.name) + '">編輯</button>'
      + '<button class="btn-icon btn-delete" data-action="delete-asset" data-id="' + esc(asset.id) + '" aria-label="刪除 ' + esc(asset.name) + '">刪除</button>'
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
  return renderAssetCategory('投資資產', assets.filter(a => a.category === 'investment'), totals.investmentTotal)
    + renderAssetCategory('流動資產', assets.filter(a => a.category === 'liquid'), totals.liquidTotal);
}

// ─── 負債清單 ─────────────────────────────────────────────────────────────────

function renderLiabilityCategory(label, liabilities, subtotal) {
  if (liabilities.length === 0) return '';
  const rate = state.getState().exchangeRate;

  const items = liabilities.map(l => {
    const twd = toTWD(l, rate);
    return '<div class="liability-item" data-id="' + esc(l.id) + '">'
      + '<div class="liability-item-info">'
      + '<div class="liability-item-name"><span class="liability-name">' + esc(l.name) + '</span></div>'
      + '<div class="liability-item-details">'
      + '<span class="liability-amount">' + esc(l.currency) + ' ' + l.amount.toLocaleString('zh-TW') + '</span>'
      + '<span class="liability-twd-value">' + formatTWD(twd) + '</span>'
      + '</div>'
      + '</div>'
      + '<div class="liability-item-actions">'
      + '<button class="btn-icon btn-edit" data-action="edit-liability" data-id="' + esc(l.id) + '" aria-label="編輯 ' + esc(l.name) + '">編輯</button>'
      + '<button class="btn-icon btn-delete" data-action="delete-liability" data-id="' + esc(l.id) + '" aria-label="刪除 ' + esc(l.name) + '">刪除</button>'
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
    const { action, id } = btn.dataset;
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
    }
  });
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
