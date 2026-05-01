/**
 * compatibility.test.js — 現有資料相容性整合測試
 *
 * 驗證新 SvelteKit 應用程式能正確讀取現有應用程式儲存的 localStorage 資料。
 * 使用模擬的現有格式資料，確認 Storage Service 與 Stores 能正確載入並持久化。
 *
 * Requirements: 20.1, 20.2, 20.3, 20.4, 20.5
 */
import { describe, it, expect, beforeEach } from 'vitest';
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
} from '../src/lib/services/storage.js';

// ─── 模擬現有應用程式的資料格式 ──────────────────────────────────────────────

/**
 * 模擬現有應用程式儲存的 Asset 資料。
 * 包含所有欄位：id, name, symbol, category, type, quantity, currency,
 * pricePerUnit, priceSource, lastPriceUpdate
 */
const MOCK_EXISTING_ASSETS = [
  {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    name: '台積電',
    symbol: '2330',
    category: 'investment',
    type: 'tw_stock',
    quantity: 5,
    currency: 'TWD',
    pricePerUnit: 1050,
    priceSource: 'auto',
    lastPriceUpdate: '2025-06-01T10:30:00.000Z',
  },
  {
    id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    name: 'Bitcoin',
    symbol: 'BTC',
    category: 'investment',
    type: 'crypto',
    quantity: 0.5,
    currency: 'USD',
    pricePerUnit: 68000,
    priceSource: 'auto',
    lastPriceUpdate: '2025-06-01T10:30:00.000Z',
  },
  {
    id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
    name: '活存',
    symbol: '',
    category: 'liquid',
    type: 'cash',
    quantity: 1,
    currency: 'TWD',
    pricePerUnit: 500000,
    priceSource: 'manual',
    lastPriceUpdate: null,
  },
  {
    id: 'd4e5f6a7-b8c9-0123-defa-234567890123',
    name: '美元定存',
    symbol: '',
    category: 'liquid',
    type: 'other',
    quantity: 1,
    currency: 'USD',
    pricePerUnit: 10000,
    priceSource: 'manual',
    lastPriceUpdate: null,
  },
];

/**
 * 模擬現有應用程式儲存的 Liability 資料。
 * 包含所有欄位：id, name, category, amount, currency, interestRate,
 * terms, startDate, endDate, creditLine, drawdownDate
 */
const MOCK_EXISTING_LIABILITIES = [
  {
    id: 'l1a2b3c4-d5e6-7890-abcd-ef1234567890',
    name: '信用貸款',
    category: 'credit',
    amount: 300000,
    currency: 'TWD',
    interestRate: 5.5,
    terms: 60,
    startDate: '2024-01-15',
    endDate: '2029-01-15',
    creditLine: undefined,
    drawdownDate: undefined,
  },
  {
    id: 'l2b3c4d5-e6f7-8901-bcde-f12345678901',
    name: '房屋貸款',
    category: 'home_loan',
    amount: 5000000,
    currency: 'TWD',
    interestRate: 2.1,
    terms: 240,
    startDate: '2023-06-01',
    endDate: '2043-06-01',
    creditLine: undefined,
    drawdownDate: undefined,
  },
  {
    id: 'l3c4d5e6-f7a8-9012-cdef-123456789012',
    name: '股票質押',
    category: 'pledge',
    amount: 200000,
    currency: 'TWD',
    interestRate: 3.0,
    terms: undefined,
    startDate: undefined,
    endDate: undefined,
    creditLine: 1000000,
    drawdownDate: '2025-03-01',
  },
  {
    id: 'l4d5e6f7-a8b9-0123-defa-234567890123',
    name: '理財型房貸',
    category: 'mortgage',
    amount: 500000,
    currency: 'TWD',
    interestRate: 2.5,
    terms: undefined,
    startDate: undefined,
    endDate: undefined,
    creditLine: 2000000,
    drawdownDate: '2025-01-10',
  },
];

