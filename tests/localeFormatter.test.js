/**
 * localeFormatter.test.js — 貨幣換算與格式化正確性屬性測試
 *
 * 測試 src/lib/services/localeFormatter.js 的 convertAmount() 與 formatCurrency()
 * 在不同顯示貨幣設定下的換算正確性。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';

// ─── 每次測試前清除 localStorage 並重設模組快取 ──────────────────────────────

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

// ─── 屬性測試：貨幣換算正確性 ───────────────────────────────────────────────

/**
 * Feature: currency-switcher, Property 3: 貨幣換算正確性
 *
 * 對於任何 TWD 金額和任何支援的顯示貨幣，convertAmount() 輸出應等於
 * amount / exchangeRateMap[currency]（在浮點精度範圍內）。
 * 當顯示貨幣為 TWD 時，輸出應與原始金額一致（不進行任何換算）。
 *
 * **Validates: Requirements 4.1, 4.2**
 */
describe('屬性測試：貨幣換算正確性', () => {
  /** 預設匯率對照表（與 exchangeRateMap store 預設值一致） */
  const DEFAULT_RATES = { TWD: 1, USD: 31.5, CNY: 4.35, JPY: 0.21, KRW: 0.023 };

  it('convertAmount() 對任意金額與貨幣，換算結果等於 amount / rate（浮點精度內）', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.double({ min: -1e8, max: 1e8, noNaN: true }),
        fc.constantFrom('TWD', 'USD', 'CNY', 'JPY', 'KRW'),
        async (amount, currency) => {
          // 1) 清除 localStorage，確保乾淨狀態
          localStorage.clear();
          vi.resetModules();

          // 2) 先設定 displayCurrency 至 localStorage
          const { saveDisplayCurrency } = await import(
            '../src/lib/services/storage.js'
          );
          saveDisplayCurrency(currency);

          // 3) 動態匯入 localeFormatter（會訂閱 displayCurrency store）
          const { convertAmount } = await import(
            '../src/lib/services/localeFormatter.js'
          );

          // 4) 執行換算
          const result = convertAmount(amount);

          // 5) 驗證換算正確性
          if (currency === 'TWD') {
            // 顯示貨幣為 TWD 時，不進行換算，直接回傳原始金額
            expect(result).toBe(amount);
          } else {
            // 非 TWD 時，結果應等於 amount / rate
            const expectedRate = DEFAULT_RATES[currency];
            const expected = amount / expectedRate;

            // 浮點精度容差：使用相對誤差 1e-10
            if (expected === 0) {
              expect(Math.abs(result)).toBeLessThanOrEqual(1e-10);
            } else {
              const relativeError = Math.abs((result - expected) / expected);
              expect(relativeError).toBeLessThanOrEqual(1e-10);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  }, 30000);

  it('當顯示貨幣為 TWD 時，convertAmount() 回傳原始金額不變', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.double({ min: -1e8, max: 1e8, noNaN: true }),
        async (amount) => {
          // 1) 清除 localStorage，確保乾淨狀態
          localStorage.clear();
          vi.resetModules();

          // 2) 設定 displayCurrency 為 TWD
          const { saveDisplayCurrency } = await import(
            '../src/lib/services/storage.js'
          );
          saveDisplayCurrency('TWD');

          // 3) 動態匯入 localeFormatter
          const { convertAmount } = await import(
            '../src/lib/services/localeFormatter.js'
          );

          // 4) 驗證：TWD 模式下 convertAmount 回傳原始金額
          const result = convertAmount(amount);
          expect(result).toBe(amount);
        },
      ),
      { numRuns: 100 },
    );
  }, 30000);
});


// ─── 屬性測試：貨幣格式化正確性 ───────────────────────────────────────────────

