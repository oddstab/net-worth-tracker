/**
 * googleSheets.js — Google Sheets 整合服務
 *
 * 從原有 js/services/googleSheetsService.js 遷移至 SvelteKit 架構。
 * 提供資產數據與 Google Sheets 的雙向同步功能。
 *
 * 功能：
 * - Google API 金鑰與 OAuth 客戶端 ID 設定介面
 * - Google 帳戶登入/登出
 * - 同步到 Google Sheets / 從 Google Sheets 載入 / 創建新表格
 * - 在 Google Sheets 中建立「資產清單」與「歷史記錄」兩個工作表
 *
 * Google APIs (gapi) 透過 CDN 動態載入。
 */

import { writable, get } from 'svelte/store';

// ─── 響應式狀態 ──────────────────────────────────────────────────────────────

/** 是否已登入 Google 帳戶 */
export const isSignedIn = writable(false);

/** 是否已完成 Google API 初始化 */
export const isInitialized = writable(false);

/** 當前登入的使用者資訊 */
export const currentUser = writable(null);

// ─── 內部狀態 ─────────────────────────────────────────────────────────────────

/** Google API 配置 */
const DISCOVERY_DOC = 'https://sheets.googleapis.com/$discovery/rest?version=v4';
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';

/** localStorage key */
const STORAGE_KEYS = {
  CLIENT_ID: 'google_client_id',
  API_KEY: 'google_api_key',
  SPREADSHEET_ID: 'google_spreadsheet_id',
};

/** 內部憑證快取 */
let _clientId = '';
let _apiKey = '';
let _spreadsheetId = null;

// ─── 憑證管理 ─────────────────────────────────────────────────────────────────

/**
 * 設定 Google API 金鑰與 OAuth 客戶端 ID。
 * 同時保存至 localStorage。
 * @param {string} clientId — OAuth 2.0 客戶端 ID
 * @param {string} apiKey — Google API 金鑰
 */
export function setCredentials(clientId, apiKey) {
  _clientId = clientId;
  _apiKey = apiKey;
  localStorage.setItem(STORAGE_KEYS.CLIENT_ID, clientId);
  localStorage.setItem(STORAGE_KEYS.API_KEY, apiKey);
}

/**
 * 從 localStorage 載入已儲存的憑證。
 */
export function loadCredentials() {
  _clientId = localStorage.getItem(STORAGE_KEYS.CLIENT_ID) || '';
  _apiKey = localStorage.getItem(STORAGE_KEYS.API_KEY) || '';
  _spreadsheetId = localStorage.getItem(STORAGE_KEYS.SPREADSHEET_ID) || null;
}

/**
 * 取得目前的 API 金鑰。
 * @returns {string}
 */
export function getApiKey() {
  return _apiKey;
}

/**
 * 取得目前的客戶端 ID。
 * @returns {string}
 */
export function getClientId() {
  return _clientId;
}

/**
 * 取得目前的 Spreadsheet ID。
 * @returns {string|null}
 */
export function getSpreadsheetId() {
  return _spreadsheetId;
}

/**
 * 保存 Spreadsheet ID 至 localStorage。
 * @param {string} spreadsheetId
 */
export function saveSpreadsheetId(spreadsheetId) {
  _spreadsheetId = spreadsheetId;
  localStorage.setItem(STORAGE_KEYS.SPREADSHEET_ID, spreadsheetId);
}

// ─── Google API 載入與初始化 ──────────────────────────────────────────────────

/**
 * 動態載入 Google API 腳本（CDN）。
 * 若已載入則直接 resolve。
 * @returns {Promise<void>}
 */
function loadGoogleAPI() {
  return new Promise((resolve, reject) => {
    if (typeof window !== 'undefined' && window.gapi) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.onload = resolve;
    script.onerror = () => reject(new Error('Google API 腳本載入失敗'));
    document.head.appendChild(script);
  });
}

/**
 * 初始化 Google API（載入 gapi 並設定 OAuth）。
 * @returns {Promise<boolean>} 是否初始化成功
 */