/**
 * 模擬現有應用程式儲存的 Snapshot 資料。
 * 包含 date 與 netWorth 欄位。
 */
const MOCK_EXISTING_SNAPSHOTS = [
  { date: '2025-05-01', netWorth: 2500000 },
  { date: '2025-05-15', netWorth: 2600000 },
  { date: '2025-06-01', netWorth: 2750000 },
];

/** 模擬現有應用程式的匯率 */
const MOCK_EXISTING_EXCHANGE_RATE = 31.5;

// ─── localStorage key 常數（與現有應用程式相同） ──────────────────────────────

const STORAGE_KEYS = {
  ASSETS: 'nwt_assets',
  LIABILITIES: 'nwt_liabilities',
  EXCHANGE_RATE: 'nwt_exchange_rate',
  SNAPSHOTS: 'nwt_snapshots',
};

// ─── 每次測試前清除 localStorage ──────────────────────────────────────────────

beforeEach(() => {
  localStorage.clear();
});

// ─── Task 21.1: 驗證現有 localStorage 資料相容性 ─────────────────────────────

describe('Task 21.1: 現有 localStorage 資料相容性', () => {

  describe('localStorage key 相容性', () => {
    it('使用相同的 nwt_assets key', () => {
      localStorage.setItem(STORAGE_KEYS.ASSETS, JSON.stringify(MOCK_EXISTING_ASSETS));
      const loaded = loadAssets();
      expect(loaded).toEqual(MOCK_EXISTING_ASSETS);
    });

    it('使用相同的 nwt_liabilities key', () => {
      localStorage.setItem(STORAGE_KEYS.LIABILITIES, JSON.stringify(MOCK_EXISTING_LIABILITIES));
      const loaded = loadLiabilities();
      expect(loaded).toEqual(MOCK_EXISTING_LIABILITIES);
    });

    it('使用相同的 nwt_exchange_rate key', () => {
      localStorage.setItem(STORAGE_KEYS.EXCHANGE_RATE, JSON.stringify(MOCK_EXISTING_EXCHANGE_RATE));
      const loaded = loadExchangeRate();
      expect(loaded).toBe(MOCK_EXISTING_EXCHANGE_RATE);
    });

    it('使用相同的 nwt_snapshots key', () => {
      localStorage.setItem(STORAGE_KEYS.SNAPSHOTS, JSON.stringify(MOCK_EXISTING_SNAPSHOTS));
      const loaded = loadSnapshots();
      expect(loaded).toEqual(MOCK_EXISTING_SNAPSHOTS);
    });
  });

  describe('Asset 資料結構解析', () => {
    beforeEach(() => {
      localStorage.setItem(STORAGE_KEYS.ASSETS, JSON.stringify(MOCK_EXISTING_ASSETS));
    });

    it('正確解析所有 Asset 欄位', () => {
      const assets = loadAssets();
      expect(assets).toHaveLength(4);

      // 台股資產
      const tsmc = assets[0];
      expect(tsmc.id).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
      expect(tsmc.name).toBe('台積電');
      expect(tsmc.symbol).toBe('2330');
      expect(tsmc.category).toBe('investment');
      expect(tsmc.type).toBe('tw_stock');
      expect(tsmc.quantity).toBe(5);
      expect(tsmc.currency).toBe('TWD');
      expect(tsmc.pricePerUnit).toBe(1050);
      expect(tsmc.priceSource).toBe('auto');
      expect(tsmc.lastPriceUpdate).toBe('2025-06-01T10:30:00.000Z');
    });

    it('正確解析加密貨幣資產（USD 計價）', () => {
      const assets = loadAssets();
      const btc = assets[1];
      expect(btc.type).toBe('crypto');
      expect(btc.currency).toBe('USD');
      expect(btc.quantity).toBe(0.5);
      expect(btc.pricePerUnit).toBe(68000);
    });

    it('正確解析手動定價資產（priceSource: manual, lastPriceUpdate: null）', () => {
      const assets = loadAssets();
      const cash = assets[2];
      expect(cash.priceSource).toBe('manual');
      expect(cash.lastPriceUpdate).toBeNull();
    });

    it('正確解析所有資產類型（tw_stock, crypto, cash, other）', () => {
      const assets = loadAssets();
      const types = assets.map(a => a.type);
      expect(types).toContain('tw_stock');
      expect(types).toContain('crypto');
      expect(types).toContain('cash');
      expect(types).toContain('other');
    });

    it('正確解析所有資產分類（investment, liquid）', () => {
      const assets = loadAssets();
      const categories = assets.map(a => a.category);
      expect(categories).toContain('investment');
      expect(categories).toContain('liquid');
    });
  });

  describe('Liability 資料結構解析', () => {
    beforeEach(() => {
      localStorage.setItem(STORAGE_KEYS.LIABILITIES, JSON.stringify(MOCK_EXISTING_LIABILITIES));
    });

    it('正確解析所有 Liability 欄位', () => {
      const liabilities = loadLiabilities();
      expect(liabilities).toHaveLength(4);

      // 信貸
      const credit = liabilities[0];
      expect(credit.id).toBe('l1a2b3c4-d5e6-7890-abcd-ef1234567890');
      expect(credit.name).toBe('信用貸款');
      expect(credit.category).toBe('credit');
      expect(credit.amount).toBe(300000);
      expect(credit.currency).toBe('TWD');
      expect(credit.interestRate).toBe(5.5);
      expect(credit.terms).toBe(60);
      expect(credit.startDate).toBe('2024-01-15');
      expect(credit.endDate).toBe('2029-01-15');
    });

    it('正確解析房貸資料', () => {
      const liabilities = loadLiabilities();
      const homeLoan = liabilities[1];
      expect(homeLoan.category).toBe('home_loan');
      expect(homeLoan.amount).toBe(5000000);
      expect(homeLoan.terms).toBe(240);
    });

    it('正確解析質押借款（含 creditLine 與 drawdownDate）', () => {
      const liabilities = loadLiabilities();
      const pledge = liabilities[2];
      expect(pledge.category).toBe('pledge');
      expect(pledge.creditLine).toBe(1000000);
      expect(pledge.drawdownDate).toBe('2025-03-01');
    });

    it('正確解析理財型房貸', () => {
      const liabilities = loadLiabilities();
      const mortgage = liabilities[3];
      expect(mortgage.category).toBe('mortgage');
      expect(mortgage.creditLine).toBe(2000000);
      expect(mortgage.drawdownDate).toBe('2025-01-10');
    });

    it('正確解析所有負債分類', () => {
      const liabilities = loadLiabilities();
      const categories = liabilities.map(l => l.category);
      expect(categories).toContain('credit');
      expect(categories).toContain('home_loan');
      expect(categories).toContain('pledge');
      expect(categories).toContain('mortgage');
    });
  });

  describe('Snapshot 資料結構解析', () => {
    it('正確解析 Snapshot 的 date 與 netWorth 欄位', () => {
      localStorage.setItem(STORAGE_KEYS.SNAPSHOTS, JSON.stringify(MOCK_EXISTING_SNAPSHOTS));
      const snapshots = loadSnapshots();
      expect(snapshots).toHaveLength(3);
      expect(snapshots[0].date).toBe('2025-05-01');
      expect(snapshots[0].netWorth).toBe(2500000);
      expect(snapshots[2].date).toBe('2025-06-01');
      expect(snapshots[2].netWorth).toBe(2750000);
    });
  });

  describe('首次啟動載入現有資料', () => {
    it('localStorage 已有完整資料時 Storage Service 正確載入所有資料', () => {
      // 模擬現有應用程式已儲存的資料
      localStorage.setItem(STORAGE_KEYS.ASSETS, JSON.stringify(MOCK_EXISTING_ASSETS));
      localStorage.setItem(STORAGE_KEYS.LIABILITIES, JSON.stringify(MOCK_EXISTING_LIABILITIES));
      localStorage.setItem(STORAGE_KEYS.EXCHANGE_RATE, JSON.stringify(MOCK_EXISTING_EXCHANGE_RATE));
      localStorage.setItem(STORAGE_KEYS.SNAPSHOTS, JSON.stringify(MOCK_EXISTING_SNAPSHOTS));

      // 新應用程式啟動時透過 Storage Service 載入
      const assets = loadAssets();
      const liabilities = loadLiabilities();
      const exchangeRate = loadExchangeRate();
      const snapshots = loadSnapshots();

      expect(assets).toEqual(MOCK_EXISTING_ASSETS);
      expect(liabilities).toEqual(MOCK_EXISTING_LIABILITIES);
      expect(exchangeRate).toBe(MOCK_EXISTING_EXCHANGE_RATE);
      expect(snapshots).toEqual(MOCK_EXISTING_SNAPSHOTS);
    });
  });
});

