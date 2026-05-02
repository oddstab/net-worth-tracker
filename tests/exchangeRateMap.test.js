/**
 * exchangeRateMap.test.js — 匯率對照表 store 單元測試
 *
 * 測試 src/lib/stores/exchangeRateMap.js 的常數匯出、
 * store 初始化、setRate / setAll 持久化行為、TWD 不可修改、
 * 向後相容同步、以及 validateExchangeRate 驗證函式。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import {
  saveExchangeRateMap,
  loadExchangeRateMap,
  loadExchangeRate,
} from '../src/lib/services/storage.js';

// ─── 每次測試前清除 localStorage 並重設模組快取 ──────────────────────────────

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

// ─── 常數匯出 ────────────────────────────────────────────────────────────────

describe('exchangeRateMap 常數匯出', () => {
  it('CURRENCY_DECIMALS 包含所有支援貨幣的小數位設定', async () => {
    const { CURRENCY_DECIMALS } = await import(
      '../src/lib/stores/exchangeRateMap.js'
    );
    expect(CURRENCY_DECIMALS).toEqual({
      TWD: 0,
      USD: 2,
      CNY: 2,
      JPY: 0,
      KRW: 0,
    });
  });

  it('DEFAULT_RATES 包含四個外幣的預設匯率', async () => {
    const { DEFAULT_RATES } = await import(
      '../src/lib/stores/exchangeRateMap.js'
    );
    expect(DEFAULT_RATES).toEqual({
      USD: 31.5,
      CNY: 4.35,
      JPY: 0.21,
      KRW: 0.023,
    });
  });
});

// ─── validateExchangeRate ────────────────────────────────────────────────────

describe('validateExchangeRate 驗證函式', () => {
  it('有限正數回傳 true', async () => {
    const { validateExchangeRate } = await import(
      '../src/lib/stores/exchangeRateMap.js'
    );
    expect(validateExchangeRate(31.5)).toBe(true);
    expect(validateExchangeRate(0.001)).toBe(true);
    expect(validateExchangeRate(1)).toBe(true);
    expect(validateExchangeRate(999999)).toBe(true);
  });

  it('零回傳 false', async () => {
    const { validateExchangeRate } = await import(
      '../src/lib/stores/exchangeRateMap.js'
    );
    expect(validateExchangeRate(0)).toBe(false);
  });

  it('負數回傳 false', async () => {
    const { validateExchangeRate } = await import(
      '../src/lib/stores/exchangeRateMap.js'
    );
    expect(validateExchangeRate(-1)).toBe(false);
    expect(validateExchangeRate(-0.5)).toBe(false);
  });

  it('NaN 回傳 false', async () => {
    const { validateExchangeRate } = await import(
      '../src/lib/stores/exchangeRateMap.js'
    );
    expect(validateExchangeRate(NaN)).toBe(false);
  });

  it('Infinity 回傳 false', async () => {
    const { validateExchangeRate } = await import(
      '../src/lib/stores/exchangeRateMap.js'
    );
    expect(validateExchangeRate(Infinity)).toBe(false);
    expect(validateExchangeRate(-Infinity)).toBe(false);
  });

  it('非數字型別回傳 false', async () => {
    const { validateExchangeRate } = await import(
      '../src/lib/stores/exchangeRateMap.js'
    );
    expect(validateExchangeRate('31.5')).toBe(false);
    expect(validateExchangeRate(null)).toBe(false);
    expect(validateExchangeRate(undefined)).toBe(false);
    expect(validateExchangeRate(true)).toBe(false);
    expect(validateExchangeRate({})).toBe(false);
  });
});

// ─── Store 初始化 ────────────────────────────────────────────────────────────

describe('exchangeRateMap store 初始化', () => {
  it('localStorage 無資料時使用預設匯率，且包含 TWD: 1', async () => {
    const { exchangeRateMap } = await import(
      '../src/lib/stores/exchangeRateMap.js'
    );
    const value = get(exchangeRateMap);
    expect(value.TWD).toBe(1);
    expect(value.USD).toBe(31.5);
    expect(value.CNY).toBe(4.35);
    expect(value.JPY).toBe(0.21);
    expect(value.KRW).toBe(0.023);
  });

  it('從 localStorage 讀取先前儲存的匯率', async () => {
    saveExchangeRateMap({ USD: 32, CNY: 4.5, JPY: 0.22, KRW: 0.025 });
    const { exchangeRateMap } = await import(
      '../src/lib/stores/exchangeRateMap.js'
    );
    const value = get(exchangeRateMap);
    expect(value.USD).toBe(32);
    expect(value.CNY).toBe(4.5);
    expect(value.TWD).toBe(1);
  });

  it('localStorage 資料損壞時回退至預設匯率', async () => {
    localStorage.setItem('nwt_exchange_rate_map', '{corrupted');
    const { exchangeRateMap } = await import(
      '../src/lib/stores/exchangeRateMap.js'
    );
    const value = get(exchangeRateMap);
    expect(value.USD).toBe(31.5);
    expect(value.TWD).toBe(1);
  });
});

// ─── setRate() ───────────────────────────────────────────────────────────────

describe('exchangeRateMap setRate()', () => {
  it('更新單一幣別匯率並持久化', async () => {
    const { exchangeRateMap } = await import(
      '../src/lib/stores/exchangeRateMap.js'
    );
    exchangeRateMap.setRate('USD', 32.0);
    const value = get(exchangeRateMap);
    expect(value.USD).toBe(32.0);

    const stored = loadExchangeRateMap();
    expect(stored.USD).toBe(32.0);
  });

  it('TWD 匯率不可修改，始終為 1', async () => {
    const { exchangeRateMap } = await import(
      '../src/lib/stores/exchangeRateMap.js'
    );
    exchangeRateMap.setRate('TWD', 999);
    const value = get(exchangeRateMap);
    expect(value.TWD).toBe(1);
  });

  it('更新 USD 匯率時同步更新既有 exchangeRate store', async () => {
    const { exchangeRateMap } = await import(
      '../src/lib/stores/exchangeRateMap.js'
    );
    exchangeRateMap.setRate('USD', 33.0);

    // 驗證 localStorage 中的既有 exchangeRate 也同步更新
    expect(loadExchangeRate()).toBe(33.0);
  });

  it('更新非 USD 幣別不影響既有 exchangeRate store', async () => {
    const { exchangeRateMap } = await import(
      '../src/lib/stores/exchangeRateMap.js'
    );
    // 先設定 USD 為已知值
    exchangeRateMap.setRate('USD', 31.5);
    const usdBefore = loadExchangeRate();

    // 更新 JPY
    exchangeRateMap.setRate('JPY', 0.25);

    // USD 的 exchangeRate 應保持不變（因為 syncLegacyExchangeRate 仍會寫入 USD 值）
    expect(loadExchangeRate()).toBe(usdBefore);
  });
});

// ─── setAll() ────────────────────────────────────────────────────────────────

describe('exchangeRateMap setAll()', () => {
  it('批次設定所有匯率並持久化', async () => {
    const { exchangeRateMap } = await import(
      '../src/lib/stores/exchangeRateMap.js'
    );
    const newRates = { USD: 30, CNY: 4.0, JPY: 0.2, KRW: 0.02 };
    exchangeRateMap.setAll(newRates);

    const value = get(exchangeRateMap);
    expect(value.USD).toBe(30);
    expect(value.CNY).toBe(4.0);
    expect(value.JPY).toBe(0.2);
    expect(value.KRW).toBe(0.02);
    expect(value.TWD).toBe(1);

    const stored = loadExchangeRateMap();
    expect(stored.USD).toBe(30);
  });

  it('setAll 即使傳入 TWD 值也會被覆蓋為 1', async () => {
    const { exchangeRateMap } = await import(
      '../src/lib/stores/exchangeRateMap.js'
    );
    exchangeRateMap.setAll({ USD: 30, CNY: 4.0, JPY: 0.2, KRW: 0.02, TWD: 999 });
    const value = get(exchangeRateMap);
    expect(value.TWD).toBe(1);
  });

  it('setAll 同步更新既有 exchangeRate store', async () => {
    const { exchangeRateMap } = await import(
      '../src/lib/stores/exchangeRateMap.js'
    );
    exchangeRateMap.setAll({ USD: 29.5, CNY: 4.0, JPY: 0.2, KRW: 0.02 });
    expect(loadExchangeRate()).toBe(29.5);
  });
});

// ─── 屬性測試：匯率對照表持久化 Round-Trip ───────────────────────────────────

import * as fc from 'fast-check';

/**
 * Feature: currency-switcher, Property 2: 匯率對照表持久化 Round-Trip
 *
 * 對於任何有效的匯率對照表（所有值為有限正數），
 * 將其透過 store 的 setAll() 儲存至 localStorage 後再讀取，
 * 應得到等價的匯率對照表。
 *
 * **Validates: Requirements 3.4**
 */
