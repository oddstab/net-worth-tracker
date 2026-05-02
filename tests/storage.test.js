/**
 * storage.test.js — Storage Service 屬性測試與單元測試
 *
 * 測試 src/lib/services/storage.js 的所有匯出函式。
 * 使用 fast-check 進行屬性測試，驗證資料匯出/匯入的 round-trip 與匯入驗證。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import {
  loadAssets,
  saveAssets,
  loadLiabilities,
  saveLiabilities,
  loadExchangeRate,
  saveExchangeRate,
  loadSnapshots,
  saveSnapshots,
  exportData,
  importData,
  saveDisplayCurrency,
  loadDisplayCurrency,
  saveExchangeRateMap,
  loadExchangeRateMap,
} from '../src/lib/services/storage.js';

// ─── 每次測試前清除 localStorage ──────────────────────────────────────────────

beforeEach(() => {
  localStorage.clear();
});

// ─── 單元測試：基本讀寫 ──────────────────────────────────────────────────────

describe('Storage Service 基本讀寫', () => {
  it('loadAssets 預設回傳空陣列', () => {
    expect(loadAssets()).toEqual([]);
  });

  it('saveAssets / loadAssets round-trip', () => {
    const assets = [{ id: '1', name: '台積電', quantity: 10 }];
    saveAssets(assets);
    expect(loadAssets()).toEqual(assets);
  });

  it('loadLiabilities 預設回傳空陣列', () => {
    expect(loadLiabilities()).toEqual([]);
  });

  it('saveLiabilities / loadLiabilities round-trip', () => {
    const liabilities = [{ id: '1', name: '信貸', amount: 50000 }];
    saveLiabilities(liabilities);
    expect(loadLiabilities()).toEqual(liabilities);
  });

  it('loadExchangeRate 預設回傳 31.5', () => {
    expect(loadExchangeRate()).toBe(31.5);
  });

  it('saveExchangeRate / loadExchangeRate round-trip', () => {
    saveExchangeRate(32.0);
    expect(loadExchangeRate()).toBe(32.0);
  });

  it('loadSnapshots 預設回傳空陣列', () => {
    expect(loadSnapshots()).toEqual([]);
  });

  it('saveSnapshots / loadSnapshots round-trip', () => {
    const snapshots = [{ date: '2025-01-01', netWorth: 1000000 }];
    saveSnapshots(snapshots);
    expect(loadSnapshots()).toEqual(snapshots);
  });
});

// ─── 單元測試：JSON.parse 失敗時回傳預設值 ───────────────────────────────────

describe('Storage Service 損壞資料處理', () => {
  it('localStorage 中存放無效 JSON 時 loadAssets 回傳空陣列', () => {
    localStorage.setItem('nwt_assets', '{invalid json');
    expect(loadAssets()).toEqual([]);
  });

  it('localStorage 中存放無效 JSON 時 loadExchangeRate 回傳預設值', () => {
    localStorage.setItem('nwt_exchange_rate', 'not-a-number');
    expect(loadExchangeRate()).toBe(31.5);
  });

  it('localStorage 中存放無效 JSON 時 loadDisplayCurrency 回傳預設值 TWD', () => {
    localStorage.setItem('nwt_display_currency', '{corrupted');
    expect(loadDisplayCurrency()).toBe('TWD');
  });

  it('localStorage 中存放無效 JSON 時 loadExchangeRateMap 回傳預設匯率', () => {
    localStorage.setItem('nwt_exchange_rate_map', 'not valid json!!');
    expect(loadExchangeRateMap()).toEqual({ USD: 31.5, CNY: 4.35, JPY: 0.21, KRW: 0.023 });
  });
});

// ─── 單元測試：顯示貨幣讀寫 ──────────────────────────────────────────────────

describe('Storage Service 顯示貨幣讀寫', () => {
  it('loadDisplayCurrency 預設回傳 TWD', () => {
    expect(loadDisplayCurrency()).toBe('TWD');
  });

  it('saveDisplayCurrency / loadDisplayCurrency round-trip', () => {
    saveDisplayCurrency('USD');
    expect(loadDisplayCurrency()).toBe('USD');
  });

  it('可儲存並讀取所有支援的貨幣代碼', () => {
    const currencies = ['TWD', 'USD', 'CNY', 'JPY', 'KRW'];
    for (const cur of currencies) {
      saveDisplayCurrency(cur);
      expect(loadDisplayCurrency()).toBe(cur);
    }
  });
});

// ─── 單元測試：匯率對照表讀寫 ────────────────────────────────────────────────

describe('Storage Service 匯率對照表讀寫', () => {
  it('loadExchangeRateMap 預設回傳預設匯率對照表', () => {
    expect(loadExchangeRateMap()).toEqual({
      USD: 31.5,
      CNY: 4.35,
      JPY: 0.21,
      KRW: 0.023,
    });
  });

  it('saveExchangeRateMap / loadExchangeRateMap round-trip', () => {
    const customRates = { USD: 32.0, CNY: 4.5, JPY: 0.22, KRW: 0.025 };
    saveExchangeRateMap(customRates);
    expect(loadExchangeRateMap()).toEqual(customRates);
  });
});

// ─── 單元測試：exportData ────────────────────────────────────────────────────

describe('exportData', () => {
  it('匯出包含所有四個欄位', () => {
    const json = exportData();
    const parsed = JSON.parse(json);
    expect(parsed).toHaveProperty('assets');
    expect(parsed).toHaveProperty('liabilities');
    expect(parsed).toHaveProperty('exchangeRate');
    expect(parsed).toHaveProperty('snapshots');
  });

  it('匯出反映目前 localStorage 中的資料', () => {
    saveAssets([{ id: 'a1', name: 'BTC' }]);
    saveExchangeRate(33.0);
    const parsed = JSON.parse(exportData());
    expect(parsed.assets).toEqual([{ id: 'a1', name: 'BTC' }]);
    expect(parsed.exchangeRate).toBe(33.0);
  });
});

// ─── 單元測試：importData 驗證 ───────────────────────────────────────────────

describe('importData 驗證', () => {
  it('無效 JSON 拋出「JSON 格式無效」錯誤', () => {
    expect(() => importData('not json')).toThrow('匯入失敗：JSON 格式無效');
  });

  it('缺少 assets 欄位拋出包含欄位名稱的錯誤', () => {
    const data = { liabilities: [], exchangeRate: 31.5, snapshots: [] };
    expect(() => importData(JSON.stringify(data))).toThrow('assets');
  });

  it('缺少 liabilities 欄位拋出包含欄位名稱的錯誤', () => {
    const data = { assets: [], exchangeRate: 31.5, snapshots: [] };
    expect(() => importData(JSON.stringify(data))).toThrow('liabilities');
  });

  it('缺少 exchangeRate 欄位拋出包含欄位名稱的錯誤', () => {
    const data = { assets: [], liabilities: [], snapshots: [] };
    expect(() => importData(JSON.stringify(data))).toThrow('exchangeRate');
  });

  it('缺少 snapshots 欄位拋出包含欄位名稱的錯誤', () => {
    const data = { assets: [], liabilities: [], exchangeRate: 31.5 };
    expect(() => importData(JSON.stringify(data))).toThrow('snapshots');
  });

  it('assets 非陣列時拋出錯誤', () => {
    const data = { assets: 'not array', liabilities: [], exchangeRate: 31.5, snapshots: [] };
    expect(() => importData(JSON.stringify(data))).toThrow('assets 必須為陣列');
  });

  it('liabilities 非陣列時拋出錯誤', () => {
    const data = { assets: [], liabilities: 'not array', exchangeRate: 31.5, snapshots: [] };
    expect(() => importData(JSON.stringify(data))).toThrow('liabilities 必須為陣列');
  });

  it('exchangeRate 非數字時拋出錯誤', () => {
    const data = { assets: [], liabilities: [], exchangeRate: 'abc', snapshots: [] };
    expect(() => importData(JSON.stringify(data))).toThrow('exchangeRate 必須為數字');
  });

  it('snapshots 非陣列時拋出錯誤', () => {
    const data = { assets: [], liabilities: [], exchangeRate: 31.5, snapshots: 'not array' };
    expect(() => importData(JSON.stringify(data))).toThrow('snapshots 必須為陣列');
  });

  it('有效資料匯入後存入 localStorage', () => {
    const data = {
      assets: [{ id: 'a1', name: 'ETH' }],
      liabilities: [{ id: 'l1', name: '房貸' }],
      exchangeRate: 32.5,
      snapshots: [{ date: '2025-06-01', netWorth: 500000 }],
    };
    const result = importData(JSON.stringify(data));
    expect(result).toEqual(data);
    expect(loadAssets()).toEqual(data.assets);
    expect(loadLiabilities()).toEqual(data.liabilities);
    expect(loadExchangeRate()).toBe(data.exchangeRate);
    expect(loadSnapshots()).toEqual(data.snapshots);
  });
});

// ─── Property-Based Tests（屬性測試）────────────────────────────────────────

// ─── 共用 Arbitrary 定義 ─────────────────────────────────────────────────────

/** 產生有效的資產物件（可包含任意 JSON 可序列化欄位） */
const assetArb = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  symbol: fc.string({ minLength: 0, maxLength: 10 }),
  category: fc.constantFrom('investment', 'liquid'),
  type: fc.constantFrom('tw_stock', 'crypto', 'cash', 'other'),
  quantity: fc.double({ min: 0.01, max: 1e8, noNaN: true, noDefaultInfinity: true }),
  currency: fc.constantFrom('TWD', 'USD'),
  pricePerUnit: fc.double({ min: 0, max: 1e8, noNaN: true, noDefaultInfinity: true })
    .map(v => Object.is(v, -0) ? 0 : v),
});

