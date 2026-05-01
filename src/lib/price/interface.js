/**
 * Price Provider Interface — 定義所有價格提供者必須實作的合約。
 *
 * 設計理念：類似 C# 的 interface，以 JavaScript class 定義抽象方法，
 * 具體實作者繼承此 class 並覆寫所有方法。
 */
export class PriceProviderInterface {
  /**
   * 批次抓取價格。
   * @param {string[]} symbols - 資產代號陣列
   * @returns {Promise<Map<string, PriceResult>>}
   */
  async fetchPrices(symbols) {
    throw new Error('fetchPrices() must be implemented');
  }

  /**
   * 回傳此提供者對應的資產類型。
   * @returns {string} 例如 'tw_stock' 或 'crypto'
   */
  getProviderType() {
    throw new Error('getProviderType() must be implemented');
  }

  /**
   * 回傳提供者名稱。
   * @returns {string}
   */
  getName() {
    throw new Error('getName() must be implemented');
  }

  /**
   * 檢查提供者是否可用。
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    throw new Error('isAvailable() must be implemented');
  }
}

/**
 * @typedef {Object} PriceResult
 * @property {number} price - 價格
 * @property {string} currency - 幣別（'TWD' | 'USD'）
 * @property {string} timestamp - ISO 時間戳
 */
