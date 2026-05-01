<!--
  AssetModal.svelte — 新增/編輯資產 Modal

  表單欄位：類型、分類、代號/搜尋、名稱、數量、幣別、每單位價格。
  整合 SearchDropdown 與 SummaryPanel。
  手機底部滑入動畫，桌面居中顯示。
  所有文字使用 t() 翻譯函式。
-->
<script>
  import { createEventDispatcher } from 'svelte';
  import { t } from '$lib/services/i18n.js';
  import { tStore } from '$lib/services/i18n.js';
  import { assets } from '$lib/stores/assets.js';
  import { validateQuantity, validatePrice } from '$lib/utils/calculator.js';
  import { lockScroll, unlockScroll } from '$lib/utils/scrollLock.js';
  import { showToast } from '$lib/stores/toast.js';
  import SearchDropdown from './SearchDropdown.svelte';
  import SummaryPanel from './SummaryPanel.svelte';
  import Icon from '../Icon.svelte';

  const dispatch = createEventDispatcher();

  /** 編輯中的資產（null 表示新增模式） */
  export let asset = null;

  /** 預填資料（針對已存在資產新增，鎖定類型/分類/代號/名稱） */
  export let preset = null;

  /** 是否為編輯模式 */
  $: isEdit = asset !== null;

  /** 是否有預填（鎖定欄位但仍為新增模式） */
  $: isPreset = preset !== null;

  /** 欄位是否應鎖定（編輯或預填時） */
  $: isLocked = isEdit || isPreset;

  /* 訂閱 tStore 以在語言切換時觸發重新渲染 */
  $: _t = $tStore;

  // ─── 表單欄位 ──────────────────────────────────────────────────────────

  let type = asset?.type || preset?.type || 'tw_stock';
  let category = asset?.category || preset?.category || 'investment';
  let symbolValue = asset?.symbol || preset?.symbol || '';
  let name = asset?.name || preset?.name || '';
  let quantity = asset?.quantity ?? '';
  let currency = asset?.currency || 'TWD';
  let pricePerUnit = asset?.pricePerUnit ?? '';
  let avgCost = asset?.avgCost ?? '';

  // ─── 錯誤訊息 ──────────────────────────────────────────────────────────

  let nameError = '';
  let quantityError = '';
  let priceError = '';

  // ─── 摘要面板 ──────────────────────────────────────────────────────────

  /** 摘要面板是否可見 */
  let summaryVisible = (isEdit || isPreset) && symbolValue && (type === 'tw_stock' || type === 'crypto');

  /** 摘要面板元件參考 */
  let summaryPanel;

  /** 摘要面板的資產類型 */
  let summaryAssetType = type;

  /** 摘要面板的代號 */
  let summarySymbol = symbolValue;

  /** 摘要面板的 coinId */
  let summaryCoinId = '';

  // ─── 是否顯示搜尋欄位 ──────────────────────────────────────────────────

  $: showSymbolSearch = type === 'tw_stock' || type === 'crypto';

  // ─── 加密貨幣 symbol → coinId 對照 ────────────────────────────────────

  const CRYPTO_ID_MAP = {
    'BTC': 'bitcoin', 'ETH': 'ethereum', 'USDT': 'tether', 'USDC': 'usd-coin',
    'BNB': 'binancecoin', 'SOL': 'solana', 'XRP': 'ripple', 'ADA': 'cardano',
    'AVAX': 'avalanche-2', 'DOGE': 'dogecoin', 'DOT': 'polkadot', 'LINK': 'chainlink',
    'MATIC': 'matic-network', 'UNI': 'uniswap', 'LTC': 'litecoin', 'DAI': 'dai',
    'SHIB': 'shiba-inu', 'TRX': 'tron', 'XLM': 'stellar', 'XMR': 'monero',
  };

  // ─── 編輯模式自動載入摘要 ──────────────────────────────────────────────

  import { onMount, onDestroy } from 'svelte';

  // ── Modal 開啟時立即鎖定背景滾動（避免 DOM 插入後閃爍） ──
  lockScroll();
  onDestroy(() => {
    unlockScroll();
  });

  onMount(() => {
    if ((isEdit || isPreset) && symbolValue && (type === 'tw_stock' || type === 'crypto')) {
      summaryVisible = true;
      summaryAssetType = type;
      summarySymbol = symbolValue;
      summaryCoinId = type === 'crypto' ? (CRYPTO_ID_MAP[symbolValue.toUpperCase()] || symbolValue.toLowerCase()) : '';
      // 等元件掛載後載入摘要
      setTimeout(() => {
        if (summaryPanel) summaryPanel.loadSummary();
      }, 0);
    }
  });

  // ─── 事件處理 ──────────────────────────────────────────────────────────

  /** 類型變更時重置搜尋相關狀態 */
  function handleTypeChange() {
    summaryVisible = false;
    symbolValue = '';
    // 不重置 name，讓使用者可以手動輸入
  }

  /** 搜尋下拉選擇項目 */
  function handleSearchSelect(e) {
    const { symbol: sym, name: itemName, coinId, assetType: at } = e.detail;
    name = itemName;
    summaryVisible = true;
    summaryAssetType = at;
    summarySymbol = sym;
    summaryCoinId = coinId;

    // 載入摘要
    setTimeout(() => {
      if (summaryPanel) summaryPanel.loadSummary();
    }, 0);
  }

  /** 摘要面板載入價格後 — 記錄最新價格供套用按鈕使用 */
  let latestPrice = null;
  let latestPriceCurrency = 'TWD';

  function handlePriceLoaded(e) {
    const { price, currency: cur } = e.detail || {};
    if (price != null) {
      latestPrice = price;
      latestPriceCurrency = cur || 'TWD';
    }
  }

  /** 套用價格按鈕 — 使用者主動點擊才套用到平均成本 */
  function handleApplyPrice(e) {
    const { price, currency: cur } = e.detail;
    avgCost = price;
    currency = cur;
  }

  /** 關閉 Modal */
  function handleClose() {
    dispatch('close');
  }

  /** 表單提交 */
  function handleSubmit() {
    // 清除錯誤
    nameError = '';
    quantityError = '';
    priceError = '';

    // 編輯模式下，類型/代號/名稱/分類用原始值
    // 預填模式下，類型/代號/名稱/分類用 preset 值
    const finalName = isEdit ? asset.name : (isPreset ? preset.name : name.trim());
    const finalSymbol = isEdit ? (asset.symbol || '') : (isPreset ? preset.symbol : symbolValue.trim());
    const finalCategory = isEdit ? asset.category : (isPreset ? preset.category : category);
    const finalType = isEdit ? asset.type : (isPreset ? preset.type : type);
    const finalQuantity = parseFloat(quantity);
    const finalCurrency = currency;
    const finalAvgCost = parseFloat(avgCost);
    // 新增時用平均成本作為初始市場價格；編輯時不動 pricePerUnit
    const finalPrice = isEdit ? asset.pricePerUnit : (finalAvgCost || 0);

    let hasError = false;

    if (!isEdit && !isPreset && !finalName) {
      nameError = t('validation.nameRequired');
      hasError = true;
    }
    if (!validateQuantity(finalQuantity)) {
      quantityError = t('validation.quantityPositive');
      hasError = true;
    }
    if (!validatePrice(finalAvgCost)) {
      priceError = t('validation.pricePositive');
      hasError = true;
    }

    if (hasError) {
      showToast(t('validation.fillRequired'), 'error');
      return;
    }

    if (isEdit) {
      // 編輯模式：只更新數量、幣別、平均成本，不動 pricePerUnit（市場價格）
      assets.updateAsset(asset.id, {
        name: finalName,
        symbol: finalSymbol,
        category: finalCategory,
        type: finalType,
        quantity: finalQuantity,
        currency: finalCurrency,
        avgCost: finalAvgCost,
      });
    } else {
      assets.addAsset({
        id: crypto.randomUUID(),
        name: finalName,
        symbol: finalSymbol,
        category: finalCategory,
        type: finalType,
        quantity: finalQuantity,
        currency: finalCurrency,
        pricePerUnit: finalPrice,
        avgCost: finalAvgCost,
        priceSource: 'manual',
        lastPriceUpdate: null,
      });
    }

    dispatch('close');
  }
