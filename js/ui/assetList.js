/**
 * assetList.js — 資產與負債清單渲染
 */

import * as state from '../state.js';
import { calculateAssetTWD, calculateTotals, toTWD, consolidateAssets, calculateLoanSchedule, calculateEqualPrincipalSchedule } from '../calculator.js';
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
  
  // 整合相同股票
  const consolidatedAssets = consolidateAssets(assets, rate);

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
      + '<div class="asset-detail-row"><span class="asset-label">總數量</span><span class="asset-value">' + asset.quantity.toLocaleString('zh-TW') + '</span></div>'
      + '<div class="asset-detail-row"><span class="asset-label">每單位價格</span><span class="asset-value">' + priceDisplay + '</span></div>'
      + '<div class="asset-detail-row"><span class="asset-label">更新</span><span class="asset-value">' + esc(lastUpdate) + '</span></div>'
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
    const isInstallment = (l.category === 'credit' || l.category === 'home_loan') && l.interestRate && l.terms;
    const isRevolving = (l.category === 'pledge' || l.category === 'mortgage') && l.interestRate;
    
    // 組裝標籤
    let detailRows = '';
    let loanSummary = '';
    let loanScheduleHtml = '';
    
    if (l.interestRate) detailRows += '<span class="liability-tag">年利率 ' + l.interestRate + '%</span>';
    
    if (isInstallment) {
      if (l.terms) detailRows += '<span class="liability-tag">' + l.terms + ' 期</span>';
      if (l.startDate) detailRows += '<span class="liability-tag">借 ' + l.startDate + '</span>';
      if (l.endDate) detailRows += '<span class="liability-tag">還 ' + l.endDate + '</span>';
    } else if (isRevolving) {
      if (l.creditLine) detailRows += '<span class="liability-tag">額度 ' + NTD + Math.round(l.creditLine).toLocaleString('zh-TW') + '</span>';
      if (l.drawdownDate || l.startDate) detailRows += '<span class="liability-tag">動用 ' + (l.drawdownDate || l.startDate) + '</span>';
      const monthlyInterest = Math.round(l.amount * l.interestRate / 100 / 12);
      detailRows += '<span class="liability-tag liability-tag-accent">月息 ' + NTD + monthlyInterest.toLocaleString('zh-TW') + '</span>';
      
      // 計息天數計算器（從動用日期算到今天）
      const ddDate = l.drawdownDate || l.startDate;
      const startMs = ddDate ? new Date(ddDate).getTime() : null;
      const daysSinceStart = startMs ? Math.max(0, Math.floor((Date.now() - startMs) / 86400000)) : 0;
      const dailyInterest = l.amount * l.interestRate / 100 / 365;
      const accruedInterest = Math.round(dailyInterest * daysSinceStart);
      
      loanScheduleHtml = '<div class="loan-schedule hidden" data-schedule-id="' + esc(l.id) + '">'
        + '<div class="loan-summary-row">'
        + '<div class="loan-summary-item"><span class="loan-summary-label">動用金額</span><span class="loan-summary-value">' + NTD + Math.round(l.amount).toLocaleString('zh-TW') + '</span></div>'
        + '<div class="loan-summary-item"><span class="loan-summary-label">年利率</span><span class="loan-summary-value">' + l.interestRate + '%</span></div>'
        + (l.creditLine ? '<div class="loan-summary-item"><span class="loan-summary-label">核准額度</span><span class="loan-summary-value">' + NTD + Math.round(l.creditLine).toLocaleString('zh-TW') + '</span></div>' : '')
        + '<div class="loan-summary-item"><span class="loan-summary-label">日息</span><span class="loan-summary-value">' + NTD + Math.round(dailyInterest).toLocaleString('zh-TW') + '</span></div>'
        + '</div>'
        // 計息天數互動區
        + '<div class="revolving-calc">'
        + '<div class="revolving-calc-row">'
        + '<span class="revolving-calc-label">計息天數</span>'
        + '<input class="form-input revolving-days-input" type="number" data-revolving-id="' + esc(l.id) + '"'
        + ' data-amount="' + l.amount + '" data-rate="' + l.interestRate + '"'
        + ' value="' + daysSinceStart + '" min="0" step="1" />'
        + '<span class="revolving-calc-unit">天</span>'
        + '</div>'
        + '<div class="revolving-result">'
        + '<span class="revolving-result-label">應繳利息</span>'
        + '<span class="revolving-result-value" id="revolving-interest-' + esc(l.id) + '">' + NTD + accruedInterest.toLocaleString('zh-TW') + '</span>'
        + '</div>'
        + '</div>'
        + '</div>';
    }
    
    // 計算還款摘要（僅信貸）
    if (isInstallment) {
      const loanA = calculateLoanSchedule(l.amount, l.interestRate, l.terms);
      const loanB = calculateEqualPrincipalSchedule(l.amount, l.interestRate, l.terms);
      const fmt = n => Math.round(n).toLocaleString('zh-TW');
      
      loanSummary = '<span class="liability-tag liability-tag-accent">月付 ' + NTD + fmt(loanA.monthlyPayment) + '</span>'
        + '<span class="liability-tag liability-tag-danger">總利息 ' + NTD + fmt(loanA.totalInterest) + '</span>';
      
      function buildScheduleHtml(loan, mode) {
        let paymentBreakdown = '<div class="loan-payment-breakdown">'
          + '<div class="loan-payment-title">每期應還本利和</div>';
        
        if (mode === 'equal-principal') {
          // 本金攤還：首期和末期不同
          paymentBreakdown += '<div class="loan-payment-row">'
            + '<span class="loan-payment-period">第 1 個月</span>'
            + '<span class="loan-payment-amount">' + NTD + fmt(loan.monthlyPayment) + '</span>'
            + '</div>'
            + '<div class="loan-payment-row">'
            + '<span class="loan-payment-period">第 ' + l.terms + ' 個月</span>'
            + '<span class="loan-payment-amount">' + NTD + fmt(loan.lastMonthPayment) + '</span>'
            + '</div>';
        } else if (loan.hasIrregularLast) {
          paymentBreakdown += '<div class="loan-payment-row">'
            + '<span class="loan-payment-period">第 1 ~ ' + (l.terms - 1) + ' 個月</span>'
            + '<span class="loan-payment-amount">' + NTD + fmt(loan.monthlyPayment) + '</span>'
            + '</div>'
            + '<div class="loan-payment-row">'
            + '<span class="loan-payment-period">第 ' + l.terms + ' 個月</span>'
            + '<span class="loan-payment-amount">' + NTD + fmt(loan.lastMonthPayment) + '</span>'
            + '</div>';
        } else {
          paymentBreakdown += '<div class="loan-payment-row">'
            + '<span class="loan-payment-period">第 1 ~ ' + l.terms + ' 個月</span>'
            + '<span class="loan-payment-amount">' + NTD + fmt(loan.monthlyPayment) + '</span>'
            + '</div>';
        }
        paymentBreakdown += '</div>';
        
        return '<div class="loan-summary-row">'
          + '<div class="loan-summary-item"><span class="loan-summary-label">貸款金額</span><span class="loan-summary-value">' + NTD + fmt(l.amount) + '</span></div>'
          + '<div class="loan-summary-item"><span class="loan-summary-label">年利率</span><span class="loan-summary-value">' + l.interestRate + '%</span></div>'
          + '<div class="loan-summary-item"><span class="loan-summary-label">總還款</span><span class="loan-summary-value">' + NTD + fmt(loan.totalPayment) + '</span></div>'
          + '<div class="loan-summary-item"><span class="loan-summary-label">總利息</span><span class="loan-summary-value negative">' + NTD + fmt(loan.totalInterest) + '</span></div>'
          + '</div>'
          + paymentBreakdown
          + '<div class="loan-table-wrap">'
          + '<table class="loan-table">'
          + '<thead><tr><th>期數</th>' + (l.startDate ? '<th>月份</th>' : '') + '<th>還本</th><th>利息</th><th>月付</th><th>餘額</th><th>累計利息</th></tr></thead>'
          + '<tbody>'
          + loan.schedule.map(row => {
            let monthCell = '';
            if (l.startDate) {
              const start = new Date(l.startDate);
              const d = new Date(start.getFullYear(), start.getMonth() + row.term, 1);
              monthCell = '<td>' + d.getFullYear() + '/' + String(d.getMonth() + 1).padStart(2, '0') + '</td>';
            }
            return '<tr><td>' + row.term + '</td>'
              + monthCell
              + '<td>' + fmt(row.principalPart) + '</td>'
              + '<td>' + fmt(row.interestPart) + '</td>'
              + '<td>' + fmt(row.payment) + '</td>'
              + '<td>' + fmt(row.remainingBalance) + '</td>'
              + '<td>' + fmt(row.cumulativeInterest) + '</td></tr>';
          }).join('')
          + '</tbody></table></div>';
      }
      
      loanScheduleHtml = '<div class="loan-schedule hidden" data-schedule-id="' + esc(l.id) + '">'
        // 攤還方式切換
        + '<div class="loan-mode-toggle">'
        + '<button class="loan-mode-btn active" data-action="switch-loan-mode" data-mode="equal-payment" data-id="' + esc(l.id) + '">本息平均攤還</button>'
        + '<button class="loan-mode-btn" data-action="switch-loan-mode" data-mode="equal-principal" data-id="' + esc(l.id) + '">本金平均攤還</button>'
        + '</div>'
        + '<div class="loan-mode-content" data-mode-content="equal-payment" data-parent-id="' + esc(l.id) + '">'
        + buildScheduleHtml(loanA, 'equal-payment')
        + '</div>'
        + '<div class="loan-mode-content hidden" data-mode-content="equal-principal" data-parent-id="' + esc(l.id) + '">'
        + buildScheduleHtml(loanB, 'equal-principal')
        + '</div>'
        + '</div>';
    }
    
    const detailHtml = (detailRows || loanSummary)
      ? '<div class="liability-tags">' + detailRows + loanSummary + '</div>'
      : '';
    
    return '<div class="liability-item" data-id="' + esc(l.id) + '">'
      + '<div class="liability-item-info">'
      + '<div class="liability-item-header">'
      + '<div class="liability-item-name">'
      + '<span class="liability-name">' + esc(l.name) + '</span>'
      + '</div>'
      + '<div class="liability-item-actions">'
      + (isInstallment || isRevolving
        ? '<button class="btn-icon btn-expand" data-action="toggle-schedule" data-id="' + esc(l.id) + '" aria-label="還款明細">📊</button>'
        : '')
      + '<button class="btn-icon btn-edit" data-action="edit-liability" data-id="' + esc(l.id) + '" aria-label="編輯 ' + esc(l.name) + '">✏️</button>'
      + '<button class="btn-icon btn-delete" data-action="delete-liability" data-id="' + esc(l.id) + '" aria-label="刪除 ' + esc(l.name) + '">🗑️</button>'
      + '</div>'
      + '</div>'
      + '<div class="liability-item-value">' + formatTWD(twd) + '</div>'
      + detailHtml
      + loanScheduleHtml
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
    credit:    '信貸',
    home_loan: '房貸',
    pledge:    '質押借款',
    mortgage:  '理財型房貸',
    other:     '其他負債',
  };

  // 依分類分組，保持順序
  const groups = ['credit', 'home_loan', 'pledge', 'mortgage', 'other'];
  const subtotals = {
    credit:    totals.creditTotal,
    home_loan: totals.homeLoanTotal,
    pledge:    totals.pledgeTotal,
    mortgage:  totals.mortgageTotal,
    other:     totals.otherLiabilityTotal,
  };

  return groups.map(cat => {
    const items = liabilities.filter(l => l.category === cat);
    return renderLiabilityCategory(CATEGORY_LABELS[cat], items, subtotals[cat]);
  }).join('');
}

