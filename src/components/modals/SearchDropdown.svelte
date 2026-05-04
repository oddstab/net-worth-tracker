<!--
  SearchDropdown.svelte — 搜尋下拉選單

  支援台股與加密貨幣搜尋，200ms 防抖。
  鍵盤導覽：↑↓ 選擇、Enter 確認、Escape 關閉。
  使用 position: fixed 定位，避免被 modal 的 overflow 裁切。
  下拉開啟時鎖定 modal-body 滾動，關閉時恢復。
  所有文字使用 t() 翻譯函式。
-->
<script>
  import { createEventDispatcher, onDestroy, tick } from 'svelte';
  import { t } from '$lib/services/i18n.js';
  import { tStore } from '$lib/services/i18n.js';
  import { searchTWStock, searchCrypto } from '$lib/services/searchService.js';

  /** 資產類型：'tw_stock' | 'crypto' */
  export let assetType = 'tw_stock';

  /** 搜尋欄位值（雙向綁定） */
  export let value = '';

  /** 是否停用輸入 */
  export let disabled = false;

  const dispatch = createEventDispatcher();

  /** 搜尋結果 */
  let results = [];

  /** 下拉是否可見 */
  let dropdownVisible = false;

  /** 鍵盤高亮索引 */
  let highlightIndex = -1;

  /** 防抖計時器 */
  let debounceTimer = null;

  /** 下拉容器參考 */
  let dropdownEl;

  /** 輸入框參考 */
  let inputEl;

  /** 下拉選單的 fixed 定位座標 */
  let dropdownStyle = '';

  /* 訂閱 tStore 以在語言切換時觸發重新渲染 */
  $: _t = $tStore;

  /** 清理計時器 */
  onDestroy(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
    // 確保銷毀時恢復 modal 滾動
    setModalBodyScroll(true);
  });

  // ─── Modal 滾動鎖定 ──────────────────────────────────────────────────

  /**
   * 鎖定或解鎖最近的 .modal-body 滾動。
   * @param {boolean} allow - true 允許滾動，false 鎖定滾動
   */
  function setModalBodyScroll(allow) {
    if (!inputEl) return;
    const modalBody = inputEl.closest('.modal-body');
    if (!modalBody) return;
    modalBody.style.overflowY = allow ? '' : 'hidden';
  }

  /**
   * 顯示下拉選單並鎖定 modal 滾動。
   */
  function showDropdown() {
    dropdownVisible = true;
    setModalBodyScroll(false);
  }

  /**
   * 隱藏下拉選單並恢復 modal 滾動。
   */
  function hideDropdown() {
    dropdownVisible = false;
    setModalBodyScroll(true);
  }

  // ─── 定位計算 ────────────────────────────────────────────────────────

  /** 視窗底部留白（px） */
  const VIEWPORT_PADDING = 12;

  /**
   * 根據輸入框位置計算下拉選單的 fixed 定位。
   * max-height 動態計算，確保不超出視窗底部。
   */
  function updateDropdownPosition() {
    if (!inputEl) return;
    const rect = inputEl.getBoundingClientRect();
    const top = rect.bottom + 4;
    const maxH = Math.max(120, window.innerHeight - top - VIEWPORT_PADDING);
    dropdownStyle = `position:fixed; top:${top}px; left:${rect.left}px; width:${rect.width}px; max-height:${maxH}px;`;
  }

  // ─── 搜尋與事件處理 ──────────────────────────────────────────────────

  /**
   * 處理 focus 事件 — 點擊搜尋欄位時立即觸發搜尋並顯示下拉選單。
   */
  async function handleFocus() {
    const q = value.trim();
    if (q.length < 1) {
      // 沒有輸入內容時不顯示下拉
      return;
    }
    // 有輸入內容時立即搜尋並顯示
    const searchResults = assetType === 'tw_stock'
      ? await searchTWStock(q)
      : searchCrypto(q);

    results = searchResults;
    if (results.length > 0 || q.length > 0) {
      showDropdown();
    }
    highlightIndex = -1;
    await tick();
    updateDropdownPosition();
  }

  /**
   * 處理輸入事件，200ms 防抖後執行搜尋。
   */
  function handleInput() {
    if (debounceTimer) clearTimeout(debounceTimer);
    highlightIndex = -1;

    const q = value.trim();
    if (q.length < 1) {
      results = [];
      hideDropdown();
      return;
    }

    debounceTimer = setTimeout(async () => {
      const searchResults = assetType === 'tw_stock'
        ? await searchTWStock(q)
        : searchCrypto(q);

      results = searchResults;
      if (results.length > 0 || q.length > 0) {
        showDropdown();
      } else {
        hideDropdown();
      }
      highlightIndex = -1;

      // 等 DOM 更新後計算位置
      await tick();
      updateDropdownPosition();
    }, 200);
  }

  /**
   * 選擇下拉項目。
   * @param {object} item — 搜尋結果項目
   */
  function selectItem(item) {
    if (assetType === 'tw_stock') {
      value = item.symbol;
      dispatch('select', {
        symbol: item.symbol,
        name: item.name,
        coinId: '',
        assetType: 'tw_stock',
        close: item.close ?? null,
      });
    } else {
      value = item.symbol;
      dispatch('select', {
        symbol: item.symbol,
        name: item.name,
        coinId: item.id,
        assetType: 'crypto',
      });
    }
    hideDropdown();
    results = [];
  }

  /**
   * 鍵盤導覽處理。
   * @param {KeyboardEvent} e
   */
  function handleKeydown(e) {
    if (!dropdownVisible || results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      highlightIndex = Math.min(highlightIndex + 1, results.length - 1);
      scrollToHighlighted();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      highlightIndex = Math.max(highlightIndex - 1, 0);
      scrollToHighlighted();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = highlightIndex >= 0 ? results[highlightIndex] : results[0];
      if (target) selectItem(target);
    } else if (e.key === 'Escape') {
      hideDropdown();
    }
  }

  /** 捲動至高亮項目 */
  function scrollToHighlighted() {
    if (!dropdownEl) return;
    const items = dropdownEl.querySelectorAll('.search-dropdown-item');
    if (highlightIndex >= 0 && items[highlightIndex]) {
      items[highlightIndex].scrollIntoView({ block: 'nearest' });
    }
  }

  /** 失焦時延遲關閉下拉（讓 mousedown 有時間觸發） */
  function handleBlur() {
    setTimeout(() => {
      // 如果焦點回到了 input（例如點 label 觸發 focus 轉移），不關閉
      if (document.activeElement === inputEl) return;
      hideDropdown();
    }, 150);
  }

  /**
   * 格式化台股收盤價顯示。
   * @param {number|null} close
   * @returns {string}
   */
  function formatClose(close) {
    if (close == null) return '';
    return `NT${close.toFixed(2)}`;
  }
