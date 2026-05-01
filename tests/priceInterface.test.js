/**
 * priceInterface.test.js — Price Provider 介面合約測試
 *
 * 包含屬性測試（Property-Based Tests）與單元測試，
 * 驗證 Provider Registry 合約驗證、Price Fetcher 去重與多型路由。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { PriceProviderRegistry } from '../src/lib/price/registry.js';
import { PriceProviderInterface } from '../src/lib/price/interface.js';
import { fetchAllPrices } from '../src/lib/price/priceFetcher.js';

// ─── 測試用 Mock Provider ──────────────────────────────────────────────────────

/**
 * 建立一個有效的 Mock Provider。
 * @param {string} type - 提供者類型
 * @param {string} name - 提供者名稱
 * @param {Function} [onFetchPrices] - 自訂 fetchPrices 行為
 * @returns {object}
 */
function createMockProvider(type, name, onFetchPrices) {
  return {
    getProviderType() { return type; },
    getName() { return name; },
    async isAvailable() { return true; },
    async fetchPrices(symbols) {
      if (onFetchPrices) return onFetchPrices(symbols);
      const results = new Map();
      for (const s of symbols) {
        results.set(s, { price: 100, currency: 'TWD', timestamp: new Date().toISOString() });
      }
      return results;
    }
  };
}

// ─── 必要方法清單 ──────────────────────────────────────────────────────────────

const REQUIRED_METHODS = ['fetchPrices', 'getProviderType', 'getName', 'isAvailable'];

// ═══════════════════════════════════════════════════════════════════════════════
// Property 10: Provider Registry 合約驗證
// **Validates: Requirements 8.7**
// ═══════════════════════════════════════════════════════════════════════════════

