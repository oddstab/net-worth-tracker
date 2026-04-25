/**
 * settings.js — 設定頁
 *
 * 提供匯率設定、資料匯出與匯入功能。
 * 對應需求：3.1, 3.2, 3.3, 3.4, 3.5, 5.4, 5.5, 5.6
 */

import * as state from '../state.js';
import { validateExchangeRate } from '../calculator.js';
import { exportData, importData } from '../storage.js';

// ─── DOM 容器 ────────────────────────────────────────────────────────────────

const settingsContainer = document.getElementById('settings-container');

// ─── 渲染 ────────────────────────────────────────────────────────────────────

/**
 * 渲染設定頁 HTML。
 * @param {{ exchangeRate: number }} currentState
 */
function render(currentState) {
  const { exchangeRate } = currentState;

  settingsContainer.innerHTML = `
    <!-- 匯率設定 -->
    <section class="settings-section">
      <h2 class="settings-section-title">匯率設定</h2>
      <p style="font-size: var(--font-size-sm); color: var(--text-secondary); margin-bottom: var(--spacing-md);">
        目前匯率：<strong style="color: var(--text-primary);">1 USD = ${exchangeRate} TWD</strong>
      </p>
      <div class="settings-row">
        <input
          class="form-input"
          type="number"
          id="exchange-rate-input"
          value="${exchangeRate}"
          min="0.01"
          step="0.01"
          aria-label="USD/TWD 匯率"
          placeholder="例：31.5"
        />
        <button class="btn btn-primary" id="save-exchange-rate">儲存</button>
      </div>
      <span class="form-error" id="exchange-rate-error" style="display:none; margin-top: var(--spacing-xs);"></span>
    </section>

    <!-- 資料管理 -->
    <section class="settings-section">
      <h2 class="settings-section-title">資料管理</h2>
      <div style="display: flex; flex-direction: column; gap: var(--spacing-md);">
        <div>
          <button class="btn btn-secondary" id="export-data" style="width: 100%;">
            ⬇ 匯出資料（JSON）
          </button>
          <p style="font-size: var(--font-size-xs); color: var(--text-muted); margin-top: var(--spacing-xs);">
            將所有資產、負債與快照資料下載為 JSON 檔案
          </p>
        </div>
        <div>
          <button class="btn btn-secondary" id="import-data" style="width: 100%;">
            ⬆ 匯入資料（JSON）
          </button>
          <input type="file" id="import-file-input" accept=".json" style="display:none;" />
          <p style="font-size: var(--font-size-xs); color: var(--text-muted); margin-top: var(--spacing-xs);">
            從 JSON 檔案還原資料（將覆蓋現有資料）
          </p>
          <span class="form-error" id="import-error" style="display:none; margin-top: var(--spacing-xs);"></span>
        </div>
      </div>
    </section>

    <!-- 關於 -->
    <section class="settings-section">
      <h2 class="settings-section-title">關於</h2>
      <p style="font-size: var(--font-size-sm); color: var(--text-secondary);">
        Net Worth Tracker v1.0.0<br/>
        純前端 PWA，所有資料儲存於本地裝置，不傳送至任何伺服器。
      </p>
    </section>
  `;

  // 綁定事件
  bindEvents();
}

// ─── 事件綁定 ────────────────────────────────────────────────────────────────

function bindEvents() {
  // 儲存匯率
  document.getElementById('save-exchange-rate').addEventListener('click', handleSaveExchangeRate);

  // 匯出資料
  document.getElementById('export-data').addEventListener('click', handleExportData);

  // 匯入資料（按鈕觸發 file input）
  document.getElementById('import-data').addEventListener('click', () => {
    document.getElementById('import-file-input').click();
  });

  // 檔案選擇後讀取
  document.getElementById('import-file-input').addEventListener('change', handleImportData);
}

// ─── 匯率儲存 ────────────────────────────────────────────────────────────────

function handleSaveExchangeRate() {
  const input = document.getElementById('exchange-rate-input');
  const errorEl = document.getElementById('exchange-rate-error');
  const rate = parseFloat(input.value);

  // 清除舊錯誤
  errorEl.style.display = 'none';
  errorEl.textContent = '';

  if (!validateExchangeRate(rate)) {
    errorEl.textContent = '匯率必須為正數';
    errorEl.style.display = 'block';
    return;
  }

  state.setExchangeRate(rate);
  showToast('匯率已更新', 'success');
}

// ─── 匯出資料 ────────────────────────────────────────────────────────────────

function handleExportData() {
  const currentState = state.getState();
  const jsonString = exportData(currentState);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `net-worth-tracker-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast('資料已匯出', 'success');
}

// ─── 匯入資料 ────────────────────────────────────────────────────────────────

function handleImportData(event) {
  const file = event.target.files[0];
  if (!file) return;

  const errorEl = document.getElementById('import-error');
  errorEl.style.display = 'none';
  errorEl.textContent = '';

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = importData(e.target.result);
      // 更新 state（重新載入所有資料）
      state.setState({
        assets: parsed.assets,
        liabilities: parsed.liabilities,
        exchangeRate: parsed.exchangeRate,
        snapshots: parsed.snapshots,
      });
      showToast('資料已匯入', 'success');
      // 重新渲染設定頁以顯示新匯率
      render(state.getState());
    } catch (err) {
      errorEl.textContent = err.message || '匯入失敗：格式不符';
      errorEl.style.display = 'block';
      showToast('匯入失敗', 'error');
    }
  };
  reader.readAsText(file);

  // 清除 file input，允許重複選同一檔案
  event.target.value = '';
}

// ─── Toast 通知 ──────────────────────────────────────────────────────────────

/**
 * 顯示短暫的 Toast 通知。
 * @param {string} message
 * @param {'success' | 'error'} [type='success']
 */
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;

  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.classList.remove('hidden');

  setTimeout(() => {
    toast.classList.add('hidden');
  }, 2500);
}

// ─── 初始化 ──────────────────────────────────────────────────────────────────

/**
 * 初始化設定頁：渲染 HTML 並訂閱狀態變更。
 */
export function initSettings() {
  // 初始渲染
  render(state.getState());

  // 訂閱匯率變更，重新渲染設定頁
  state.subscribe((currentState) => {
    // 只在設定頁可見時重新渲染，避免覆蓋使用者正在輸入的內容
    const settingsPage = document.getElementById('page-settings');
    if (settingsPage && !settingsPage.classList.contains('hidden')) {
      render(currentState);
    }
  });
}