</script>

<div class="form-group" id="symbol-group">
  <label class="form-label" for="asset-symbol">
    {t('asset.symbolSearch')}
    {#if disabled}🔒{/if}
  </label>
  <div class="search-input-wrapper">
    <input
      class="form-input"
      type="text"
      id="asset-symbol"
      bind:this={inputEl}
      bind:value
      on:input={handleInput}
      on:focus={handleFocus}
      on:keydown={handleKeydown}
      on:blur={handleBlur}
      placeholder={t('asset.searchPlaceholder')}
      autocomplete="off"
      {disabled}
    />
    {#if dropdownVisible}
      <div class="search-dropdown" style={dropdownStyle} bind:this={dropdownEl}>
        {#if results.length === 0}
          <div class="search-dropdown-empty">{t('common.noResults')}</div>
        {:else}
          {#each results as item, i}
            <!-- svelte-ignore a11y-no-static-element-interactions -->
            <div
              class="search-dropdown-item"
              class:highlighted={i === highlightIndex}
              on:mousedown|preventDefault={() => selectItem(item)}
              on:mouseenter={() => { highlightIndex = i; }}
            >
              <span class="sdi-symbol">{item.symbol}</span>
              <span class="sdi-name">{item.name}</span>
              {#if assetType === 'tw_stock'}
                <span class="sdi-tag">{item.type}</span>
                {#if item.close != null}
                  <span class="sdi-price">{t('summary.closingPrice')} {formatClose(item.close)}</span>
                {/if}
              {:else}
                <span class="sdi-tag">{item.category}</span>
              {/if}
            </div>
          {/each}
        {/if}
      </div>
    {/if}
  </div>
</div>