describe('Feature: sveltekit-spa-migration, Property 10: Provider Registry 合約驗證', () => {
  it('缺少任一必要方法時 register() 應拋出包含方法名稱的錯誤', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...REQUIRED_METHODS),
        (missingMethod) => {
          const registry = new PriceProviderRegistry();

          // 建立完整的 provider 物件，然後移除一個方法
          const provider = {
            fetchPrices: async () => new Map(),
            getProviderType: () => 'test',
            getName: () => 'Test',
            isAvailable: async () => true,
          };

          // 移除指定方法
          delete provider[missingMethod];

          // 註冊應拋出錯誤，且錯誤訊息包含缺失的方法名稱
          try {
            registry.register(provider);
            return false; // 不應到達此處
          } catch (e) {
            return e.message.includes(missingMethod);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('方法為非函式值時 register() 也應拋出錯誤', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...REQUIRED_METHODS),
        fc.constantFrom(null, undefined, 42, 'not_a_function', true, {}, []),
        (method, nonFnValue) => {
          const registry = new PriceProviderRegistry();

          const provider = {
            fetchPrices: async () => new Map(),
            getProviderType: () => 'test',
            getName: () => 'Test',
            isAvailable: async () => true,
          };

          // 將指定方法設為非函式值
          provider[method] = nonFnValue;

          try {
            registry.register(provider);
            return false;
          } catch (e) {
            return e.message.includes(method);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Property 11: Price Fetcher 去重
// **Validates: Requirements 8.13**
// ═══════════════════════════════════════════════════════════════════════════════

describe('Feature: sveltekit-spa-migration, Property 11: Price Fetcher 去重', () => {
  it('相同 symbol+type 的重複資產只觸發一次 fetchPrices 呼叫（每個 unique symbol 只出現一次）', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.uuid(),
            symbol: fc.constantFrom('2330', '2317', '0050', 'BTC', 'ETH'),
            type: fc.constantFrom('tw_stock', 'crypto'),
            name: fc.string({ minLength: 1, maxLength: 10 }),
            pricePerUnit: fc.double({ min: 0.01, max: 99999, noNaN: true }),
            currency: fc.constantFrom('TWD', 'USD'),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        async (assets) => {
          // 追蹤每個 provider 收到的 symbols
          /** @type {Map<string, string[]>} type → symbols[] */
          const fetchCalls = new Map();

          const testRegistry = new PriceProviderRegistry();

          // 取得資產中出現的所有 type
          const types = [...new Set(assets.map(a => a.type))];

          for (const type of types) {
            fetchCalls.set(type, []);
            const provider = createMockProvider(type, `Mock_${type}`, (symbols) => {
              fetchCalls.get(type).push(...symbols);
              const results = new Map();
              for (const s of symbols) {
                results.set(s, { price: 100, currency: 'TWD', timestamp: new Date().toISOString() });
              }
              return results;
            });
            testRegistry.register(provider);
          }

          await fetchAllPrices(assets, testRegistry);

          // 驗證：每個 type 的 fetchPrices 收到的 symbols 數量等於去重後的數量
          for (const [type, receivedSymbols] of fetchCalls) {
            const expectedUniqueSymbols = [...new Set(
              assets.filter(a => a.type === type && a.symbol).map(a => a.symbol)
            )];

            // 收到的 symbols 數量應等於去重後的數量
            if (receivedSymbols.length !== expectedUniqueSymbols.length) return false;

            // 收到的 symbols 集合應等於去重後的集合
            const receivedSet = new Set(receivedSymbols);
            const expectedSet = new Set(expectedUniqueSymbols);
            if (receivedSet.size !== expectedSet.size) return false;
            for (const s of receivedSet) {
              if (!expectedSet.has(s)) return false;
            }
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Property 12: Price Fetcher 多型路由
// **Validates: Requirements 8.12, 8.19, 8.20**
// ═══════════════════════════════════════════════════════════════════════════════

describe('Feature: sveltekit-spa-migration, Property 12: Price Fetcher 多型路由', () => {
  /** 產生隨機資產類型字串 */
  const arbAssetType = fc.stringOf(
    fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz_'.split('')),
    { minLength: 1, maxLength: 12 }
  );

  /** 產生隨機 symbol 字串 */
  const arbSymbol = fc.stringOf(
    fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('')),
    { minLength: 1, maxLength: 8 }
  );

  it('資產根據 type 路由至對應的 Provider', async () => {
    await fc.assert(
      fc.asyncProperty(
        // 產生 1~4 種不同的 provider type
        fc.uniqueArray(arbAssetType, { minLength: 1, maxLength: 4 }),
        // 產生資產陣列
        fc.array(
          fc.record({
            id: fc.uuid(),
            symbol: arbSymbol,
            name: fc.string({ minLength: 1, maxLength: 10 }),
            pricePerUnit: fc.double({ min: 0.01, max: 99999, noNaN: true }),
            currency: fc.constantFrom('TWD', 'USD'),
          }),
          { minLength: 1, maxLength: 15 }
        ),
        async (providerTypes, baseAssets) => {
          // 追蹤每個 provider 是否被呼叫
          /** @type {Map<string, boolean>} type → 是否被呼叫 */
          const providerCalled = new Map();

          const testRegistry = new PriceProviderRegistry();

          // 註冊所有 provider types
          for (const type of providerTypes) {
            providerCalled.set(type, false);
            const provider = createMockProvider(type, `Mock_${type}`, (symbols) => {
              providerCalled.set(type, true);
              const results = new Map();
              for (const s of symbols) {
                results.set(s, { price: 42, currency: 'TWD', timestamp: new Date().toISOString() });
              }
              return results;
            });
            testRegistry.register(provider);
          }

          // 為每個資產分配一個已註冊的 type
          const assets = baseAssets.map((a, i) => ({
            ...a,
            type: providerTypes[i % providerTypes.length],
          }));

          await fetchAllPrices(assets, testRegistry);

          // 驗證：每個有資產的 type 對應的 provider 都應被呼叫
          for (const type of providerTypes) {
            const hasAssetsOfType = assets.some(a => a.type === type && a.symbol);
            if (hasAssetsOfType && !providerCalled.get(type)) return false;
            if (!hasAssetsOfType && providerCalled.get(type)) return false;
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('不同 type 的資產不會被路由至錯誤的 Provider', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uniqueArray(arbAssetType, { minLength: 2, maxLength: 4 }),
        fc.array(
          fc.record({
            id: fc.uuid(),
            symbol: arbSymbol,
            name: fc.string({ minLength: 1, maxLength: 10 }),
            pricePerUnit: fc.double({ min: 0.01, max: 99999, noNaN: true }),
            currency: fc.constantFrom('TWD', 'USD'),
          }),
          { minLength: 2, maxLength: 15 }
        ),
        async (providerTypes, baseAssets) => {
          // 追蹤每個 provider 收到的 symbols
          /** @type {Map<string, Set<string>>} type → Set<symbol> */
          const receivedByProvider = new Map();

          const testRegistry = new PriceProviderRegistry();

          for (const type of providerTypes) {
            receivedByProvider.set(type, new Set());
            const provider = createMockProvider(type, `Mock_${type}`, (symbols) => {
              for (const s of symbols) {
                receivedByProvider.get(type).add(s);
              }
              const results = new Map();
              for (const s of symbols) {
                results.set(s, { price: 99, currency: 'TWD', timestamp: new Date().toISOString() });
              }
              return results;
            });
            testRegistry.register(provider);
          }

          // 為每個資產分配 type
          const assets = baseAssets.map((a, i) => ({
            ...a,
            type: providerTypes[i % providerTypes.length],
          }));

          await fetchAllPrices(assets, testRegistry);

          // 驗證：每個 provider 只收到屬於自己 type 的 symbols
          for (const type of providerTypes) {
            const expectedSymbols = new Set(
              assets.filter(a => a.type === type && a.symbol).map(a => a.symbol)
            );
            const received = receivedByProvider.get(type);

            for (const s of received) {
              if (!expectedSymbols.has(s)) return false;
            }
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 單元測試
// ═══════════════════════════════════════════════════════════════════════════════

describe('PriceProviderRegistry 單元測試', () => {
  let registry;

  beforeEach(() => {
    registry = new PriceProviderRegistry();
  });

  it('註冊有效 Provider 後可透過 getProviderByType 查詢', () => {
    const provider = createMockProvider('tw_stock', 'TWSE');
    registry.register(provider);

    const result = registry.getProviderByType('tw_stock');
    expect(result).toBe(provider);
    expect(result.getName()).toBe('TWSE');
  });

  it('查詢不存在的類型回傳 null', () => {
    const result = registry.getProviderByType('nonexistent');
    expect(result).toBeNull();
  });

  it('getAllProviders 回傳所有已註冊的提供者', () => {
    const p1 = createMockProvider('tw_stock', 'TWSE');
    const p2 = createMockProvider('crypto', 'CoinGecko');
    registry.register(p1);
    registry.register(p2);

    const all = registry.getAllProviders();
    expect(all).toHaveLength(2);
    expect(all).toContain(p1);
    expect(all).toContain(p2);
  });

  it('註冊缺少 fetchPrices 的物件應拋出錯誤', () => {
    const invalid = {
      getProviderType: () => 'test',
      getName: () => 'Test',
      isAvailable: async () => true,
    };
    expect(() => registry.register(invalid)).toThrow('fetchPrices');
  });

  it('註冊缺少 getProviderType 的物件應拋出錯誤', () => {
    const invalid = {
      fetchPrices: async () => new Map(),
      getName: () => 'Test',
      isAvailable: async () => true,
    };
    expect(() => registry.register(invalid)).toThrow('getProviderType');
  });

  it('註冊缺少 getName 的物件應拋出錯誤', () => {
    const invalid = {
      fetchPrices: async () => new Map(),
      getProviderType: () => 'test',
      isAvailable: async () => true,
    };
    expect(() => registry.register(invalid)).toThrow('getName');
  });

  it('註冊缺少 isAvailable 的物件應拋出錯誤', () => {
    const invalid = {
      fetchPrices: async () => new Map(),
      getProviderType: () => 'test',
      getName: () => 'Test',
    };
    expect(() => registry.register(invalid)).toThrow('isAvailable');
  });

  it('相同 type 的 Provider 會覆蓋先前註冊的', () => {
    const p1 = createMockProvider('tw_stock', 'Provider1');
    const p2 = createMockProvider('tw_stock', 'Provider2');
    registry.register(p1);
    registry.register(p2);

    const result = registry.getProviderByType('tw_stock');
    expect(result.getName()).toBe('Provider2');
    expect(registry.getAllProviders()).toHaveLength(1);
  });
});

describe('PriceProviderInterface 單元測試', () => {
  it('直接呼叫抽象方法應拋出錯誤', async () => {
    const base = new PriceProviderInterface();
    await expect(base.fetchPrices([])).rejects.toThrow('fetchPrices() must be implemented');
    expect(() => base.getProviderType()).toThrow('getProviderType() must be implemented');
    expect(() => base.getName()).toThrow('getName() must be implemented');
    await expect(base.isAvailable()).rejects.toThrow('isAvailable() must be implemented');
  });
});

describe('fetchAllPrices 單元測試', () => {
  it('無 symbol 的資產不觸發 API 呼叫', async () => {
    const testRegistry = new PriceProviderRegistry();
    let called = false;
    const provider = createMockProvider('cash', 'Cash', () => {
      called = true;
      return new Map();
    });
    testRegistry.register(provider);

    const assets = [
      { id: '1', type: 'cash', name: '現金', pricePerUnit: 1, currency: 'TWD' }
    ];

    const result = await fetchAllPrices(assets, testRegistry);
    expect(called).toBe(false);
    expect(result).toHaveLength(1);
  });

  it('無對應 Provider 的資產類型不觸發錯誤', async () => {
    const testRegistry = new PriceProviderRegistry();

    const assets = [
      { id: '1', type: 'unknown_type', symbol: 'XYZ', name: '未知', pricePerUnit: 0, currency: 'TWD' }
    ];

    const result = await fetchAllPrices(assets, testRegistry);
    expect(result).toHaveLength(1);
    expect(result[0].pricePerUnit).toBe(0);
  });

  it('成功抓取價格後更新資產的 pricePerUnit、priceSource、lastPriceUpdate', async () => {
    const testRegistry = new PriceProviderRegistry();
    const provider = createMockProvider('tw_stock', 'TWSE', (symbols) => {
      const results = new Map();
      results.set('2330', { price: 580, currency: 'TWD', timestamp: new Date().toISOString() });
      return results;
    });
    testRegistry.register(provider);

    const assets = [
      { id: '1', type: 'tw_stock', symbol: '2330', name: '台積電', pricePerUnit: 500, currency: 'TWD' }
    ];

    const result = await fetchAllPrices(assets, testRegistry);
    expect(result[0].pricePerUnit).toBe(580);
    expect(result[0].priceSource).toBe('auto');
    expect(result[0].lastPriceUpdate).toBeTruthy();
  });
});