</script>

<svelte:window on:keydown={(e) => { if (e.key === 'Escape') handleClose(); }} />

<!-- 背景遮罩（禁止點擊外部關閉） -->
<div class="modal-overlay" role="presentation">
  <!-- Modal 本體 -->
  <div
    class="modal"
    class:modal--wide={summaryVisible}
    role="dialog"
    aria-modal="true"
    aria-labelledby="asset-modal-title"
  >
    <div class="modal-header">
      <h2 class="modal-title" id="asset-modal-title">
        {isEdit ? t('asset.editAsset') : t('asset.addAsset')}
        {#if isPreset}
          <span style="font-size: var(--font-size-sm); color: var(--text-secondary); font-weight: 400;">— {preset.symbol} {preset.name}</span>
        {/if}
      </h2>
      <button class="modal-close" on:click={handleClose} aria-label={t('common.close')}><Icon name="x" size={18}/></button>
    </div>

    <div class="modal-body">
      <div class="asset-modal-layout">
        <!-- 左側表單 -->
        <div class="asset-form-col">
          <form id="asset-form" novalidate autocomplete="off" on:submit|preventDefault={handleSubmit}>
            <!-- 已選資產資訊 + 套用價格（新增模式，選擇代號後顯示） -->
            {#if !isEdit && symbolValue && name}
              <div class="selected-asset-bar">
                <div class="selected-asset-info">
                  <span class="selected-asset-symbol">{symbolValue}</span>
                  <span class="selected-asset-name">{name}</span>
                </div>
                {#if latestPrice != null}
                  <button type="button" class="btn btn-primary btn-apply-price" on:click={() => { avgCost = latestPrice; currency = latestPriceCurrency; }}>
                    {t('asset.applyPrice', { price: latestPrice.toLocaleString('zh-TW') })}
                  </button>
                {/if}
              </div>
            {/if}

            <!-- 類型 + 分類 -->
            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="asset-type">
                  {t('asset.type')}
                  {#if isLocked}🔒{/if}
                </label>
                <select
                  class="form-input"
                  id="asset-type"
                  bind:value={type}
                  on:change={handleTypeChange}
                  disabled={isLocked}
                >
                  <option value="tw_stock">{t('asset.twStock')}</option>
                  <option value="crypto">{t('asset.crypto')}</option>
                  <option value="cash">{t('asset.cash')}</option>
                  <option value="other">{t('asset.other')}</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label" for="asset-category">
                  {t('asset.category')}
                  {#if isLocked}🔒{/if}
                </label>
                <select class="form-input" id="asset-category" bind:value={category} disabled={isLocked}>
                  <option value="investment">{t('asset.investment')}</option>
                  <option value="liquid">{t('asset.liquid')}</option>
                </select>
              </div>
            </div>

            <!-- 代號搜尋（僅台股/加密貨幣） -->
            {#if showSymbolSearch}
              <SearchDropdown
                assetType={type}
                bind:value={symbolValue}
                disabled={isLocked}
                on:select={handleSearchSelect}
              />
            {/if}

            <!-- 名稱（僅編輯模式顯示，新增時由搜尋自動帶入） -->
            {#if isEdit}
            <div class="form-group">
              <label class="form-label" for="asset-name">
                {t('asset.name')} 🔒
              </label>
              <input
                class="form-input"
                type="text"
                id="asset-name"
                bind:value={name}
                autocomplete="off"
                required
                disabled
              />
            </div>
            {/if}

            <!-- 數量 -->
            <div class="form-group">
              <label class="form-label" for="asset-quantity">
                {t('asset.quantity')} <span class="required">*</span>
              </label>
              <input
                class="form-input"
                type="number"
                id="asset-quantity"
                bind:value={quantity}
                min="0"
                step={type === 'tw_stock' ? '1' : 'any'}
                autocomplete="off"
                required
              />
              {#if quantityError}
                <span class="form-error">{quantityError}</span>
              {/if}
            </div>

            <!-- 幣別 + 價格 -->
            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="asset-currency">{t('asset.currency')}</label>
                <select class="form-input" id="asset-currency" bind:value={currency}>
                  <option value="TWD">TWD</option>
                  <option value="USD">USD</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label" for="asset-price">
                  {t('asset.avgCost')} <span class="required">*</span>
                </label>
                <input
                  class="form-input"
                  type="number"
                  id="asset-price"
                  bind:value={avgCost}
                  min="0"
                  step="any"
                  autocomplete="off"
                  required
                />
                {#if priceError}
                  <span class="form-error">{priceError}</span>
                {/if}
              </div>
            </div>
          </form>
        </div>

        <!-- 右側摘要面板 -->
        {#if summaryVisible}
          <div class="asset-summary-col">
            <SummaryPanel
              bind:this={summaryPanel}
              assetType={summaryAssetType}
              symbol={summarySymbol}
              coinId={summaryCoinId}
              on:priceLoaded={handlePriceLoaded}
              on:applyPrice={handleApplyPrice}
            />
          </div>
        {/if}
      </div>
    </div>

    <div class="modal-footer">
      <button type="button" class="btn btn-secondary" on:click={handleClose}>
        {t('common.cancel')}
      </button>
      <button type="submit" class="btn btn-primary" form="asset-form">
        {t('common.save')}
      </button>
    </div>
  </div>
</div>

<style>
  .selected-asset-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-md);
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--bg-tertiary);
    border-radius: var(--border-radius-md);
    margin-bottom: var(--spacing-md);
  }
  .selected-asset-info {
    display: flex;
    align-items: baseline;
    gap: var(--spacing-sm);
    min-width: 0;
  }
  .selected-asset-symbol {
    font-weight: 700;
    font-size: var(--font-size-base);
    color: var(--accent-color);
    flex-shrink: 0;
  }
  .selected-asset-name {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .btn-apply-price {
    flex-shrink: 0;
    font-size: var(--font-size-xs);
    padding: var(--spacing-xs) var(--spacing-sm);
    min-height: 32px;
  }
</style>
