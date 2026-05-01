/**
 * CoinGecko Price Provider — 加密貨幣價格提供者。
 *
 * 實作 PriceProviderInterface，從 CoinGecko API（api.coingecko.com）
 * 批次抓取加密貨幣的 TWD 價格。
 * 內建 20 種主流幣種的 symbol → coinId 對照表。
 */
import { PriceProviderInterface } from './interface.js';

/** 主流加密貨幣 symbol → CoinGecko coinId 對照表 */
const CRYPTO_ID_MAP = {
  'BTC': 'bitcoin',
  'ETH': 'ethereum',
  'USDT': 'tether',
  'USDC': 'usd-coin',
  'BNB': 'binancecoin',
  'SOL': 'solana',
  'XRP': 'ripple',
  'ADA': 'cardano',
  'AVAX': 'avalanche-2',
  'DOGE': 'dogecoin',
  'DOT': 'polkadot',
  'LINK': 'chainlink',
  'MATIC': 'matic-network',
  'UNI': 'uniswap',
  'LTC': 'litecoin',
  'DAI': 'dai',
  'SHIB': 'shiba-inu',
  'TRX': 'tron',
  'XLM': 'stellar',
  'XMR': 'monero',
};

export class CoinGeckoPriceProvider extends PriceProviderInterface {
  /**
   * 回傳此提供者對應的資產類型。
   * @returns {string}
   */
  getProviderType() {
    return 'crypto';
  }

  /**
   * 回傳提供者名稱。
   * @returns {string}
   */
  getName() {
    return 'CoinGecko';
  }

  /**
   * 檢查 CoinGecko API 是否可用。
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    try {
      const res = await fetch('https://api.coingecko.com/api/v3/ping');
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * 批次抓取加密貨幣 TWD 價格。
   * @param {string[]} symbols - 加密貨幣代號陣列（如 ['BTC', 'ETH']）
   * @returns {Promise<Map<string, import('./interface.js').PriceResult>>}
   */
  async fetchPrices(symbols) {
    const results = new Map();
    const coinIds = symbols
      .map(s => CRYPTO_ID_MAP[s.toUpperCase()])
      .filter(Boolean);

    if (coinIds.length === 0) return results;

    try {
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinIds.join(',')}&vs_currencies=twd`;
      const res = await fetch(url);
      if (!res.ok) return results;

      const data = await res.json();

      for (const symbol of symbols) {
        const coinId = CRYPTO_ID_MAP[symbol.toUpperCase()];
        if (coinId && data[coinId]?.twd) {
          results.set(symbol, {
            price: data[coinId].twd,
            currency: 'TWD',
            timestamp: new Date().toISOString()
          });
        }
      }
    } catch {
      /* 靜默失敗，保留空結果 */
    }

    return results;
  }
}