export async function initialize() {
  try {
    await loadGoogleAPI();

    await new Promise((resolve, reject) => {
      window.gapi.load('client:auth2', async () => {
        try {
          await window.gapi.client.init({
            apiKey: _apiKey,
            clientId: _clientId,
            discoveryDocs: [DISCOVERY_DOC],
            scope: SCOPES,
          });
          resolve();
        } catch (err) {
          reject(err);
        }
      });
    });

    /* 取得初始登入狀態 */
    const authInstance = window.gapi.auth2.getAuthInstance();
    const signedIn = authInstance.isSignedIn.get();
    isSignedIn.set(signedIn);
    isInitialized.set(true);

    if (signedIn) {
      _updateCurrentUser();
    }

    /* 監聽登入狀態變化 */
    authInstance.isSignedIn.listen((status) => {
      isSignedIn.set(status);
      if (status) {
        _updateCurrentUser();
      } else {
        currentUser.set(null);
      }
    });

    return true;
  } catch (error) {
    console.error('Google API 初始化失敗:', error);
    isInitialized.set(false);
    return false;
  }
}

/**
 * 更新當前使用者資訊至 store。
 * @private
 */
function _updateCurrentUser() {
  try {
    const user = window.gapi.auth2.getAuthInstance().currentUser.get();
    const profile = user.getBasicProfile();
    currentUser.set({
      id: profile.getId(),
      name: profile.getName(),
      email: profile.getEmail(),
      imageUrl: profile.getImageUrl(),
    });
  } catch {
    currentUser.set(null);
  }
}

// ─── 登入 / 登出 ──────────────────────────────────────────────────────────────

/**
 * Google 帳戶登入。
 * @returns {Promise<boolean>} 是否登入成功
 * @throws {Error} 若 Google API 未初始化
 */
export async function signIn() {
  if (!get(isInitialized) || !window.gapi) {
    throw new Error('Google API 未初始化');
  }

  try {
    await window.gapi.auth2.getAuthInstance().signIn();
    return true;
  } catch (error) {
    console.error('Google 登入失敗:', error);
    throw error;
  }
}

/**
 * Google 帳戶登出。
 */
export async function signOut() {
  if (!window.gapi) return;

  try {
    await window.gapi.auth2.getAuthInstance().signOut();
    _spreadsheetId = null;
  } catch (error) {
    console.error('Google 登出失敗:', error);
  }
}

// ─── Google Sheets 操作 ───────────────────────────────────────────────────────

/**
 * 創建新的 Google Sheets，包含「資產清單」與「歷史記錄」兩個工作表。
 * @param {string} [title='Net Worth Tracker'] — 表格標題
 * @returns {Promise<{spreadsheetId: string, url: string}>}
 * @throws {Error} 若未登入
 */
export async function createSpreadsheet(title = 'Net Worth Tracker') {
  if (!get(isSignedIn)) {
    throw new Error('請先登入 Google 帳戶');
  }

  try {
    const response = await window.gapi.client.sheets.spreadsheets.create({
      properties: { title },
      sheets: [
        {
          properties: {
            title: '資產清單',
            gridProperties: { rowCount: 1000, columnCount: 10 },
          },
        },
        {
          properties: {
            title: '歷史記錄',
            gridProperties: { rowCount: 1000, columnCount: 5 },
          },
        },
      ],
    });

    const spreadsheetId = response.result.spreadsheetId;
    saveSpreadsheetId(spreadsheetId);

    /* 設置表頭 */
    await _setupHeaders(spreadsheetId);

    return {
      spreadsheetId,
      url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    };
  } catch (error) {
    console.error('創建 Google Sheets 失敗:', error);
    throw error;
  }
}

/**
 * 設置表格標題行。
 * @param {string} spreadsheetId
 * @private
 */
async function _setupHeaders(spreadsheetId) {
  const assetHeaders = [
    ['資產名稱', '類別', '數量', '單價 (TWD)', '總值 (TWD)', '更新時間', '備註'],
  ];

  const historyHeaders = [
    ['日期', '總資產', '總負債', '淨資產', '備註'],
  ];

  try {
    await window.gapi.client.sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      resource: {
        valueInputOption: 'RAW',
        data: [
          { range: '資產清單!A1:G1', values: assetHeaders },
          { range: '歷史記錄!A1:E1', values: historyHeaders },
        ],
      },
    });

    /* 格式化標題行（紫色背景、白色粗體文字） */
    await _formatHeaders(spreadsheetId);
  } catch (error) {
    console.error('設置表頭失敗:', error);
    throw error;
  }
}

/**
 * 格式化標題行樣式。
 * @param {string} spreadsheetId
 * @private
 */
