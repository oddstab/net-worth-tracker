/**
 * Price Provider Registry — 負責註冊、管理與查詢已註冊 Price Provider 實例。
 *
 * 註冊時驗證 Provider 是否實作所有必要方法，
 * 缺少時拋出包含缺失方法名稱的錯誤訊息。
 */

/** 所有 Price Provider 必須實作的方法清單 */
const REQUIRED_METHODS = ['fetchPrices', 'getProviderType', 'getName', 'isAvailable'];

export class PriceProviderRegistry {
  constructor() {
    /** @type {Map<string, import('./interface.js').PriceProviderInterface>} */
    this.providers = new Map();
  }

  /**
   * 註冊一個 Price Provider。
   * 驗證該 Provider 是否實作所有必要方法，缺少時拋出錯誤。
   * @param {import('./interface.js').PriceProviderInterface} provider
   */
  register(provider) {
    for (const method of REQUIRED_METHODS) {
      if (typeof provider[method] !== 'function') {
        throw new Error(
          `Provider "${provider.constructor?.name || 'Unknown'}" 缺少必要方法: ${method}`
        );
      }
    }
    this.providers.set(provider.getProviderType(), provider);
  }

  /**
   * 依資產類型查詢對應的已註冊提供者。
   * @param {string} assetType - 資產類型（如 'tw_stock'、'crypto'）
   * @returns {import('./interface.js').PriceProviderInterface | null}
   */
  getProviderByType(assetType) {
    return this.providers.get(assetType) || null;
  }

  /**
   * 回傳所有已註冊的提供者清單。
   * @returns {import('./interface.js').PriceProviderInterface[]}
   */
  getAllProviders() {
    return Array.from(this.providers.values());
  }
}

/** 全域 Registry 單例 */
export const registry = new PriceProviderRegistry();
