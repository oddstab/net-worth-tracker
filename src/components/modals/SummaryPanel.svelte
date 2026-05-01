<!--
  SummaryPanel.svelte — 股票/加密貨幣摘要面板

  顯示即時價格、漲跌幅、高低、成交量、ETF/公司基本資料（台股）
  或 TWD/USD 價格、24h 漲跌幅、市值、幣種簡介（加密貨幣）。
  所有文字使用 t() 翻譯函式。
-->
<script>
  import { createEventDispatcher } from 'svelte';
  import { t } from '$lib/services/i18n.js';
  import { tStore } from '$lib/services/i18n.js';
  import {
    getTWStockDetail,
    getCryptoDetail,
    getStockCompanyInfo,
    getMonthlyChange,
  } from '$lib/services/searchService.js';

  const dispatch = createEventDispatcher();

  /** 資產類型：'tw_stock' | 'crypto' */
  export let assetType = 'tw_stock';

  /** 股票代號 */
  export let symbol = '';

  /** CoinGecko coin ID（加密貨幣用） */
  export let coinId = '';

  /** 是否正在載入 */
  let loading = false;

  /** 台股詳細資料 */
  let stockDetail = null;

  /** 公司基本資料 */
  let companyInfo = null;

  /** 月漲幅資料 */
  let monthlyData = null;

  /** 加密貨幣詳細資料 */
  let cryptoDetail = null;

  /** 是否有錯誤 */
  let hasError = false;

  /* 訂閱 tStore 以在語言切換時觸發重新渲染 */
  $: _t = $tStore;

  /**
   * 載入摘要資料。
   * 由父元件呼叫。
   */
  export async function loadSummary() {
    loading = true;
    hasError = false;
    stockDetail = null;
    companyInfo = null;
    monthlyData = null;
    cryptoDetail = null;

    try {
      if (assetType === 'tw_stock') {
        const [detail, company, monthly] = await Promise.all([
          getTWStockDetail(symbol),
          getStockCompanyInfo(symbol),
          getMonthlyChange(symbol),
        ]);
        stockDetail = detail;
        companyInfo = company;
        monthlyData = monthly;

        if (!detail) {
          hasError = true;
        } else if (detail.price != null) {
          dispatch('priceLoaded', { price: detail.price, currency: 'TWD' });
        }
      } else {
        const detail = await getCryptoDetail(coinId || symbol.toLowerCase());
        cryptoDetail = detail;

        if (!detail) {
          hasError = true;
        } else if (detail.priceTWD != null) {
          dispatch('priceLoaded', { price: detail.priceTWD, currency: 'TWD' });
        }
      }
    } catch {
      hasError = true;
    } finally {
      loading = false;
    }
  }

  /** 套用價格至表單 */
  function applyPrice(price) {
    dispatch('applyPrice', { price, currency: 'TWD' });
  }

  // ─── 格式化輔助函式 ──────────────────────────────────────────────────────

  /** 格式化 NTD 價格 */
  function fmtPrice(n) {
    if (n == null) return '--';
    return `NT$${n.toFixed(2)}`;
  }

  /** 格式化 NTD 金額（含小數） */
  function fmtNTD(n) {
    if (n == null) return '--';
    return `NT$${n.toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  /** 格式化 USD 金額 */
  function fmtUSD(n) {
    if (n == null) return '--';
    return `$${n.toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  /** 格式化漲跌幅百分比 */
  function fmtChange(n) {
    if (n == null) return '--';
    return (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
  }

  /** 格式化市值 */
  function fmtMarketCap(n) {
    if (!n) return '--';
    if (n >= 1e12) return `NT$${(n / 1e12).toFixed(2)} 兆`;
    if (n >= 1e8) return `NT$${(n / 1e8).toFixed(1)} 億`;
    return `NT$${n.toLocaleString('zh-TW')}`;
  }

  /** 格式化公司資本額 */
  function fmtCapital(val) {
    const num = parseInt((val || '').replace(/,/g, '') || '0');
    if (num >= 1e8) return `${(num / 1e8).toFixed(1)} 億元`;
    if (num > 0) return `${num.toLocaleString('zh-TW')} 元`;
    return '';
  }

  /** 格式化已發行股數 */
  function fmtShares(val) {
    const num = parseInt((val || '').replace(/,/g, '') || '0');
    if (num >= 1e8) return `${(num / 1e8).toFixed(2)} 億股`;
    if (num > 0) return `${num.toLocaleString('zh-TW')} 股`;
    return '';
  }

  /** 格式化上市日期 */
  function fmtListedDate(val) {
    return (val || '').replace(/(\d{4})(\d{2})(\d{2})/, '$1/$2/$3');
  }

  /** 取得漲跌 CSS class */
  function changeClass(val) {
    if (val == null) return '';
    return val >= 0 ? 'positive' : 'negative';
  }
</script>

<div class="summary-panel" id="asset-summary-panel">
  {#if loading}
    <!-- 載入中 -->
    <div class="summary-loading">
      <div class="summary-spinner"></div>
      <span>{t('common.loading')}</span>
    </div>

  {:else if hasError}
    <!-- 錯誤 -->
    <div class="summary-error">{t('summary.errorLoadData')}</div>

  {:else if stockDetail}
    <!-- 台股摘要 -->
    <div class="summary-header">
      <div class="summary-title-row">
        <span class="summary-symbol">{stockDetail.symbol}</span>
        <span class="summary-exchange-badge">{stockDetail.exchange}</span>
        {#if stockDetail.isHistorical && stockDetail.priceDate}
          <span class="summary-hist-badge">{t('summary.closingPrice')} {stockDetail.priceDate}</span>
        {/if}
      </div>
      <div class="summary-name">{stockDetail.name}</div>
    </div>

    <div class="summary-price-block">
      <div class="summary-price-left">
        <div class="summary-price">{fmtPrice(stockDetail.price)}</div>
        <div class="summary-change {changeClass(stockDetail.change)}">
          {#if stockDetail.change != null}
            {stockDetail.change >= 0 ? '+' : ''}{stockDetail.change.toFixed(2)}
            ({fmtChange(stockDetail.changePercent)})
          {:else}
            --
          {/if}
        </div>
      </div>
      {#if monthlyData && monthlyData.monthChangePercent != null}
        <div class="summary-monthly">
          <div class="summary-monthly-label">{t('summary.monthlyChange')}</div>
          <div class="summary-monthly-value {changeClass(monthlyData.monthChangePercent)}">
            {monthlyData.monthChange >= 0 ? '+' : ''}{monthlyData.monthChange.toFixed(2)}
            ({monthlyData.monthChangePercent >= 0 ? '+' : ''}{monthlyData.monthChangePercent.toFixed(2)}%)
          </div>
        </div>
      {/if}
    </div>

    <div class="summary-stats">
      <div class="summary-stat">
        <span class="ss-label">{t('summary.todayHigh')}</span>
        <span class="ss-value">{fmtPrice(stockDetail.high)}</span>
      </div>
      <div class="summary-stat">
        <span class="ss-label">{t('summary.todayLow')}</span>
        <span class="ss-value">{fmtPrice(stockDetail.low)}</span>
      </div>
      <div class="summary-stat">
        <span class="ss-label">{t('summary.volume')}</span>
        <span class="ss-value">{stockDetail.volume || '--'}</span>
      </div>
      <div class="summary-stat">
        <span class="ss-label">{t('summary.type')}</span>
        <span class="ss-value">{stockDetail.type}</span>
      </div>
    </div>

    <!-- ETF 資訊 -->
    {#if stockDetail.etfMeta}
      <div class="summary-etf-section">
        {#if stockDetail.etfMeta.feature}
          <div class="summary-etf-feature">
            <div class="summary-desc-title">{t('summary.holdingFeature')}</div>
            <p class="summary-etf-feature-text">{stockDetail.etfMeta.feature}</p>
          </div>
        {/if}
        <table class="summary-etf-table">
          {#if stockDetail.etfMeta.aum}
            <tr><td>{t('summary.aum')}</td><td>{stockDetail.etfMeta.aum}</td></tr>
          {/if}
          {#if stockDetail.etfMeta.yearsListed}
            <tr><td>{t('summary.yearsListed')}</td><td>{stockDetail.etfMeta.yearsListed}</td></tr>
          {/if}
          {#if stockDetail.etfMeta.expenseRatio}
            <tr><td>{t('summary.expenseRatio')}</td><td>{stockDetail.etfMeta.expenseRatio}</td></tr>
          {/if}
          {#if stockDetail.etfMeta.holders}
            <tr><td>{t('summary.holders')}</td><td>{stockDetail.etfMeta.holders}</td></tr>
          {/if}
          {#if stockDetail.etfMeta.dividendCycle}
            <tr><td>{t('summary.dividendCycle')}</td><td>{stockDetail.etfMeta.dividendCycle}</td></tr>
          {/if}
          {#if stockDetail.etfMeta.fundType}
            <tr><td>{t('summary.fundType')}</td><td>{stockDetail.etfMeta.fundType}</td></tr>
          {/if}
          {#if stockDetail.etfMeta.indexCurrency}
            <tr><td>{t('summary.indexCurrency')}</td><td>{stockDetail.etfMeta.indexCurrency}</td></tr>
          {/if}
          {#if stockDetail.etfMeta.trackIndex}
            <tr><td>{t('summary.trackIndex')}</td><td>{stockDetail.etfMeta.trackIndex}</td></tr>
          {/if}
          {#if stockDetail.etfMeta.fundName}
            <tr><td>{t('summary.fundName')}</td><td class="td-wrap">{stockDetail.etfMeta.fundName}</td></tr>
          {/if}
        </table>
      </div>

    <!-- 公司基本資料 -->
    {:else if companyInfo}
      <div class="summary-etf-section">
        <table class="summary-etf-table">
          {#if companyInfo.industry}
            <tr><td>{t('summary.industry')}</td><td>{companyInfo.industry}</td></tr>
          {/if}
          {#if fmtCapital(companyInfo.capital)}
            <tr><td>{t('summary.capital')}</td><td>{fmtCapital(companyInfo.capital)}</td></tr>
          {/if}
          {#if fmtShares(companyInfo.shares)}
            <tr><td>{t('summary.shares')}</td><td>{fmtShares(companyInfo.shares)}</td></tr>
          {/if}
          {#if companyInfo.listedDate}
            <tr><td>{t('summary.listedDate')}</td><td>{fmtListedDate(companyInfo.listedDate)}</td></tr>
          {/if}
          {#if companyInfo.chairman}
            <tr><td>{t('summary.chairman')}</td><td>{companyInfo.chairman}</td></tr>
          {/if}
          {#if companyInfo.ceo}
            <tr><td>{t('summary.ceo')}</td><td>{companyInfo.ceo}</td></tr>
          {/if}
          {#if companyInfo.website}
            <tr>
              <td>{t('summary.website')}</td>
              <td>
                <a
                  href={companyInfo.website}
                  target="_blank"
                  rel="noopener"
                  style="color:var(--accent-color);word-break:break-all;"
                >{companyInfo.website.replace(/^https?:\/\//, '')}</a>
              </td>
            </tr>
          {/if}
        </table>
      </div>
    {/if}

    <!-- 套用價格按鈕 -->
    {#if stockDetail.price != null}
      <button class="btn btn-primary summary-apply-btn" on:click={() => applyPrice(stockDetail.price)}>
        {t('asset.applyPrice', { price: fmtPrice(stockDetail.price) })}
      </button>
    {/if}

  {:else if cryptoDetail}
    <!-- 加密貨幣摘要 -->
    <div class="summary-header">
      <div class="summary-title-row">
        <span class="summary-symbol">{cryptoDetail.symbol}</span>
        <span class="summary-exchange-badge crypto-badge">Crypto</span>
      </div>
      <div class="summary-name">{cryptoDetail.name}</div>
      {#if cryptoDetail.category}
        <div class="summary-category-tag">{cryptoDetail.category}</div>
      {/if}
    </div>

    <div class="summary-price-block">
      <div class="summary-price">{fmtNTD(cryptoDetail.priceTWD)}</div>
      <div class="summary-price-usd">{fmtUSD(cryptoDetail.priceUSD)}</div>
      <div class="summary-change {changeClass(cryptoDetail.change24h)}">
        24h {fmtChange(cryptoDetail.change24h)}
      </div>
    </div>

    <div class="summary-stats">
      <div class="summary-stat summary-stat--full">
        <span class="ss-label">{t('summary.marketCap')}</span>
        <span class="ss-value">{fmtMarketCap(cryptoDetail.marketCapTWD)}</span>
      </div>
    </div>

    {#if cryptoDetail.description}
      <div class="summary-description">
        <div class="summary-desc-title">{t('summary.description')}</div>
        <p class="summary-desc-text">{cryptoDetail.description}</p>
      </div>
    {/if}

    <!-- 套用價格按鈕 -->
    {#if cryptoDetail.priceTWD != null}
      <button class="btn btn-primary summary-apply-btn" on:click={() => applyPrice(cryptoDetail.priceTWD)}>
        {t('asset.applyPrice', { price: fmtNTD(cryptoDetail.priceTWD) })}
      </button>
    {/if}

  {:else}
    <!-- 預設提示 -->
    <div class="summary-placeholder">
      <span>{t('asset.searchHint')}</span>
    </div>
  {/if}
</div>