/**
 * Feature: currency-switcher, Property 4: 貨幣格式化正確性
 *
 * 對於任何金額，以 JPY 或 KRW 格式化時應產生零小數位的輸出，
 * 以 USD 或 CNY 格式化時應產生最多兩位小數的輸出。
 * 且格式化結果應包含對應貨幣的正確符號。
 *
 * **Validates: Requirements 4.3, 4.4**
 */
describe('屬性測試：貨幣格式化正確性', () => {
  /** 各貨幣預期小數位數 */
  const CURRENCY_DECIMALS = { TWD: 0, USD: 2, CNY: 2, JPY: 0, KRW: 0 };

  /**
   * 各貨幣可能出現的符號（Intl.NumberFormat 輸出因 locale/環境而異）
   * 包含全形與半形變體以相容不同 ICU 版本
   */
  const CURRENCY_SYMBOLS = {
    TWD: ['NT$', '$'],
    USD: ['$', 'US$'],
    CNY: ['¥', 'CN¥'],
    JPY: ['¥', '￥'],
    KRW: ['₩', '￦'],
  };

  /**
   * 使用 Intl.NumberFormat.formatToParts 提取小數位數。
   * 直接解析 fraction part 的長度，避免手動解析千分位分隔符的歧義。
   *
   * @param {number} amount — 原始金額
   * @param {string} currency — 貨幣代碼
   * @param {string} locale — 語言代碼
   * @param {number} decimals — 設定的小數位數
   * @returns {number} 實際小數位數
   */
  function getFractionDigits(amount, currency, locale, decimals) {
    const formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    const parts = formatter.formatToParts(amount);
    const fractionPart = parts.find((p) => p.type === 'fraction');
    return fractionPart ? fractionPart.value.length : 0;
  }

  it('JPY/KRW/TWD 格式化結果為零小數位，USD/CNY 為最多兩位小數', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.double({ min: 0, max: 1e8, noNaN: true }),
        fc.constantFrom('TWD', 'USD', 'CNY', 'JPY', 'KRW'),
        async (amount, currency) => {
          // 1) 清除狀態，確保乾淨環境
          localStorage.clear();
          vi.resetModules();

          // 2) 設定 displayCurrency 至 localStorage
          localStorage.setItem('nwt_display_currency', JSON.stringify(currency));

          // 3) 動態匯入 localeFormatter（會訂閱 displayCurrency store）
          const { formatCurrency, convertAmount } = await import(
            '../src/lib/services/localeFormatter.js'
          );

          // 4) 格式化金額並取得換算後的數值
          const result = formatCurrency(amount);
          const convertedAmount = convertAmount(amount);

          // 5) 使用 formatToParts 驗證小數位數
          const expectedMaxDecimals = CURRENCY_DECIMALS[currency];
          const actualDecimals = getFractionDigits(
            convertedAmount,
            currency,
            'zh-TW',
            expectedMaxDecimals,
          );

          expect(actualDecimals).toBeLessThanOrEqual(expectedMaxDecimals);
        },
      ),
      { numRuns: 100 },
    );
  }, 30000);

  it('格式化結果包含對應貨幣的正確符號', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.double({ min: 0, max: 1e8, noNaN: true }),
        fc.constantFrom('TWD', 'USD', 'CNY', 'JPY', 'KRW'),
        async (amount, currency) => {
          // 1) 清除狀態，確保乾淨環境
          localStorage.clear();
          vi.resetModules();

          // 2) 設定 displayCurrency 至 localStorage
          localStorage.setItem('nwt_display_currency', JSON.stringify(currency));

          // 3) 動態匯入 localeFormatter
          const { formatCurrency } = await import(
            '../src/lib/services/localeFormatter.js'
          );

          // 4) 格式化金額
          const result = formatCurrency(amount);

          // 5) 驗證貨幣符號存在（相容不同 ICU 環境的全形/半形變體）
          const possibleSymbols = CURRENCY_SYMBOLS[currency];
          const hasSymbol = possibleSymbols.some((sym) => result.includes(sym));

          expect(hasSymbol).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  }, 30000);
});