// ─── 自訂確認對話框 ───────────────────────────────────────────────────────────

function showConfirm(message) {
  return new Promise(resolve => {
    const overlay = document.getElementById('confirm-overlay');
    const msgEl   = document.getElementById('confirm-message');
    const okBtn   = document.getElementById('confirm-ok');
    const cancelBtn = document.getElementById('confirm-cancel');
    const closeBtn = document.getElementById('confirm-close');
    
    msgEl.textContent = message;
    overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    
    function cleanup(result) {
      overlay.classList.add('hidden');
      document.body.style.overflow = '';
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      closeBtn.removeEventListener('click', onCancel);
      overlay.removeEventListener('click', onOverlay);
      resolve(result);
    }
    
    function onOk() { cleanup(true); }
    function onCancel() { cleanup(false); }
    function onOverlay(e) { if (!e.target.closest('.modal')) cleanup(false); }
    
    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    closeBtn.addEventListener('click', onCancel);
    overlay.addEventListener('click', onOverlay);
  });
}

// ─── 事件委派 ─────────────────────────────────────────────────────────────────

function bindEvents() {
  container.addEventListener('click', async e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, id, symbol, name } = btn.dataset;
    const s = state.getState();

    if (action === 'edit-asset') {
      const asset = s.assets.find(a => a.id === id);
      if (asset) openAssetModal(asset);
    } else if (action === 'delete-asset') {
      const asset = s.assets.find(a => a.id === id);
      const displayName = asset ? (asset.symbol ? `${asset.symbol} ${asset.name}` : asset.name) : '';
      const ok = await showConfirm(`確定要刪除「${displayName}」嗎？`);
      if (ok) state.removeAsset(id);
    } else if (action === 'edit-liability') {
      const liability = s.liabilities.find(l => l.id === id);
      if (liability) openLiabilityModal(liability);
    } else if (action === 'delete-liability') {
      const liability = s.liabilities.find(l => l.id === id);
      const displayName = liability ? liability.name : '';
      const ok = await showConfirm(`確定要刪除「${displayName}」嗎？`);
      if (ok) state.removeLiability(id);
    } else if (action === 'toggle-holdings') {
      toggleHoldingsDetail(id);
    } else if (action === 'toggle-schedule') {
      toggleLoanSchedule(id);
    } else if (action === 'switch-loan-mode') {
      switchLoanMode(btn);
    } else if (action === 'add-same-stock') {
      openAssetModalWithPreset(symbol, name);
    }
  });
  
  // 循環型計息天數即時計算
  container.addEventListener('input', e => {
    const input = e.target.closest('.revolving-days-input');
    if (!input) return;
    const { revolvingId, amount, rate: rateStr } = input.dataset;
    const days = parseInt(input.value) || 0;
    const amt = parseFloat(amount) || 0;
    const r = parseFloat(rateStr) || 0;
    const interest = Math.round(amt * r / 100 / 365 * days);
    const resultEl = document.getElementById('revolving-interest-' + revolvingId);
    if (resultEl) resultEl.textContent = NTD + interest.toLocaleString('zh-TW');
  });
}

