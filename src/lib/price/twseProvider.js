/**
 * TWSE Price Provider — 台股價格提供者。
 *
 * 實作 PriceProviderInterface，從 TWSE 即時 API（mis.twse.com.tw）
 * 抓取台股價格，依序嘗試上市（tse）與上櫃（otc）市場。
 * 即時 API 無資料時，回退至 searchService 的每日收盤價。
 */
import { PriceProviderInterface } from './interface.js';

export class TWSEPriceProvider extends PriceProviderInterface {
  /**
   * 回傳此提供者對應的資產類型。
   * @returns {string}
   */
  getProviderType() {
    return 'tw_stock';
  }

  /**
   * 回傳提供者名稱。
   * @returns {string}
   */
  getName() {
    return 'TWSE';
  }

  /**
   * 檢查 TWSE API 是否可用。
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    try {
      const res = await fetch(
        'https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=tse_2330.tw&json=1&delay=0'
      );
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * 批次抓取台股價格。
   * @param {string[]} symbols - 股票代號陣列
   * @returns {Promise<Map<string, import('./interface.js').PriceResult>>}
   */
  async fetchPrices(symbols) {
    const results = new Map();
    for (const symbol of symbols) {
      const price = await this._fetchSingle(symbol);
      if (price !== null) {
        results.set(symbol, {
          price,
          currency: 'TWD',
          timestamp: new Date().toISOString()
        });
      }
    }
    return results;
  }

  /**
   * 抓取單一股票價格，依序嘗試：
   * 1. 即時 API（上市 tse → 上櫃 otc）
   * 2. searchService 的 getTWStockDetail（每日收盤價）
   * @param {string} symbol - 股票代號
   * @returns {Promise<number | null>}
   * @private
   */
  async _fetchSingle(symbol) {
    // 1. 嘗試即時 API
    for (const market of ['tse', 'otc']) {
      try {
        const url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=${market}_${encodeURIComponent(symbol)}.tw&json=1&delay=0`;
        const res = await fetch(url);
        if (!res.ok) continue;

        const data = await res.json();
        const info = data?.msgArray?.[0];
        if (!info) continue;

        // 依序嘗試：最新成交價 → 昨收價 → 開盤價 → 最佳買價 → 最佳賣價
        let price = info.z;
        if (!price || price === '-') price = info.y;
        if (!price || price === '-') price = info.o;
        if (!price || price === '-') price = info.b;
        if (!price || price === '-') price = info.a;

        if (price && price !== '-') {
          const parsed = parseFloat(price);
          if (!isNaN(parsed) && parsed > 0) return parsed;
        }
      } catch {
        continue;
      }
    }

    // 2. 回退至 searchService 的每日收盤價
    try {
      const { getTWStockDetail } = await import('$lib/services/searchService.js');
      const detail = await getTWStockDetail(symbol);
      if (detail?.price) {
        return detail.price;
      }
    } catch { /* ignore */ }

    return null;
  }
}