describe('屬性測試：匯率對照表持久化 Round-Trip', () => {
  /** 匯率 arbitrary：有限正數，範圍 0.001 ~ 1000 */
  const rateArb = fc.double({ min: 0.001, max: 1000, noNaN: true, noDefaultInfinity: true });

  it('儲存任意有效匯率對照表後再讀取，應得到等價的匯率對照表', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({ USD: rateArb, CNY: rateArb, JPY: rateArb, KRW: rateArb }),
        async (rates) => {
          // 1) 清除 localStorage，確保乾淨狀態
          localStorage.clear();

          // 2) 重設模組快取，取得全新的 store 實例
          vi.resetModules();

          // 3) 動態匯入 store 與 storage 服務
          const { exchangeRateMap } = await import(
            '../src/lib/stores/exchangeRateMap.js'
          );
          const { loadExchangeRateMap } = await import(
            '../src/lib/services/storage.js'
          );

          // 4) 透過 store 的 setAll() 設定匯率對照表
          exchangeRateMap.setAll(rates);

          // 5) 從 localStorage 讀取持久化的匯率對照表
          const persisted = loadExchangeRateMap();

          // 6) 驗證：讀取的匯率應與設定值一致
          //    注意：TWD 固定為 1，由 store 自動加入，
          //    但 loadExchangeRateMap() 回傳的是 storage 層的原始資料，
          //    其中包含 setAll() 寫入的 TWD: 1
          expect(persisted.USD).toBeCloseTo(rates.USD, 10);
          expect(persisted.CNY).toBeCloseTo(rates.CNY, 10);
          expect(persisted.JPY).toBeCloseTo(rates.JPY, 10);
          expect(persisted.KRW).toBeCloseTo(rates.KRW, 10);
        },
      ),
      { numRuns: 100 },
    );
  }, 30000);
});