// ─── Task 21.2: 現有資料相容性整合測試 ───────────────────────────────────────

describe('Task 21.2: Store → Storage 持久化相容性', () => {

  describe('saveAssets 產生正確的 localStorage 資料', () => {
    it('儲存後 localStorage 包含正確的 JSON 資料', () => {
      saveAssets(MOCK_EXISTING_ASSETS);

      const raw = localStorage.getItem(STORAGE_KEYS.ASSETS);
      expect(raw).not.toBeNull();

      const parsed = JSON.parse(raw);
      expect(parsed).toEqual(MOCK_EXISTING_ASSETS);
    });

    it('儲存後可被 loadAssets 正確讀回', () => {
      saveAssets(MOCK_EXISTING_ASSETS);
      const loaded = loadAssets();
      expect(loaded).toEqual(MOCK_EXISTING_ASSETS);
    });
  });

  describe('saveLiabilities 產生正確的 localStorage 資料', () => {
    it('儲存後 localStorage 包含正確的 JSON 資料', () => {
      saveLiabilities(MOCK_EXISTING_LIABILITIES);

      const raw = localStorage.getItem(STORAGE_KEYS.LIABILITIES);
      expect(raw).not.toBeNull();

      const parsed = JSON.parse(raw);
      expect(parsed).toEqual(MOCK_EXISTING_LIABILITIES);
    });

    it('儲存後可被 loadLiabilities 正確讀回', () => {
      saveLiabilities(MOCK_EXISTING_LIABILITIES);
      const loaded = loadLiabilities();
      expect(loaded).toEqual(MOCK_EXISTING_LIABILITIES);
    });
  });

  describe('saveExchangeRate 產生正確的 localStorage 資料', () => {
    it('儲存後 localStorage 包含正確的數值', () => {
      saveExchangeRate(MOCK_EXISTING_EXCHANGE_RATE);

      const raw = localStorage.getItem(STORAGE_KEYS.EXCHANGE_RATE);
      expect(raw).not.toBeNull();
      expect(JSON.parse(raw)).toBe(MOCK_EXISTING_EXCHANGE_RATE);
    });
  });

  describe('saveSnapshots 產生正確的 localStorage 資料', () => {
    it('儲存後 localStorage 包含正確的 JSON 資料', () => {
      saveSnapshots(MOCK_EXISTING_SNAPSHOTS);

      const raw = localStorage.getItem(STORAGE_KEYS.SNAPSHOTS);
      expect(raw).not.toBeNull();

      const parsed = JSON.parse(raw);
      expect(parsed).toEqual(MOCK_EXISTING_SNAPSHOTS);
    });
  });

  describe('exportData / importData 與現有資料格式相容', () => {
    it('匯出現有格式資料後可正確匯入', () => {
      // 先存入現有格式資料
      saveAssets(MOCK_EXISTING_ASSETS);
      saveLiabilities(MOCK_EXISTING_LIABILITIES);
      saveExchangeRate(MOCK_EXISTING_EXCHANGE_RATE);
      saveSnapshots(MOCK_EXISTING_SNAPSHOTS);

      // 匯出
      const exported = exportData();
      const parsed = JSON.parse(exported);

      expect(parsed.assets).toEqual(MOCK_EXISTING_ASSETS);
      expect(parsed.liabilities).toEqual(MOCK_EXISTING_LIABILITIES);
      expect(parsed.exchangeRate).toBe(MOCK_EXISTING_EXCHANGE_RATE);
      expect(parsed.snapshots).toEqual(MOCK_EXISTING_SNAPSHOTS);

      // 清除後匯入
      localStorage.clear();
      const imported = importData(exported);

      expect(imported.assets).toEqual(MOCK_EXISTING_ASSETS);
      expect(imported.liabilities).toEqual(MOCK_EXISTING_LIABILITIES);
      expect(imported.exchangeRate).toBe(MOCK_EXISTING_EXCHANGE_RATE);
      expect(imported.snapshots).toEqual(MOCK_EXISTING_SNAPSHOTS);
    });

    it('模擬現有應用程式匯出的 JSON 可被新應用程式匯入', () => {
      // 模擬現有應用程式產生的匯出 JSON
      const legacyExport = JSON.stringify({
        assets: MOCK_EXISTING_ASSETS,
        liabilities: MOCK_EXISTING_LIABILITIES,
        exchangeRate: MOCK_EXISTING_EXCHANGE_RATE,
        snapshots: MOCK_EXISTING_SNAPSHOTS,
      });

      const imported = importData(legacyExport);

      expect(imported.assets).toEqual(MOCK_EXISTING_ASSETS);
      expect(imported.liabilities).toEqual(MOCK_EXISTING_LIABILITIES);
      expect(imported.exchangeRate).toBe(MOCK_EXISTING_EXCHANGE_RATE);
      expect(imported.snapshots).toEqual(MOCK_EXISTING_SNAPSHOTS);

      // 驗證 localStorage 中的資料也正確
      expect(loadAssets()).toEqual(MOCK_EXISTING_ASSETS);
      expect(loadLiabilities()).toEqual(MOCK_EXISTING_LIABILITIES);
      expect(loadExchangeRate()).toBe(MOCK_EXISTING_EXCHANGE_RATE);
      expect(loadSnapshots()).toEqual(MOCK_EXISTING_SNAPSHOTS);
    });
  });

  describe('邊界情況：部分欄位為 undefined 或 null', () => {
    it('Asset 的 lastPriceUpdate 為 null 時正確處理', () => {
      const assetWithNull = [{
        id: 'test-1',
        name: '現金',
        symbol: '',
        category: 'liquid',
        type: 'cash',
        quantity: 1,
        currency: 'TWD',
        pricePerUnit: 100000,
        priceSource: 'manual',
        lastPriceUpdate: null,
      }];

      saveAssets(assetWithNull);
      const loaded = loadAssets();
      expect(loaded[0].lastPriceUpdate).toBeNull();
    });

    it('Liability 的可選欄位為 undefined 時 JSON 序列化後不包含該欄位', () => {
      const liabilityWithUndefined = [{
        id: 'test-l1',
        name: '其他負債',
        category: 'other',
        amount: 50000,
        currency: 'TWD',
      }];

      saveLiabilities(liabilityWithUndefined);
      const loaded = loadLiabilities();

      // undefined 欄位在 JSON 序列化後不存在
      expect(loaded[0].id).toBe('test-l1');
      expect(loaded[0].name).toBe('其他負債');
      expect(loaded[0].interestRate).toBeUndefined();
      expect(loaded[0].terms).toBeUndefined();
    });

    it('空陣列資料正確處理', () => {
      saveAssets([]);
      saveLiabilities([]);
      saveSnapshots([]);

      expect(loadAssets()).toEqual([]);
      expect(loadLiabilities()).toEqual([]);
      expect(loadSnapshots()).toEqual([]);
    });
  });
});