/** 產生有效的負債物件 */
const liabilityArb = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  category: fc.constantFrom('credit', 'home_loan', 'pledge', 'mortgage', 'other'),
  amount: fc.double({ min: 0.01, max: 1e8, noNaN: true, noDefaultInfinity: true }),
  currency: fc.constantFrom('TWD', 'USD'),
});

/** 產生有效的快照物件（避免 -0，因為 JSON.stringify(-0) === "0"，round-trip 不等價） */
const snapshotArb = fc.record({
  date: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
    .map(d => d.toISOString().slice(0, 10)),
  netWorth: fc.double({ min: -1e8, max: 1e8, noNaN: true, noDefaultInfinity: true })
    .map(v => Object.is(v, -0) ? 0 : v),
});

/** 產生有效的正數匯率 */
const exchangeRateArb = fc.double({ min: 0.01, max: 1000, noNaN: true, noDefaultInfinity: true });

/** 產生完整的 AppState 物件 */
const appStateArb = fc.record({
  assets: fc.array(assetArb, { minLength: 0, maxLength: 10 }),
  liabilities: fc.array(liabilityArb, { minLength: 0, maxLength: 10 }),
  exchangeRate: exchangeRateArb,
  snapshots: fc.array(snapshotArb, { minLength: 0, maxLength: 10 }),
});