// ─── 屬性測試：無效匯率拒絕 ─────────────────────────────────────────────────

/**
 * Feature: currency-switcher, Property 7: 無效匯率拒絕
 *
 * 對於任何非有限正數的輸入值（包括負數、零、NaN、Infinity），
 * validateExchangeRate() 應拒絕該值並回傳 false。
 *
 * 互補屬性：對於任何有限正數，validateExchangeRate() 應回傳 true，
 * 確保函式不是單純對所有輸入都回傳 false。
 *
 * **Validates: Requirements 7.3**
 */
describe('屬性測試：無效匯率拒絕', () => {
  /**
   * 無效匯率 arbitrary：產生 NaN、Infinity、負數、零、以及 max: 0 的 double
   * 注意：fc.double({ max: 0 }) 可能產生 -0，在 JavaScript 中 -0 === 0，
   * 而 -0 > 0 為 false，因此 validateExchangeRate 應正確拒絕。
   */
  const invalidRateArb = fc.oneof(
    fc.constant(NaN),
    fc.constant(Infinity),
    fc.constant(-Infinity),
    fc.constant(-1),
    fc.constant(0),
    fc.double({ max: 0, noNaN: true }),
  );

  it('對所有非有限正數回傳 false', async () => {
    await fc.assert(
      fc.asyncProperty(invalidRateArb, async (invalidValue) => {
        // 重設模組快取以確保乾淨狀態
        vi.resetModules();

        const { validateExchangeRate } = await import(
          '../src/lib/stores/exchangeRateMap.js'
        );

        // 驗證：無效值應被拒絕
        expect(validateExchangeRate(invalidValue)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * 互補屬性：有限正數應被接受
   * 確保 validateExchangeRate 不是對所有輸入都回傳 false
   */
  const validRateArb = fc.double({
    min: Number.MIN_VALUE,
    max: 1e15,
    noNaN: true,
    noDefaultInfinity: true,
  }).filter((v) => v > 0 && Number.isFinite(v));

  it('對所有有限正數回傳 true（互補驗證）', async () => {
    await fc.assert(
      fc.asyncProperty(validRateArb, async (validValue) => {
        vi.resetModules();

        const { validateExchangeRate } = await import(
          '../src/lib/stores/exchangeRateMap.js'
        );

        // 驗證：有限正數應被接受
        expect(validateExchangeRate(validValue)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});