// ─── 切換攤還方式 ──────────────────────────────────────────────────────────────

function switchLoanMode(btn) {
  const mode = btn.dataset.mode;
  const id = btn.dataset.id;
  
  // 切換按鈕 active
  const toggle = btn.closest('.loan-mode-toggle');
  if (toggle) {
    toggle.querySelectorAll('.loan-mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }
  
  // 切換內容
  const schedule = btn.closest('.loan-schedule');
  if (schedule) {
    schedule.querySelectorAll('.loan-mode-content').forEach(c => {
      c.classList.toggle('hidden', c.dataset.modeContent !== mode);
    });
  }
}

// ─── 展開/收合還款明細 ─────────────────────────────────────────────────────────

function toggleLoanSchedule(liabilityId) {
  const schedule = container.querySelector(`[data-schedule-id="${liabilityId}"]`);
  const btn = container.querySelector(`[data-action="toggle-schedule"][data-id="${liabilityId}"]`);
  if (!schedule) return;
  
  const isHidden = schedule.classList.contains('hidden');
  schedule.classList.toggle('hidden');
  if (btn) {
    btn.textContent = isHidden ? '📉' : '📊';
    btn.setAttribute('aria-label', isHidden ? '收合還款明細' : '還款明細');
  }
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

  // 記住展開狀態
  const expandedSchedules = new Set();
  container.querySelectorAll('.loan-schedule:not(.hidden)').forEach(el => {
    const id = el.dataset.scheduleId;
    if (id) expandedSchedules.add(id);
  });
  const expandedHoldings = new Set();
  container.querySelectorAll('.holdings-detail.expanded').forEach(el => {
    const item = el.closest('[data-id]');
    if (item) expandedHoldings.add(item.dataset.id);
  });

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

    // 恢復展開狀態
    expandedSchedules.forEach(id => {
      const el = container.querySelector(`[data-schedule-id="${id}"]`);
      if (el) el.classList.remove('hidden');
      const btn = container.querySelector(`[data-action="toggle-schedule"][data-id="${id}"]`);
      if (btn) btn.textContent = '📉';
    });
    expandedHoldings.forEach(id => {
      const item = container.querySelector(`[data-id="${id}"]`);
      if (item) {
        const detail = item.querySelector('.holdings-detail');
        if (detail) detail.classList.add('expanded');
        const btn = item.querySelector('[data-action="toggle-holdings"]');
        if (btn) btn.textContent = '📁';
      }
    });
  }
}

export function initAssetList() {
  bindEvents();
  state.subscribe(render);
  render(state.getState());
}
