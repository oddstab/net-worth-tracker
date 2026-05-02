/**
 * displayCurrency.test.js — 顯示貨幣 store 單元測試
 *
 * 測試 src/lib/stores/displayCurrency.js 的常數匯出、
 * store 初始化、持久化行為與無效值回退邏輯。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import {
  saveDisplayCurrency,
  loadDisplayCurrency,
} from '../src/lib/services/storage.js';

// ─── 每次測試前清除 localStorage 並重設模組快取 ──────────────────────────────

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

// ─── 常數匯出 ────────────────────────────────────────────────────────────────

describe('displayCurrency 常數匯出', () => {
  it('SUPPORTED_CURRENCIES 包含五個貨幣代碼', async () => {
    const { SUPPORTED_CURRENCIES } = await import(
      '../src/lib/stores/displayCurrency.js'
    );
    expect(SUPPORTED_CURRENCIES).toEqual(['TWD', 'USD', 'CNY', 'JPY', 'KRW']);
  });

  it('CURRENCY_NAMES 包含所有支援貨幣的中文名稱', async () => {
    const { CURRENCY_NAMES } = await import(
      '../src/lib/stores/displayCurrency.js'
    );
    expect(CURRENCY_NAMES).toEqual({
      TWD: '新台幣',
      USD: '美元',
      CNY: '人民幣',
      JPY: '日圓',
      KRW: '韓元',
    });
  });
});

// ─── Store 初始化 ────────────────────────────────────────────────────────────

describe('displayCurrency store 初始化', () => {
  it('localStorage 無資料時預設為 TWD', async () => {
    const { displayCurrency } = await import(
      '../src/lib/stores/displayCurrency.js'
    );
    expect(get(displayCurrency)).toBe('TWD');
  });

  it('從 localStorage 讀取先前儲存的貨幣設定', async () => {
    saveDisplayCurrency('USD');
    const { displayCurrency } = await import(
      '../src/lib/stores/displayCurrency.js'
    );
    expect(get(displayCurrency)).toBe('USD');
  });

  it('localStorage 中的值不在支援清單中時回退至 TWD', async () => {
    saveDisplayCurrency('EUR');
    const { displayCurrency } = await import(
      '../src/lib/stores/displayCurrency.js'
    );
    expect(get(displayCurrency)).toBe('TWD');
  });

  it('localStorage 資料損壞時回退至 TWD', async () => {
    localStorage.setItem('nwt_display_currency', '{corrupted');
    const { displayCurrency } = await import(
      '../src/lib/stores/displayCurrency.js'
    );
    expect(get(displayCurrency)).toBe('TWD');
  });
});

// ─── Store set() 持久化 ─────────────────────────────────────────────────────

describe('displayCurrency store set() 持久化', () => {
  it('set() 後 localStorage 中的值同步更新', async () => {
    const { displayCurrency } = await import(
      '../src/lib/stores/displayCurrency.js'
    );
    displayCurrency.set('JPY');
    expect(loadDisplayCurrency()).toBe('JPY');
  });

  it('set() 後 store 值同步更新', async () => {
    const { displayCurrency } = await import(
      '../src/lib/stores/displayCurrency.js'
    );
    displayCurrency.set('KRW');
    expect(get(displayCurrency)).toBe('KRW');
  });

  it('連續 set() 多個貨幣，最終值正確', async () => {
    const { displayCurrency } = await import(
      '../src/lib/stores/displayCurrency.js'
    );
    displayCurrency.set('USD');
    displayCurrency.set('CNY');
    displayCurrency.set('JPY');
    expect(get(displayCurrency)).toBe('JPY');
    expect(loadDisplayCurrency()).toBe('JPY');
  });
});

// ─── 屬性測試：貨幣設定持久化 Round-Trip ─────────────────────────────────────

import * as fc from 'fast-check';

/**
 * Feature: currency-switcher, Property 1: 貨幣設定持久化 Round-Trip
 *
 * 對於任何支援的貨幣代碼，將其設定為顯示貨幣後，
 * 從 localStorage 讀取應得到相同的貨幣代碼。
 *
 * **Validates: Requirements 2.1, 2.2**
 */
describe('屬性測試：貨幣設定持久化 Round-Trip', () => {
  it('設定任意支援貨幣後，localStorage 應持久化相同的貨幣代碼', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('TWD', 'USD', 'CNY', 'JPY', 'KRW'),
        async (currency) => {
          // 1) 清除 localStorage，確保乾淨狀態
          localStorage.clear();

          // 2) 重設模組快取，取得全新的 store 實例
          vi.resetModules();

          // 3) 動態匯入 store 與 storage 服務
          const { displayCurrency } = await import(
            '../src/lib/stores/displayCurrency.js'
          );
          const { loadDisplayCurrency } = await import(
            '../src/lib/services/storage.js'
          );

          // 4) 透過 store 設定顯示貨幣
          displayCurrency.set(currency);

          // 5) 驗證：從 localStorage 讀取的值應與設定值一致
          const persisted = loadDisplayCurrency();
          expect(persisted).toBe(currency);
        },
      ),
      { numRuns: 100 },
    );
  }, 30000);
});