// Feature: sveltekit-spa-migration, Property 1: 資料匯出/匯入 Round-Trip
// **Validates: Requirements 4.7, 4.2, 4.4**
describe('Property 1: 資料匯出/匯入 Round-Trip', () => {
  it('exportData 後 importData 產生等價物件', () => {
    fc.assert(
      fc.property(appStateArb, (appState) => {
        // 先清除 localStorage
        localStorage.clear();

        // 將 appState 存入 localStorage
        saveAssets(appState.assets);
        saveLiabilities(appState.liabilities);
        saveExchangeRate(appState.exchangeRate);
        saveSnapshots(appState.snapshots);

        // 匯出
        const exported = exportData();

        // 清除 localStorage 模擬全新環境
        localStorage.clear();

        // 匯入
        const imported = importData(exported);

        // 驗證 round-trip：匯入結果應與原始 appState 深度相等
        expect(imported.assets).toEqual(appState.assets);
        expect(imported.liabilities).toEqual(appState.liabilities);
        expect(imported.exchangeRate).toBe(appState.exchangeRate);
        expect(imported.snapshots).toEqual(appState.snapshots);
      }),
      { numRuns: 100 }
    );
  });
});

// Feature: sveltekit-spa-migration, Property 2: 匯入驗證拒絕缺失欄位
// **Validates: Requirements 4.5, 4.6**
describe('Property 2: 匯入驗證拒絕缺失欄位', () => {
  const requiredFields = ['assets', 'liabilities', 'exchangeRate', 'snapshots'];

  it('移除任一必要欄位後 importData 拋出包含欄位名稱的錯誤', () => {
    fc.assert(
      fc.property(
        appStateArb,
        fc.constantFrom(...requiredFields),
        (appState, fieldToRemove) => {
          // 建立一份副本並移除指定欄位
          const incomplete = { ...appState };
          delete incomplete[fieldToRemove];

          const jsonString = JSON.stringify(incomplete);

          // 應拋出錯誤
          try {
            importData(jsonString);
            // 若未拋出錯誤，測試失敗
            return false;
          } catch (err) {
            // 錯誤訊息應包含缺失欄位的名稱
            return err.message.includes(fieldToRemove);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Feature: currency-switcher, Property 6: 匯出匯入資料完整性 ──────────────
// **Validates: Requirements 6.3, 6.4**
describe('Property 6: 匯出匯入資料完整性', { timeout: 30000 }, () => {
  /** 支援的貨幣代碼 */
  const currencyArb = fc.constantFrom('TWD', 'USD', 'CNY', 'JPY', 'KRW');

  it('exportData 輸出的 JSON 中所有金額為原始 TWD 數值，不受 displayCurrency 影響', () => {
    fc.assert(
      fc.property(
        appStateArb,
        currencyArb,
        currencyArb,
        (appState, currency1, currency2) => {
          // 先清除 localStorage
          localStorage.clear();

          // 存入資料
          saveAssets(appState.assets);
          saveLiabilities(appState.liabilities);
          saveExchangeRate(appState.exchangeRate);
          saveSnapshots(appState.snapshots);

          // 設定第一種顯示貨幣後匯出
          saveDisplayCurrency(currency1);
          const exported1 = exportData();

          // 切換為第二種顯示貨幣後匯出
          saveDisplayCurrency(currency2);
          const exported2 = exportData();

          // 兩次匯出結果應完全相同（exportData 不受 displayCurrency 影響）
          return exported1 === exported2;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('importData 以 TWD 為基準匯入，不受當前 displayCurrency 設定影響', () => {
    fc.assert(
      fc.property(
        appStateArb,
        currencyArb,
        currencyArb,
        (appState, currency1, currency2) => {
          const jsonString = JSON.stringify(appState);

          // 在第一種顯示貨幣下匯入
          localStorage.clear();
          saveDisplayCurrency(currency1);
          const imported1 = importData(jsonString);

          // 讀取匯入後的 localStorage 資料
          const assets1 = loadAssets();
          const liabilities1 = loadLiabilities();
          const rate1 = loadExchangeRate();
          const snapshots1 = loadSnapshots();

          // 在第二種顯示貨幣下匯入
          localStorage.clear();
          saveDisplayCurrency(currency2);
          const imported2 = importData(jsonString);

          // 讀取匯入後的 localStorage 資料
          const assets2 = loadAssets();
          const liabilities2 = loadLiabilities();
          const rate2 = loadExchangeRate();
          const snapshots2 = loadSnapshots();

          // 兩次匯入結果應完全相同（importData 不受 displayCurrency 影響）
          return (
            JSON.stringify(imported1) === JSON.stringify(imported2) &&
            JSON.stringify(assets1) === JSON.stringify(assets2) &&
            JSON.stringify(liabilities1) === JSON.stringify(liabilities2) &&
            rate1 === rate2 &&
            JSON.stringify(snapshots1) === JSON.stringify(snapshots2)
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});
