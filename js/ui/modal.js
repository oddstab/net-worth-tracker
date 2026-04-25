/**
 * modal.js — 新增/編輯 Modal（含股票/加密貨幣搜尋下拉與摘要面板）
 */

import * as state from '../state.js';
import { validateQuantity, validatePrice, validateAmount } from '../calculator.js';
import {
  searchTWStock,
  searchCrypto,
  getTWStockDetail,
  getCryptoDetail,
  getStockCompanyInfo,
} from '../searchService.js';

// ─── DOM ─────────────────────────────────────────────────────────────────────

const overlay    = document.getElementById('modal-overlay');
const modalEl    = document.getElementById('modal');
const modalTitle = document.getElementById('modal-title');
const modalBody  = document.getElementById('modal-body');
const modalClose = document.getElementById('modal-close');

// ─── UUID ─────────────────────────────────────────────────────────────────────

function generateUUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ─── 關閉 ─────────────────────────────────────────────────────────────────────

export function closeModal() {
  overlay.classList.add('hidden');
  modalBody.innerHTML = '';
  modalEl.classList.remove('modal--wide');
}

// ─── 欄位錯誤 ─────────────────────────────────────────────────────────────────

function showFieldError(id, msg) {
  const el = document.getElementById(id);
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}
function clearFieldError(id) {
  const el = document.getElementById(id);
  if (el) { el.textContent = ''; el.style.display = 'none'; }
}

// ─── XSS 防護 ─────────────────────────────────────────────────────────────────

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ─── 格式化（NT$ 用 charCode 避免 PowerShell 截斷問題）────────────────────────

const NTD = 'NT' + String.fromCharCode(36); // 'NT$'