async function _formatHeaders(spreadsheetId) {
  try {
    const headerFormat = {
      userEnteredFormat: {
        backgroundColor: { red: 0.85, green: 0.27, blue: 0.94 },
        textFormat: {
          foregroundColor: { red: 1, green: 1, blue: 1 },
          bold: true,
        },
      },
    };

    await window.gapi.client.sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: [
          {
            repeatCell: {
              range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1 },
              cell: headerFormat,
              fields: 'userEnteredFormat(backgroundColor,textFormat)',
            },
          },
          {
            repeatCell: {
              range: { sheetId: 1, startRowIndex: 0, endRowIndex: 1 },
              cell: headerFormat,
              fields: 'userEnteredFormat(backgroundColor,textFormat)',
            },
          },
        ],
      },
    });
  } catch (error) {
    console.error('格式化標題失敗:', error);
  }
}

/**
 * 同步資產數據到 Google Sheets。
 * @param {Array} assets — 資產陣列
 * @returns {Promise<boolean>}
 * @throws {Error} 若未登入或未設定 Spreadsheet
 */
export async function syncAssetsToSheets(assets) {
  if (!get(isSignedIn) || !_spreadsheetId) {
    throw new Error('請先登入並設置 Google Sheets');
  }

  try {
    /* 準備數據 */
    const values = assets.map(asset => [
      asset.name,
      asset.category,
      asset.quantity || 1,
      asset.price || asset.pricePerUnit || 0,
      asset.totalTWD || 0,
      asset.lastPriceUpdate
        ? new Date(asset.lastPriceUpdate).toLocaleString('zh-TW')
        : '',
      asset.notes || '',
    ]);

    /* 清除現有數據（保留標題） */
    await window.gapi.client.sheets.spreadsheets.values.clear({
      spreadsheetId: _spreadsheetId,
      range: '資產清單!A2:G1000',
    });

    /* 寫入新數據 */
    if (values.length > 0) {
      await window.gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId: _spreadsheetId,
        range: `資產清單!A2:G${values.length + 1}`,
        valueInputOption: 'RAW',
        resource: { values },
      });
    }

    return true;
  } catch (error) {
    console.error('同步資產到 Google Sheets 失敗:', error);
    throw error;
  }
}

/**
 * 從 Google Sheets 讀取資產數據。
 * @returns {Promise<Array>} 資產陣列
 * @throws {Error} 若未登入或未設定 Spreadsheet
 */
export async function loadAssetsFromSheets() {
  if (!get(isSignedIn) || !_spreadsheetId) {
    throw new Error('請先登入並設置 Google Sheets');
  }

  try {
    const response = await window.gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: _spreadsheetId,
      range: '資產清單!A2:G1000',
    });

    const rows = response.result.values || [];
    const assets = rows
      .filter(row => row[0]) // 過濾空行
      .map((row, index) => ({
        id: `sheet_${index}`,
        name: row[0] || '',
        category: row[1] || 'other',
        quantity: parseFloat(row[2]) || 1,
        price: parseFloat(row[3]) || 0,
        pricePerUnit: parseFloat(row[3]) || 0,
        totalTWD: parseFloat(row[4]) || 0,
        lastPriceUpdate: row[5] ? new Date(row[5]).toISOString() : null,
        notes: row[6] || '',
      }));

    return assets;
  } catch (error) {
    console.error('從 Google Sheets 讀取資產失敗:', error);
    throw error;
  }
}

/**
 * 記錄淨資產歷史至「歷史記錄」工作表。
 * @param {number} totalAssets — 總資產
 * @param {number} totalDebt — 總負債
 * @param {number} netWorth — 淨資產
 * @param {string} [notes=''] — 備註
 * @returns {Promise<boolean>}
 */
export async function recordNetWorthHistory(totalAssets, totalDebt, netWorth, notes = '') {
  if (!get(isSignedIn) || !_spreadsheetId) {
    return false;
  }

  try {
    const values = [[
      new Date().toLocaleDateString('zh-TW'),
      totalAssets,
      totalDebt,
      netWorth,
      notes,
    ]];

    await window.gapi.client.sheets.spreadsheets.values.append({
      spreadsheetId: _spreadsheetId,
      range: '歷史記錄!A:E',
      valueInputOption: 'RAW',
      resource: { values },
    });

    return true;
  } catch (error) {
    console.error('記錄歷史失敗:', error);
    return false;
  }
}
