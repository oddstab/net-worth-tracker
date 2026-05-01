<!--
  LiabilityModal.svelte — 新增/編輯負債 Modal

  根據負債分類動態顯示表單欄位。
  信貸/房貸：金額、年利率、期數、起始/結束日期。
  質押/理財型房貸：核准額度、動用金額滑桿、年利率、動用日期。
  所有文字使用 t() 翻譯函式。
-->
<script>
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { t } from '$lib/services/i18n.js';
  import { tStore } from '$lib/services/i18n.js';
  import { liabilities } from '$lib/stores/liabilities.js';
  import { validateAmount } from '$lib/utils/calculator.js';
  import { lockScroll, unlockScroll } from '$lib/utils/scrollLock.js';
  import { showToast } from '$lib/stores/toast.js';
  import Icon from '../Icon.svelte';

  const dispatch = createEventDispatcher();

  /** 編輯中的負債（null 表示新增模式） */
  export let liability = null;

  /** 是否為編輯模式 */
  $: isEdit = liability !== null;

  /** 質押負債編輯時鎖定名稱（避免改名後質押功能找不到） */
  $: isPledgeEdit = isEdit && category === 'pledge';

  /* 訂閱 tStore 以在語言切換時觸發重新渲染 */
  $: _t = $tStore;

  // ─── 表單欄位 ──────────────────────────────────────────────────────────

  let name = liability?.name || '';
  let category = liability?.category || 'credit';
  let currency = liability?.currency || 'TWD';
  /** 金額以「萬」為單位輸入 */
  let amountWan = liability?.amount ? liability.amount / 10000 : '';
  let interestRate = liability?.interestRate ?? '';
  let terms = liability?.terms ?? '';
  let startDate = liability?.startDate ?? '';
  let endDate = liability?.endDate ?? '';
  /** 核准額度以「萬」為單位輸入 */
  let creditLineWan = liability?.creditLine ? liability.creditLine / 10000 : '';
  /** 動用金額以「萬」為單位輸入 */
  let revolvingAmountWan = liability?.amount ? liability.amount / 10000 : 0;
  let drawdownDate = liability?.drawdownDate ?? '';

  // ─── 錯誤訊息 ──────────────────────────────────────────────────────────

  let nameError = '';
  let amountError = '';
  let creditLineError = '';
  let revolvingAmountError = '';

  // ─── 分類判斷 ──────────────────────────────────────────────────────────

  $: isInstallment = category === 'credit' || category === 'home_loan';
  $: isRevolving = category === 'pledge' || category === 'mortgage';

  // ─── 動用金額滑桿 ──────────────────────────────────────────────────────

  /** 滑桿百分比 */
  let sliderPercent = 0;

  // ── Modal 開啟時立即鎖定背景滾動（避免 DOM 插入後閃爍） ──
  lockScroll();
  onDestroy(() => { unlockScroll(); });

  /** 初始化滑桿 */
  onMount(() => {
    if (isRevolving && creditLineWan > 0 && revolvingAmountWan > 0) {
      sliderPercent = Math.min(Math.round((revolvingAmountWan / creditLineWan) * 100), 100);
    }
  });

  /** 滑桿變更時更新動用金額 */
  function handleSliderInput() {
    const cl = parseFloat(creditLineWan) || 0;
    if (cl > 0) {
      revolvingAmountWan = Math.round(cl * sliderPercent / 100);
    }
  }

  /** 動用金額變更時同步滑桿 */
  function syncSliderFromAmount() {
    const cl = parseFloat(creditLineWan) || 0;
    const amt = parseFloat(revolvingAmountWan) || 0;
    if (cl > 0) {
      sliderPercent = Math.min(Math.round((amt / cl) * 100), 100);
    } else {
      sliderPercent = 0;
    }
  }

  /** 核准額度變更時同步滑桿 */
  function syncSliderFromCreditLine() {
    syncSliderFromAmount();
  }

  /** 快捷按鈕設定百分比 */
  function setPercent(pct) {
    sliderPercent = pct;
    handleSliderInput();
  }

  // ─── 事件處理 ──────────────────────────────────────────────────────────

  function handleClose() {
    dispatch('close');
  }

  function handleSubmit() {
    // 清除錯誤
    nameError = '';
    amountError = '';
    creditLineError = '';
    revolvingAmountError = '';

    let hasError = false;

    if (!name.trim()) {
      nameError = t('validation.nameRequired');
      hasError = true;
    }

    // 循環型：核准額度必填，動用金額允許 0
    if (isRevolving) {
      const cl = parseFloat(creditLineWan);
      if (!cl || cl <= 0) {
        creditLineError = t('validation.amountPositive');
        hasError = true;
      }
      const drawdown = parseFloat(revolvingAmountWan) || 0;
      if (drawdown > (cl || 0)) {
        revolvingAmountError = '動用金額不能超過核准額度';
        hasError = true;
      }
    } else {
      if (!validateAmount(parseFloat(amountWan))) {
        amountError = t('validation.amountPositive');
        hasError = true;
      }
    }

    if (hasError) {
      showToast(t('validation.fillRequired'), 'error');
      return;
    }

    // 組裝資料（金額從「萬」轉為實際金額）
    const actualAmount = isRevolving
      ? (parseFloat(revolvingAmountWan) || 0) * 10000
      : (parseFloat(amountWan) || 0) * 10000;

    const actualCreditLine = (parseFloat(creditLineWan) || 0) * 10000;

    const rateVal = parseFloat(
      isRevolving ? interestRate : interestRate
    ) || null;

    const data = {
      name: name.trim(),
      category,
      amount: actualAmount,
      currency,
      interestRate: rateVal,
      terms: parseInt(terms) || null,
      startDate: startDate || null,
      endDate: endDate || null,
      creditLine: actualCreditLine > 0 ? actualCreditLine : null,
      drawdownDate: drawdownDate || null,
    };

    if (isEdit) {
      liabilities.updateLiability(liability.id, data);
    } else {
      liabilities.addLiability({ id: crypto.randomUUID(), ...data });
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
    role="dialog"
    aria-modal="true"
    aria-labelledby="liability-modal-title"
  >
    <div class="modal-header">
      <h2 class="modal-title" id="liability-modal-title">
        {isEdit ? t('asset.editLiability') : t('asset.addLiability')}
      </h2>
      <button class="modal-close" on:click={handleClose} aria-label={t('common.close')}><Icon name="x" size={18}/></button>
    </div>

    <div class="modal-body">
      <form id="liability-form" novalidate autocomplete="off" on:submit|preventDefault={handleSubmit}>
        <!-- 名稱 + 分類 -->
        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="liability-name">
              {t('liability.name')} <span class="required">*</span>
              {#if isPledgeEdit}🔒{/if}
            </label>
            <input class="form-input" type="text" id="liability-name" bind:value={name} required disabled={isPledgeEdit} />
            {#if nameError}
              <span class="form-error">{nameError}</span>
            {/if}
          </div>
          <div class="form-group">
            <label class="form-label" for="liability-category">
              {t('liability.category')} <span class="required">*</span>
              {#if isPledgeEdit}🔒{/if}
            </label>
            <select class="form-input" id="liability-category" bind:value={category} disabled={isPledgeEdit}>
              <option value="credit">{t('liability.credit')}</option>
              <option value="home_loan">{t('liability.homeLoan')}</option>
              <option value="pledge">{t('liability.pledge')}</option>
              <option value="mortgage">{t('liability.mortgage')}</option>
              <option value="other">{t('liability.other')}</option>
            </select>
          </div>
        </div>

        <!-- 幣別 + 金額（非循環型）/ 幣別 + 年利率（循環型） -->
        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="liability-currency">{t('asset.currency')}</label>
            <select class="form-input" id="liability-currency" bind:value={currency}>
              <option value="TWD">TWD</option>
              <option value="USD">USD</option>
            </select>
          </div>

          {#if !isRevolving}
            <!-- 非循環型：金額 -->
            <div class="form-group">
              <label class="form-label" for="liability-amount">
                {t('liability.amountWan')} <span class="required">*</span>
              </label>
              <input
                class="form-input"
                type="number"
                id="liability-amount"
                bind:value={amountWan}
                min="0"
                step="any"
                placeholder="例: 700"
                required
              />
              {#if amountError}
                <span class="form-error">{amountError}</span>
              {/if}
            </div>
          {:else}
            <!-- 循環型：年利率放在幣別旁邊 -->
            <div class="form-group">
              <label class="form-label" for="liability-rate-rev">{t('liability.interestRate')}</label>
              <input
                class="form-input"
                type="number"
                id="liability-rate-rev"
                bind:value={interestRate}
                min="0"
                max="100"
                step="0.01"
                placeholder="例: 2.5"
              />
            </div>
          {/if}
        </div>

        <!-- 非循環型：年利率 + 期數 -->
        {#if !isRevolving}
          <div class="form-row" style={isInstallment ? '' : 'grid-template-columns:1fr'}>
            <div class="form-group">
              <label class="form-label" for="liability-rate">{t('liability.interestRate')}</label>
              <input
                class="form-input"
                type="number"
                id="liability-rate"
                bind:value={interestRate}
                min="0"
                max="100"
                step="0.01"
                placeholder="例: 2.5"
              />
            </div>
            {#if isInstallment}
              <div class="form-group">
                <label class="form-label" for="liability-terms">{t('liability.terms')}</label>
                <input
                  class="form-input"
                  type="number"
                  id="liability-terms"
                  bind:value={terms}
                  min="0"
                  step="1"
                  placeholder="例: 84"
                />
              </div>
            {/if}
          </div>
        {/if}

        <!-- 分期型：借款日 + 還款日 -->
        {#if isInstallment}
          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="liability-start">{t('liability.startDate')}</label>
              <input class="form-input" type="date" id="liability-start" bind:value={startDate} />
            </div>
            <div class="form-group">
              <label class="form-label" for="liability-end">{t('liability.endDate')}</label>
              <input class="form-input" type="date" id="liability-end" bind:value={endDate} />
            </div>
          </div>
        {/if}

        <!-- 循環型：核准額度 + 動用金額 + 滑桿（質押除外，質押全額動用） -->
        {#if isRevolving}
          {#if category === 'pledge'}
            <!-- 質押：核准額度 + 動用日期同一行 -->
            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="revolving-credit-line">
                  {t('liability.creditLine')} <span class="required">*</span>
                  {#if isPledgeEdit}🔒{/if}
                </label>
                <input
                  class="form-input"
                  type="number"
                  id="revolving-credit-line"
                  bind:value={creditLineWan}
                  min="0"
                  step="any"
                  placeholder="例: 100"
                  required
                  disabled={isPledgeEdit}
                />
                {#if creditLineError}
                  <span class="form-error">{creditLineError}</span>
                {/if}
              </div>
              <div class="form-group">
                <label class="form-label" for="revolving-drawdown-date">{t('liability.drawdownDate')}</label>
                <input class="form-input" type="date" id="revolving-drawdown-date" bind:value={drawdownDate} />
              </div>
            </div>
          {:else}
            <!-- 非質押循環型：核准額度 + 動用金額 -->
            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="revolving-credit-line">
                  {t('liability.creditLine')} <span class="required">*</span>
                </label>
                <input
                  class="form-input"
                  type="number"
                  id="revolving-credit-line"
                  bind:value={creditLineWan}
                  on:input={syncSliderFromCreditLine}
                  min="0"
                  step="any"
                  placeholder="例: 100"
                  required
                />
                {#if creditLineError}
                  <span class="form-error">{creditLineError}</span>
                {/if}
              </div>
              <div class="form-group">
                <label class="form-label" for="revolving-amount">{t('liability.drawdownAmount')} (萬)</label>
                <input
                  class="form-input"
                  type="number"
                  id="revolving-amount"
                  bind:value={revolvingAmountWan}
                  on:input={syncSliderFromAmount}
                  min="0"
                  step="any"
                />
                {#if revolvingAmountError}
                  <span class="form-error">{revolvingAmountError}</span>
                {/if}
              </div>
            </div>

            <!-- 動用金額滑桿 + 快捷按鈕 -->
            <div class="drawdown-slider-section">
              <div class="drawdown-slider-header">
                <label class="form-label" for="drawdown-slider">動用比例</label>
                <span class="drawdown-percent-display">{sliderPercent}%</span>
              </div>
              <input
                type="range"
                class="drawdown-slider"
                id="drawdown-slider"
                min="0"
                max="100"
                step="1"
                bind:value={sliderPercent}
                on:input={handleSliderInput}
                style="background: linear-gradient(to right, var(--accent-color) {sliderPercent}%, var(--bg-tertiary) {sliderPercent}%)"
              />
              <div class="drawdown-quick-btns" style="margin-top: var(--spacing-sm)">
                <button type="button" class="drawdown-quick-btn" class:active={sliderPercent === 25} on:click={() => setPercent(25)}>25%</button>
                <button type="button" class="drawdown-quick-btn" class:active={sliderPercent === 50} on:click={() => setPercent(50)}>50%</button>
                <button type="button" class="drawdown-quick-btn" class:active={sliderPercent === 75} on:click={() => setPercent(75)}>75%</button>
                <button type="button" class="drawdown-quick-btn" class:active={sliderPercent === 100} on:click={() => setPercent(100)}>100%</button>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" for="revolving-drawdown-date">{t('liability.drawdownDate')}</label>
              <input class="form-input" type="date" id="revolving-drawdown-date" bind:value={drawdownDate} />
            </div>
          {/if}

          <div class="form-hint" style="margin:var(--spacing-sm) 0 var(--spacing-md);color:var(--text-muted);font-size:var(--font-size-xs);">
            💡 循環型貸款：有動用才計息，每月只付利息，到期還本金
          </div>
        {/if}
      </form>
    </div>

    <div class="modal-footer">
      <button type="button" class="btn btn-secondary" on:click={handleClose}>
        {t('common.cancel')}
      </button>
      <button type="submit" class="btn btn-primary" form="liability-form">
        {t('common.save')}
      </button>
    </div>
  </div>
</div>
