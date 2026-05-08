/**
 * exportFormats.js — 多格式匯出工具
 *
 * 提供 CSV、Excel（TSV）、TXT 三種匯出格式。
 * 資料來源為 storage.js 的同步讀取函式。
 */

import { loadAssets, loadLiabilities, loadSnapshots, loadExchangeRate } from '$lib/services/storage.js';

// ─── 輔助函式 ────────────────────────────────────────────────────────────────

/**
 * 將值轉為 CSV 安全字串（含逗號或引號時加雙引號包裹）。
 * @param {*} value
 * @returns {string}
 */
function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * 取得今日日期字串 YYYY-MM-DD。
 * @returns {string}
 */
function today() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * 觸發瀏覽器下載。
 * @param {string} content — 檔案內容
 * @param {string} filename — 檔名
 * @param {string} mimeType — MIME 類型
 */
function triggerDownload(content, filename, mimeType) {
  const BOM = '\uFEFF'; // UTF-8 BOM，確保 Excel 正確辨識中文
  const blob = new Blob([BOM + content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── 資料整理 ────────────────────────────────────────────────────────────────

/**
 * 取得資產表格資料（欄位名 + 資料列）。
 * @returns {{ headers: string[], rows: Array<string[]> }}
 */
function getAssetTable() {
  const assets = loadAssets();
  const headers = ['名稱', '類型', '代號', '數量', '單價', '市值(TWD)', '幣別', '最後更新'];
  const rows = assets.map(a => [
    a.name || '',
    a.type || '',
    a.symbol || '',
    a.quantity ?? '',
    a.pricePerUnit ?? '',
    a.quantity && a.pricePerUnit ? String(Math.round(a.quantity * a.pricePerUnit)) : '',
    a.currency || 'TWD',
    a.lastPriceUpdate || '',
  ]);
  return { headers, rows };
}

/**
 * 取得負債表格資料。
 * @returns {{ headers: string[], rows: Array<string[]> }}
 */
function getLiabilityTable() {
  const liabilities = loadLiabilities();
  const headers = ['名稱', '類型', '金額(TWD)', '年利率(%)', '期數(月)', '起始日期'];
  const rows = liabilities.map(l => [
    l.name || '',
    l.category || '',
    l.amount ?? '',
    l.interestRate ?? '',
    l.terms ?? '',
    l.startDate || '',
  ]);
  return { headers, rows };
}

/**
 * 取得快照表格資料。
 * @returns {{ headers: string[], rows: Array<string[]> }}
 */
function getSnapshotTable() {
  const snapshots = loadSnapshots();
  const headers = ['日期', '淨資產(TWD)'];
  const rows = snapshots
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(s => [s.date, String(s.netWorth)]);
  return { headers, rows };
}

// ─── CSV 匯出 ────────────────────────────────────────────────────────────────

/**
 * 將表格資料轉為 CSV 字串。
 * @param {{ headers: string[], rows: Array<string[]> }} table
 * @returns {string}
 */
function tableToCSV(table) {
  const lines = [
    table.headers.map(csvEscape).join(','),
    ...table.rows.map(row => row.map(csvEscape).join(',')),
  ];
  return lines.join('\n');
}

/**
 * 匯出所有資料為 CSV 格式（多個區塊以空行分隔）。
 */
export function exportCSV() {
  const assetTable = getAssetTable();
  const liabilityTable = getLiabilityTable();
  const snapshotTable = getSnapshotTable();

  const sections = [
    `# 資產（${assetTable.rows.length} 筆）`,
    tableToCSV(assetTable),
    '',
    `# 負債（${liabilityTable.rows.length} 筆）`,
    tableToCSV(liabilityTable),
    '',
    `# 淨資產快照（${snapshotTable.rows.length} 筆）`,
    tableToCSV(snapshotTable),
  ];

  const content = sections.join('\n');
  triggerDownload(content, `net-worth-tracker-${today()}.csv`, 'text/csv');
}

// ─── Excel (TSV) 匯出 ───────────────────────────────────────────────────────

/**
 * 將表格資料轉為 TSV 字串（Tab 分隔，Excel 可直接開啟）。
 * @param {{ headers: string[], rows: Array<string[]> }} table
 * @returns {string}
 */
function tableToTSV(table) {
  const lines = [
    table.headers.join('\t'),
    ...table.rows.map(row => row.join('\t')),
  ];
  return lines.join('\n');
}

/**
 * 匯出所有資料為 Excel 可開啟的 TSV 格式。
 * 使用 .xls 副檔名讓 Excel 自動以試算表模式開啟。
 */
export function exportExcel() {
  const assetTable = getAssetTable();
  const liabilityTable = getLiabilityTable();
  const snapshotTable = getSnapshotTable();

  const sections = [
    '【資產】',
    tableToTSV(assetTable),
    '',
    '【負債】',
    tableToTSV(liabilityTable),
    '',
    '【淨資產快照】',
    tableToTSV(snapshotTable),
  ];

  const content = sections.join('\n');
  triggerDownload(content, `net-worth-tracker-${today()}.xls`, 'application/vnd.ms-excel');
}

// ─── TXT 匯出 ────────────────────────────────────────────────────────────────

/**
 * 將表格資料轉為對齊的純文字表格。
 * @param {{ headers: string[], rows: Array<string[]> }} table
 * @returns {string}
 */
function tableToText(table) {
  const allRows = [table.headers, ...table.rows];

  // 計算每欄最大寬度（考慮中文字元佔 2 格）
  const colWidths = table.headers.map((_, colIdx) => {
    return Math.max(...allRows.map(row => {
      const cell = row[colIdx] ?? '';
      // 簡易中文寬度估算：每個非 ASCII 字元算 2 格
      return [...cell].reduce((w, ch) => w + (ch.charCodeAt(0) > 127 ? 2 : 1), 0);
    }));
  });

  /**
   * 將一列格式化為對齊字串。
   * @param {string[]} row
   * @returns {string}
   */
  function formatRow(row) {
    return row.map((cell, i) => {
      const cellStr = cell ?? '';
      const displayWidth = [...cellStr].reduce((w, ch) => w + (ch.charCodeAt(0) > 127 ? 2 : 1), 0);
      const padding = colWidths[i] - displayWidth;
      return cellStr + ' '.repeat(Math.max(0, padding));
    }).join('  ');
  }

  const separator = colWidths.map(w => '-'.repeat(w)).join('--');

  return [
    formatRow(table.headers),
    separator,
    ...table.rows.map(formatRow),
  ].join('\n');
}

/**
 * 匯出所有資料為純文字格式（人類可讀）。
 */
export function exportTxt() {
  const assetTable = getAssetTable();
  const liabilityTable = getLiabilityTable();
  const snapshotTable = getSnapshotTable();
  const rate = loadExchangeRate();

  const header = [
    '═══════════════════════════════════════════════════════',
    '  Net Worth Tracker — 資料匯出',
    `  匯出日期：${today()}`,
    `  USD/TWD 匯率：${rate}`,
    '═══════════════════════════════════════════════════════',
  ].join('\n');

  const sections = [
    header,
    '',
    `▌ 資產（${assetTable.rows.length} 筆）`,
    tableToText(assetTable),
    '',
    `▌ 負債（${liabilityTable.rows.length} 筆）`,
    liabilityTable.rows.length > 0 ? tableToText(liabilityTable) : '  （無負債資料）',
    '',
    `▌ 淨資產快照（${snapshotTable.rows.length} 筆）`,
    snapshotTable.rows.length > 0 ? tableToText(snapshotTable) : '  （無快照資料）',
  ];

  const content = sections.join('\n');
  triggerDownload(content, `net-worth-tracker-${today()}.txt`, 'text/plain');
}