function fmtNTD(n) {
  if (n === null || n === undefined) return '--';
  return NTD + n.toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtUSD(n) {
  if (n === null || n === undefined) return '--';
  return '$' + n.toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtChange(n) {
  if (n === null || n === undefined) return '--';
  return (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
}
function fmtMarketCap(n) {
  if (!n) return '--';
  if (n >= 1e12) return NTD + (n / 1e12).toFixed(2) + ' 兆';
  if (n >= 1e8)  return NTD + (n / 1e8).toFixed(1) + ' 億';
  return NTD + n.toLocaleString('zh-TW');
}
function fmtPrice(n) {
  if (n === null || n === undefined) return '--';
  return NTD + n.toFixed(2);
}

// ─── 搜尋下拉 ─────────────────────────────────────────────────────────────────

let searchDebounceTimer = null;

function selectDropdownItem(item, input, dropdown, onSelect) {
  const symbol = item.dataset.symbol;
  const name   = item.dataset.name;
  const coinId = item.dataset.coinId;
  const price  = item.dataset.price ? parseFloat(item.dataset.price) : null;

  input.value = symbol;
  dropdown.classList.add('hidden');

  // 自動帶入名稱
  const nameInput = document.getElementById('asset-name');
  if (nameInput) nameInput.value = name;

  // 自動帶入價格
  if (price !== null && !isNaN(price)) {
    const priceInput = document.getElementById('asset-price');
    if (priceInput) priceInput.value = price;
    const currencySelect = document.getElementById('asset-currency');
    if (currencySelect) currencySelect.value = 'TWD';
  }

  onSelect({ symbol, name, coinId, assetType: item.dataset.assetType });
}

function initSearchDropdown(assetType, onSelect) {
  const input    = document.getElementById('asset-symbol');
  const dropdown = document.getElementById('symbol-dropdown');
  if (!input || !dropdown) return;

  let highlightIndex = -1;

  function getItems() {
    return Array.from(dropdown.querySelectorAll('.search-dropdown-item'));
  }

  function setHighlight(idx) {
    const items = getItems();
    items.forEach((el, i) => el.classList.toggle('highlighted', i === idx));
    highlightIndex = idx;
    if (idx >= 0) items[idx]?.scrollIntoView({ block: 'nearest' });
  }

  input.addEventListener('input', () => {
    clearTimeout(searchDebounceTimer);
    highlightIndex = -1;
    const q = input.value.trim();

    if (q.length < 1) {
      dropdown.innerHTML = '';
      dropdown.classList.add('hidden');
      return;
    }

    searchDebounceTimer = setTimeout(async () => {
      const results = assetType === 'tw_stock'
        ? await searchTWStock(q)
        : searchCrypto(q);

      if (results.length === 0) {
        dropdown.innerHTML = '<div class="search-dropdown-empty">找不到符合的結果</div>';
        dropdown.classList.remove('hidden');
        return;
      }

      dropdown.innerHTML = results.map(r => {
        if (assetType === 'tw_stock') {
          const priceAttr = r.close != null ? ' data-price="' + r.close + '"' : '';
          const priceHtml = r.close != null
            ? '<span class="sdi-price">' + NTD + r.close.toFixed(2) + '</span>'
            : '';
          return '<div class="search-dropdown-item"'
            + ' data-symbol="' + esc(r.symbol) + '"'
            + ' data-name="' + esc(r.name) + '"'
            + ' data-coin-id=""'
            + ' data-asset-type="tw_stock"'
            + priceAttr + '>'
            + '<span class="sdi-symbol">' + esc(r.symbol) + '</span>'
            + '<span class="sdi-name">' + esc(r.name) + '</span>'
            + '<span class="sdi-tag">' + esc(r.type) + '</span>'
            + priceHtml
            + '</div>';
        } else {
          return '<div class="search-dropdown-item"'
            + ' data-symbol="' + esc(r.symbol) + '"'
            + ' data-name="' + esc(r.name) + '"'
            + ' data-coin-id="' + esc(r.id) + '"'
            + ' data-asset-type="crypto">'
            + '<span class="sdi-symbol">' + esc(r.symbol) + '</span>'
            + '<span class="sdi-name">' + esc(r.name) + '</span>'
            + '<span class="sdi-tag">' + esc(r.category) + '</span>'
            + '</div>';
        }
      }).join('');

      dropdown.classList.remove('hidden');
      highlightIndex = -1;

      dropdown.querySelectorAll('.search-dropdown-item').forEach(item => {
        item.addEventListener('mousedown', e => {
          e.preventDefault();
          selectDropdownItem(item, input, dropdown, onSelect);
        });
      });
    }, 200);
  });

  // 鍵盤導航：↑↓ + Enter + Escape
  input.addEventListener('keydown', e => {
    const items = getItems();
    if (dropdown.classList.contains('hidden') || items.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight(Math.min(highlightIndex + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight(Math.max(highlightIndex - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = highlightIndex >= 0 ? items[highlightIndex] : items[0];
      if (target) selectDropdownItem(target, input, dropdown, onSelect);
    } else if (e.key === 'Escape') {
      dropdown.classList.add('hidden');
    }
  });

  input.addEventListener('blur', () => {
    setTimeout(() => dropdown.classList.add('hidden'), 150);
  });
}

// ─── 摘要面板 ─────────────────────────────────────────────────────────────────

function showSummaryLoading() {
  const panel = document.getElementById('asset-summary-panel');
  if (!panel) return;
  panel.innerHTML = '<div class="summary-loading"><div class="summary-spinner"></div><span>載入中…</span></div>';
}

function renderStockSummary(detail, companyInfo, onPriceApply) {
  const panel = document.getElementById('asset-summary-panel');
  if (!panel) return;

  if (!detail) {
    panel.innerHTML = '<div class="summary-error">無法取得資料，請手動輸入價格。</div>';
    return;
  }

  const changeClass = detail.change === null ? '' : detail.change >= 0 ? 'positive' : 'negative';
  const changeStr = detail.change !== null
    ? (detail.change >= 0 ? '+' : '') + detail.change.toFixed(2) + ' (' + fmtChange(detail.changePercent) + ')'
    : '--';

  const priceDateBadge = detail.isHistorical && detail.priceDate
    ? '<span class="summary-hist-badge">收盤 ' + esc(detail.priceDate) + '</span>'
    : '';

  // ETF 或個股資訊區塊
  const etf = detail.etfMeta;
  let infoBlock = '';

  if (etf) {
    const featureHtml = etf.feature
      ? '<div class="summary-etf-feature"><div class="summary-desc-title">持股特色</div>'
        + '<p class="summary-etf-feature-text">' + esc(etf.feature) + '</p></div>'
      : '';
    const rows = [
      etf.aum           ? '<tr><td>資產規模</td><td>' + esc(etf.aum) + '</td></tr>' : '',
      etf.yearsListed   ? '<tr><td>成立年數</td><td>' + esc(etf.yearsListed) + '</td></tr>' : '',
      etf.expenseRatio  ? '<tr><td>內扣費用</td><td>' + esc(etf.expenseRatio) + '</td></tr>' : '',
      etf.holders       ? '<tr><td>受益人數</td><td>' + esc(etf.holders) + '</td></tr>' : '',
      etf.dividendCycle ? '<tr><td>配息週期</td><td>' + esc(etf.dividendCycle) + '</td></tr>' : '',
      etf.fundType      ? '<tr><td>基金類型</td><td>' + esc(etf.fundType) + '</td></tr>' : '',
      etf.indexCurrency ? '<tr><td>指數幣別</td><td>' + esc(etf.indexCurrency) + '</td></tr>' : '',
      etf.trackIndex    ? '<tr><td>追蹤指數</td><td>' + esc(etf.trackIndex) + '</td></tr>' : '',
      etf.fundName      ? '<tr><td>基金名稱</td><td class="td-wrap">' + esc(etf.fundName) + '</td></tr>' : '',
    ].join('');
    infoBlock = '<div class="summary-etf-section">' + featureHtml
      + '<table class="summary-etf-table">' + rows + '</table></div>';

  } else if (companyInfo) {
    const capitalNum = parseInt((companyInfo.capital || '').replace(/,/g, '') || '0');
    const capitalFmt = capitalNum >= 1e8
      ? (capitalNum / 1e8).toFixed(1) + ' 億元'
      : capitalNum > 0 ? capitalNum.toLocaleString('zh-TW') + ' 元' : '';

    const sharesNum = parseInt((companyInfo.shares || '').replace(/,/g, '') || '0');
    const sharesFmt = sharesNum >= 1e8
      ? (sharesNum / 1e8).toFixed(2) + ' 億股'
      : sharesNum > 0 ? sharesNum.toLocaleString('zh-TW') + ' 股' : '';

    const ld = (companyInfo.listedDate || '').replace(/(\d{4})(\d{2})(\d{2})/, '$1/$2/$3');

    const rows = [
      companyInfo.industry ? '<tr><td>產業別</td><td>' + esc(companyInfo.industry) + '</td></tr>' : '',
      capitalFmt           ? '<tr><td>實收資本額</td><td>' + esc(capitalFmt) + '</td></tr>' : '',
      sharesFmt            ? '<tr><td>已發行股數</td><td>' + esc(sharesFmt) + '</td></tr>' : '',
      ld                   ? '<tr><td>上市日期</td><td>' + esc(ld) + '</td></tr>' : '',
      companyInfo.chairman ? '<tr><td>董事長</td><td>' + esc(companyInfo.chairman) + '</td></tr>' : '',
      companyInfo.ceo      ? '<tr><td>總經理</td><td>' + esc(companyInfo.ceo) + '</td></tr>' : '',
      companyInfo.website  ? '<tr><td>官網</td><td><a href="' + esc(companyInfo.website)
        + '" target="_blank" rel="noopener" style="color:var(--accent-color);word-break:break-all;">'
        + esc(companyInfo.website.replace(/^https?:\/\//, '')) + '</a></td></tr>' : '',
    ].join('');
    infoBlock = '<div class="summary-etf-section"><table class="summary-etf-table">' + rows + '</table></div>';
  }

  const applyBtn = detail.price !== null
    ? '<button class="btn btn-primary summary-apply-btn" id="apply-price-btn">套用價格 '
      + fmtPrice(detail.price) + '</button>'
    : '';

  panel.innerHTML =
    '<div class="summary-header">'
    + '<div class="summary-title-row">'
    + '<span class="summary-symbol">' + esc(detail.symbol) + '</span>'
    + '<span class="summary-exchange-badge">' + esc(detail.exchange) + '</span>'
    + priceDateBadge
    + '</div>'
    + '<div class="summary-name">' + esc(detail.name) + '</div>'
    + '</div>'
    + '<div class="summary-price-block">'
    + '<div class="summary-price">' + fmtPrice(detail.price) + '</div>'
    + '<div class="summary-change ' + changeClass + '">' + changeStr + '</div>'
    + '</div>'
    + '<div class="summary-stats">'
    + '<div class="summary-stat"><span class="ss-label">今日高</span><span class="ss-value">' + fmtPrice(detail.high) + '</span></div>'
    + '<div class="summary-stat"><span class="ss-label">今日低</span><span class="ss-value">' + fmtPrice(detail.low) + '</span></div>'
    + '<div class="summary-stat"><span class="ss-label">成交量</span><span class="ss-value">' + (detail.volume || '--') + '</span></div>'
    + '<div class="summary-stat"><span class="ss-label">類型</span><span class="ss-value">' + esc(detail.type) + '</span></div>'
    + '</div>'
    + infoBlock
    + applyBtn;

  if (detail.price !== null) {
    document.getElementById('apply-price-btn')?.addEventListener('click', () => onPriceApply(detail.price));
  }
}

function renderCryptoSummary(detail, onPriceApply) {
  const panel = document.getElementById('asset-summary-panel');
  if (!panel) return;

  if (!detail) {
    panel.innerHTML = '<div class="summary-error">無法取得資料，請手動輸入價格。</div>';
    return;
  }

  const changeClass = detail.change24h === null ? '' : detail.change24h >= 0 ? 'positive' : 'negative';

  const applyBtn = detail.priceTWD !== null
    ? '<button class="btn btn-primary summary-apply-btn" id="apply-price-btn">套用價格 '
      + fmtPrice(detail.priceTWD) + '</button>'
    : '';

  panel.innerHTML =
    '<div class="summary-header">'
    + '<div class="summary-title-row">'
    + '<span class="summary-symbol">' + esc(detail.symbol) + '</span>'
    + '<span class="summary-exchange-badge crypto-badge">Crypto</span>'
    + '</div>'
    + '<div class="summary-name">' + esc(detail.name) + '</div>'
    + (detail.category ? '<div class="summary-category-tag">' + esc(detail.category) + '</div>' : '')
    + '</div>'
    + '<div class="summary-price-block">'
    + '<div class="summary-price">' + fmtNTD(detail.priceTWD) + '</div>'
    + '<div class="summary-price-usd">' + fmtUSD(detail.priceUSD) + '</div>'
    + '<div class="summary-change ' + changeClass + '">24h ' + fmtChange(detail.change24h) + '</div>'
    + '</div>'
    + '<div class="summary-stats">'
    + '<div class="summary-stat summary-stat--full"><span class="ss-label">市值（TWD）</span>'
    + '<span class="ss-value">' + fmtMarketCap(detail.marketCapTWD) + '</span></div>'
    + '</div>'
    + (detail.description
      ? '<div class="summary-description"><div class="summary-desc-title">簡介</div>'
        + '<p class="summary-desc-text">' + esc(detail.description) + '</p></div>'
      : '')
    + applyBtn;

  if (detail.priceTWD !== null) {
    document.getElementById('apply-price-btn')?.addEventListener('click', () => onPriceApply(detail.priceTWD));
  }
}

async function loadAndRenderSummary({ symbol, coinId, assetType }) {
  showSummaryLoading();
  modalEl.classList.add('modal--wide');

  if (assetType === 'tw_stock') {
    const [detail, companyInfo] = await Promise.all([
      getTWStockDetail(symbol),
      getStockCompanyInfo(symbol),
    ]);
    renderStockSummary(detail, companyInfo, price => {
      const priceInput = document.getElementById('asset-price');
      if (priceInput) priceInput.value = price;
      const currencySelect = document.getElementById('asset-currency');
      if (currencySelect) currencySelect.value = 'TWD';
    });
  } else {
    const detail = await getCryptoDetail(coinId || symbol.toLowerCase());
    renderCryptoSummary(detail, price => {
      const priceInput = document.getElementById('asset-price');
      if (priceInput) priceInput.value = price;
      const currencySelect = document.getElementById('asset-currency');
      if (currencySelect) currencySelect.value = 'TWD';
    });
  }
}

// ─── 資產 Modal ───────────────────────────────────────────────────────────────

export function openAssetModal(asset = null) {
  const isEdit       = asset !== null;
  modalTitle.textContent = isEdit ? '編輯資產' : '新增資產';

  const name         = isEdit ? asset.name : '';
  const symbol       = isEdit ? (asset.symbol || '') : '';
  const category     = isEdit ? asset.category : 'investment';
  const type         = isEdit ? asset.type : 'tw_stock';
  const quantity     = isEdit ? asset.quantity : '';
  const currency     = isEdit ? asset.currency : 'TWD';
  const pricePerUnit = isEdit ? asset.pricePerUnit : '';

  const sel = (val, opt) => val === opt ? ' selected' : '';

  modalBody.innerHTML =
    '<div class="asset-modal-layout">'
    + '<div class="asset-form-col">'
    + '<form id="asset-form" novalidate autocomplete="off">'

    // 類型
    + '<div class="form-group">'
    + '<label class="form-label" for="asset-type">類型 <span class="required">*</span></label>'
    + '<select class="form-input" id="asset-type" name="type">'
    + '<option value="tw_stock"' + sel(type,'tw_stock') + '>台股</option>'
    + '<option value="crypto"'   + sel(type,'crypto')   + '>加密貨幣</option>'
    + '<option value="cash"'     + sel(type,'cash')     + '>現金</option>'
    + '<option value="other"'    + sel(type,'other')    + '>其他</option>'
    + '</select></div>'

    // 代號搜尋
    + '<div class="form-group" id="symbol-group">'
    + '<label class="form-label" for="asset-symbol">代號 / 搜尋</label>'
    + '<div class="search-input-wrapper">'
    + '<input class="form-input" type="text" id="asset-symbol" name="symbol"'
    + ' value="' + esc(symbol) + '" placeholder="輸入代號或名稱搜尋…" autocomplete="off" />'
    + '<div class="search-dropdown hidden" id="symbol-dropdown"></div>'
    + '</div></div>'

    // 名稱
    + '<div class="form-group">'
    + '<label class="form-label" for="asset-name">名稱 <span class="required">*</span></label>'
    + '<input class="form-input" type="text" id="asset-name" name="asset-name-x"'
    + ' value="' + esc(name) + '" autocomplete="off" required />'
    + '<span class="form-error" id="asset-name-error" style="display:none;"></span>'
    + '</div>'

    // 分類
    + '<div class="form-group">'
    + '<label class="form-label" for="asset-category">分類 <span class="required">*</span></label>'
    + '<select class="form-input" id="asset-category" name="category">'
    + '<option value="investment"' + sel(category,'investment') + '>投資資產</option>'
    + '<option value="liquid"'     + sel(category,'liquid')     + '>流動資產</option>'
    + '</select></div>'

    // 數量
    + '<div class="form-group">'
    + '<label class="form-label" for="asset-quantity">數量 <span class="required">*</span></label>'
    + '<input class="form-input" type="number" id="asset-quantity" name="asset-quantity-x"'
    + ' value="' + quantity + '" min="0" step="any" autocomplete="off" required />'
    + '<span class="form-error" id="asset-quantity-error" style="display:none;"></span>'
    + '</div>'

    // 幣別 + 價格
    + '<div class="form-row">'
    + '<div class="form-group">'
    + '<label class="form-label" for="asset-currency">幣別</label>'
    + '<select class="form-input" id="asset-currency" name="currency">'
    + '<option value="TWD"' + sel(currency,'TWD') + '>TWD</option>'
    + '<option value="USD"' + sel(currency,'USD') + '>USD</option>'
    + '</select></div>'
    + '<div class="form-group">'
    + '<label class="form-label" for="asset-price">每單位價格 <span class="required">*</span></label>'
    + '<input class="form-input" type="number" id="asset-price" name="asset-price-x"'
    + ' value="' + pricePerUnit + '" min="0" step="any" autocomplete="off" required />'
    + '<span class="form-error" id="asset-price-error" style="display:none;"></span>'
    + '</div></div>'

    // 按鈕
    + '<div class="modal-actions">'
    + '<button type="button" class="btn btn-secondary" id="modal-cancel">取消</button>'
    + '<button type="submit" class="btn btn-primary">儲存</button>'
    + '</div></form></div>'

    // 右側摘要
    + '<div class="asset-summary-col hidden" id="asset-summary-col">'
    + '<div class="summary-panel" id="asset-summary-panel">'
    + '<div class="summary-placeholder"><span>搜尋並選擇股票或加密貨幣<br/>即可查看詳細資訊</span></div>'
    + '</div></div></div>';

  overlay.classList.remove('hidden');

  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('asset-form').addEventListener('submit', e => {
    e.preventDefault();
    handleAssetSubmit(asset);
  });

  const typeSelect  = document.getElementById('asset-type');
  const symbolGroup = document.getElementById('symbol-group');

  function getCurrentType() { return typeSelect.value; }

  function updateSymbolGroupVisibility() {
    const t = getCurrentType();
    symbolGroup.style.display = (t === 'cash' || t === 'other') ? 'none' : '';
  }
  updateSymbolGroupVisibility();

  typeSelect.addEventListener('change', () => {
    updateSymbolGroupVisibility();
    const dd = document.getElementById('symbol-dropdown');
    if (dd) { dd.innerHTML = ''; dd.classList.add('hidden'); }
    hideSummaryCol();
    initSearchDropdown(getCurrentType(), handleSearchSelect);
  });

  initSearchDropdown(type, handleSearchSelect);

  // 編輯模式：自動載入摘要
  if (isEdit && symbol && (type === 'tw_stock' || type === 'crypto')) {
    showSummaryCol();
    const coinId = type === 'crypto' ? getCoinIdFromSymbol(symbol) : '';
    loadAndRenderSummary({ symbol, coinId, assetType: type });
  }
}

function showSummaryCol() {
  const col = document.getElementById('asset-summary-col');
  if (col) col.classList.remove('hidden');
  modalEl.classList.add('modal--wide');
}

function hideSummaryCol() {
  const col = document.getElementById('asset-summary-col');
  if (col) col.classList.add('hidden');
  modalEl.classList.remove('modal--wide');
}

function getCoinIdFromSymbol(symbol) {
  const map = {
    'BTC':'bitcoin','ETH':'ethereum','USDT':'tether','USDC':'usd-coin',
    'BNB':'binancecoin','SOL':'solana','XRP':'ripple','ADA':'cardano',
    'AVAX':'avalanche-2','DOGE':'dogecoin','DOT':'polkadot','LINK':'chainlink',
    'MATIC':'matic-network','UNI':'uniswap','LTC':'litecoin','DAI':'dai',
    'SHIB':'shiba-inu','TRX':'tron','XLM':'stellar','XMR':'monero',
  };
  return map[symbol?.toUpperCase()] || symbol?.toLowerCase() || '';
}

function handleSearchSelect({ symbol, name, coinId, assetType }) {
  showSummaryCol();
  loadAndRenderSummary({ symbol, coinId, assetType });
}

function handleAssetSubmit(existingAsset) {
  clearFieldError('asset-name-error');
  clearFieldError('asset-quantity-error');
  clearFieldError('asset-price-error');

  const nameVal     = document.getElementById('asset-name').value.trim();
  const symbolVal   = document.getElementById('asset-symbol')?.value.trim() || '';
  const categoryVal = document.getElementById('asset-category').value;
  const typeVal     = document.getElementById('asset-type').value;
  const quantityVal = parseFloat(document.getElementById('asset-quantity').value);
  const currencyVal = document.getElementById('asset-currency').value;
  const priceVal    = parseFloat(document.getElementById('asset-price').value);

  let hasError = false;
  if (!nameVal)                    { showFieldError('asset-name-error',     '請輸入資產名稱');   hasError = true; }
  if (!validateQuantity(quantityVal)) { showFieldError('asset-quantity-error', '數量必須為正數');   hasError = true; }
  if (!validatePrice(priceVal))    { showFieldError('asset-price-error',    '每單位價格必須為正數'); hasError = true; }
  if (hasError) return;

  if (existingAsset) {
    state.updateAsset(existingAsset.id, {
      name: nameVal, symbol: symbolVal, category: categoryVal,
      type: typeVal, quantity: quantityVal, currency: currencyVal, pricePerUnit: priceVal,
    });
  } else {
    state.addAsset({
      id: generateUUID(), name: nameVal, symbol: symbolVal, category: categoryVal,
      type: typeVal, quantity: quantityVal, currency: currencyVal, pricePerUnit: priceVal,
      priceSource: 'manual', lastPriceUpdate: null,
    });
  }
  closeModal();
}

// ─── 負債 Modal ───────────────────────────────────────────────────────────────

export function openLiabilityModal(liability = null) {
  const isEdit   = liability !== null;
  modalTitle.textContent = isEdit ? '編輯負債' : '新增負債';

  const name     = isEdit ? liability.name : '';
  const category = isEdit ? liability.category : 'credit';
  const amount   = isEdit ? liability.amount : '';
  const currency = isEdit ? liability.currency : 'TWD';

  const sel = (val, opt) => val === opt ? ' selected' : '';

  modalBody.innerHTML =
    '<form id="liability-form" novalidate autocomplete="off">'
    + '<div class="form-group">'
    + '<label class="form-label" for="liability-name">名稱 <span class="required">*</span></label>'
    + '<input class="form-input" type="text" id="liability-name" name="name"'
    + ' value="' + esc(name) + '" required />'
    + '<span class="form-error" id="liability-name-error" style="display:none;"></span>'
    + '</div>'
    + '<div class="form-group">'
    + '<label class="form-label" for="liability-category">分類 <span class="required">*</span></label>'
    + '<select class="form-input" id="liability-category" name="category">'
    + '<option value="credit"'   + sel(category,'credit')   + '>信貸</option>'
    + '<option value="pledge"'   + sel(category,'pledge')   + '>質押借款</option>'
    + '<option value="mortgage"' + sel(category,'mortgage') + '>理財型房貸</option>'
    + '<option value="other"'    + sel(category,'other')    + '>其他</option>'
    + '</select></div>'
    + '<div class="form-row">'
    + '<div class="form-group">'
    + '<label class="form-label" for="liability-currency">幣別</label>'
    + '<select class="form-input" id="liability-currency" name="currency">'
    + '<option value="TWD"' + sel(currency,'TWD') + '>TWD</option>'
    + '<option value="USD"' + sel(currency,'USD') + '>USD</option>'
    + '</select></div>'
    + '<div class="form-group">'
    + '<label class="form-label" for="liability-amount">金額 <span class="required">*</span></label>'
    + '<input class="form-input" type="number" id="liability-amount" name="amount"'
    + ' value="' + amount + '" min="0" step="any" required />'
    + '<span class="form-error" id="liability-amount-error" style="display:none;"></span>'
    + '</div></div>'
    + '<div class="modal-actions">'
    + '<button type="button" class="btn btn-secondary" id="modal-cancel">取消</button>'
    + '<button type="submit" class="btn btn-primary">儲存</button>'
    + '</div></form>';

  overlay.classList.remove('hidden');
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('liability-form').addEventListener('submit', e => {
    e.preventDefault();
    handleLiabilitySubmit(liability);
  });
}

function handleLiabilitySubmit(existingLiability) {
  clearFieldError('liability-name-error');
  clearFieldError('liability-amount-error');

  const nameVal     = document.getElementById('liability-name').value.trim();
  const categoryVal = document.getElementById('liability-category').value;
  const amountVal   = parseFloat(document.getElementById('liability-amount').value);
  const currencyVal = document.getElementById('liability-currency').value;

  let hasError = false;
  if (!nameVal)               { showFieldError('liability-name-error',   '請輸入負債名稱'); hasError = true; }
  if (!validateAmount(amountVal)) { showFieldError('liability-amount-error', '金額必須為正數'); hasError = true; }
  if (hasError) return;

  if (existingLiability) {
    state.updateLiability(existingLiability.id, {
      name: nameVal, category: categoryVal, amount: amountVal, currency: currencyVal,
    });
  } else {
    state.addLiability({
      id: generateUUID(), name: nameVal, category: categoryVal,
      amount: amountVal, currency: currencyVal,
    });
  }
  closeModal();
}

// ─── 全域事件 ─────────────────────────────────────────────────────────────────

modalClose.addEventListener('click', closeModal);

overlay.addEventListener('click', e => {
  if (!e.target.closest('#modal')) closeModal();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !overlay.classList.contains('hidden')) closeModal();
});
