<!--
  PledgeModal.svelte — 股票質押計算 Modal
-->
<script>
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { t } from '$lib/services/i18n.js';
  import { formatCurrency } from '$lib/services/localeFormatter.js';
  import { liabilities } from '$lib/stores/liabilities.js';
  import { showToast } from '$lib/stores/toast.js';
  import { lockScroll, unlockScroll } from '$lib/utils/scrollLock.js';
  import Icon from '../Icon.svelte';

  const dispatch = createEventDispatcher();

  // ── Modal 開啟時立即鎖定背景滾動（避免 DOM 插入後閃爍） ──
  lockScroll();
  onDestroy(() => { unlockScroll(); });

  // ── 初始化所有連動值 ──
  onMount(() => {
    // 根據可借款上限計算初始值
    const mv = Math.floor(quantity / 1000) * 1000 * (quantity > 0 ? marketValue / quantity : 0);
    const borrowed = $liabilities
      .filter(l => l.category === 'pledge' && l.name && l.name.startsWith(symbol))
      .reduce((sum, l) => sum + (l.amount || 0), 0);
    const maxLoan = Math.max(Math.round(mv * 60 / 100) - borrowed, 0);
    loanInput = maxLoan;
    if (mv > 0 && maxLoan > 0) {
      pledgeRatio = parseFloat((maxLoan / mv * 100).toFixed(2));
      // 維持率 = 市值 / (已借 + 新借)
      const total = borrowed + maxLoan;
      maintenanceRatio = total > 0 ? Math.round(mv / total * 100) : 600;
    } else {
      pledgeRatio = 0;
      // 沒有新借時，維持率 = 市值 / 已借
      maintenanceRatio = borrowed > 0 ? Math.round(mv / borrowed * 100) : 600;
    }
  });
  onDestroy(() => { unlockScroll(); });

  export let symbol = '';
  export let name = '';
  export let marketValue = 0;
  export let quantity = 0;

  let pledgeRatio = 60; // 質押成數 %（最高 60%）
  let maintenanceRatio = 166; // 維持率 %（= 10000 / 質押成數）
  let loanInput = 0; // 使用者輸入的借款金額

  // 常用維持率按鈕
  const COMMON_RATES = [166, 200, 300, 400, 500];

  // 防止雙向更新無限迴圈
  let updatingFrom = '';

  /** 質押成數改變 → 更新維持率 + 借款金額 */
  function onPledgeRatioChange() {
    if (updatingFrom) return;
    // 若使用者正在清空輸入，不強制覆蓋
    if (pledgeRatio === '' || pledgeRatio === null || Number.isNaN(Number(pledgeRatio))) return;
    updatingFrom = 'pledge';
    const safeMax = Math.max(maxAvailable, 0);
    const maxRatio = pledgeableMarketValue > 0
      ? Math.min(parseFloat((safeMax / pledgeableMarketValue * 100).toFixed(2)), 60)
      : 60;
    const r = Math.min(Math.max(parseFloat(pledgeRatio) || 0, 0.01), maxRatio);
    pledgeRatio = parseFloat(r.toFixed(2));
    loanInput = Math.round(pledgeableMarketValue * pledgeRatio / 100 / 1000) * 1000;
    // 維持率 = 市值 / (已借 + 新借)
    const total = existingBorrowed + loanInput;
    maintenanceRatio = total > 0 ? Math.round(pledgeableMarketValue / total * 100) : 600;
    updatingFrom = '';
  }

  /** 維持率改變 → 更新質押成數 + 借款金額 */
  function onMaintenanceRatioChange() {
    if (updatingFrom) return;
    updatingFrom = 'maintenance';
    const m = Math.max(maintenanceRatio, sliderMin);
    maintenanceRatio = m;
    const safeMax = Math.max(maxAvailable, 0);

    // 拉到最左邊（sliderMin）時直接用 maxAvailable，避免取整誤差
    if (m <= sliderMin) {
      loanInput = safeMax;
    } else {
      const totalNeeded = pledgeableMarketValue / m * 100;
      const newLoan = Math.max(Math.round((totalNeeded - existingBorrowed) / 1000) * 1000, 0);
      loanInput = Math.min(newLoan, safeMax);
    }

    // 質押成數 = 新借 / 市值 * 100
    const r = pledgeableMarketValue > 0
      ? Math.min(parseFloat((loanInput / pledgeableMarketValue * 100).toFixed(2)), 60)
      : 0;
    pledgeRatio = r;
    updatingFrom = '';
  }

  /** 借款金額改變 → 更新質押成數 + 維持率（輸入中不取整） */
  function onLoanInputChange() {
    if (updatingFrom) return;
    // 若使用者正在清空輸入，不強制覆蓋
    if (loanInput === '' || loanInput === null || Number.isNaN(Number(loanInput))) return;
    updatingFrom = 'loan';
    const maxLoan = Math.max(maxAvailable, 0);
    const val = Math.min(Math.max(loanInput || 0, 0), maxLoan);
    loanInput = val;
    if (pledgeableMarketValue > 0 && val > 0) {
      const r = Math.min(parseFloat((val / pledgeableMarketValue * 100).toFixed(2)), 60);
      pledgeRatio = Math.max(r, 0.01);
      const total = existingBorrowed + val;
      maintenanceRatio = total > 0 ? Math.round(pledgeableMarketValue / total * 100) : 600;
    }
    updatingFrom = '';
  }

  /** 質押成數失焦 → 空值歸零並觸發連動計算 */
  function onPledgeRatioBlur() {
    pledgeRatio = parseFloat(pledgeRatio) || 0;
    onPledgeRatioChange();
  }

  /** 借款金額失焦 → 限制範圍（空值歸零） */
  function onLoanInputBlur() {
    const maxLoan = Math.max(maxAvailable, 0);
    loanInput = Math.min(Math.max(parseFloat(loanInput) || 0, 0), maxLoan);
    onLoanInputChange();
  }

  /** 快捷按鈕設定維持率 */
  function setMaintenanceRate(rate) {
    maintenanceRatio = rate;
    onMaintenanceRatioChange();
  }

  // 可質押張數（1 張 = 1000 股，不到 1 張不可質押）
  $: pledgeableShares = Math.floor(quantity / 1000);
  $: canPledge = pledgeableShares >= 1;

  // 每股價格（從總市值反推）
  $: pricePerShare = quantity > 0 ? marketValue / quantity : 0;

  // 可質押市值（僅計算整張部分）
  $: pledgeableMarketValue = pledgeableShares * 1000 * pricePerShare;

  // 已借額度（從現有質押負債中查找同一股票）
  $: existingBorrowed = $liabilities
    .filter(l => l.category === 'pledge' && l.name && l.name.startsWith(symbol))
    .reduce((sum, l) => sum + (l.amount || 0), 0);

  // 即時計算（以可質押市值計算）
  $: effectiveRatio = Math.min(pledgeRatio, 60);
  $: pledgeAmount = Math.round(pledgeableMarketValue * effectiveRatio / 100);
  // 最大可借額度（60% 市值 - 已借，允許負數表示已超借）
  $: maxPledgeAmount = Math.round(pledgeableMarketValue * 60 / 100);
  $: maxAvailable = maxPledgeAmount - existingBorrowed;
  // 是否已超借（無法再借）
  $: isOverBorrowed = maxAvailable <= 0;
  // 已借佔市值百分比
  $: borrowedPercent = pledgeableMarketValue > 0 ? (existingBorrowed / pledgeableMarketValue * 100).toFixed(1) : '0.0';
  // 可借佔市值百分比
  $: availablePercent = pledgeableMarketValue > 0 ? (maxAvailable / pledgeableMarketValue * 100).toFixed(1) : '0.0';
  // 若已超借，計算需補多少張才能達到 166% 維持率
  // 166% 維持率 = 新市值 / 已借 → 新市值 = 已借 × 1.66
  // 需補股數 = (新市值 - 目前市值) / 每股價格，取整張
  $: neededSharesFor166 = isOverBorrowed && pricePerShare > 0
    ? Math.ceil((existingBorrowed * 1.66 - pledgeableMarketValue) / (pricePerShare * 1000))
    : 0;
  // 總借款 = 已借 + 新借（loanInput）
  $: totalBorrowed = existingBorrowed + (loanInput || 0);
  // 維持率 = 市值 / 總借款（考慮已借額度）
  $: currentMaintenanceRate = totalBorrowed > 0 ? (pledgeableMarketValue / totalBorrowed) * 100 : 0;
  // 斷頭價（維持率跌破 130% 時觸發）
  $: liquidationPrice = pledgeableShares > 0 && totalBorrowed > 0
    ? (totalBorrowed * 1.3) / (pledgeableShares * 1000)
    : 0;
  // 可承受跌幅 = (目前股價 - 斷頭價) / 目前股價 × 100
  $: maxDropPercent = pricePerShare > 0 && liquidationPrice > 0
    ? ((pricePerShare - liquidationPrice) / pricePerShare) * 100
    : 100;
  $: isDropWarning = maxDropPercent < 30;

  // 再質押維持率 = (市值 + 借款金額) / 總借款
  $: rePledgeRate = totalBorrowed > 0
    ? ((pledgeableMarketValue + loanInput) / totalBorrowed) * 100
    : 0;

  $: isOverLimit = pledgeRatio > 60;

  // 滑桿最小值 = 借到最大時的維持率 = 市值 / (已借 + 最大可借)
  $: sliderMin = (() => {
    const safeMaxAvail = Math.max(maxAvailable, 0);
    const totalMax = existingBorrowed + safeMaxAvail;
    return totalMax > 0 ? Math.ceil(pledgeableMarketValue / totalMax * 100) : 1000;
  })();

  // 借款滑桿：最大值 = maxAvailable，最小值 = 0（或 1000）
  $: loanSliderMax = Math.max(maxAvailable, 0);

  // 滑桿填充百分比（基於借款金額）
  $: sliderFillPercent = loanSliderMax > 0
    ? (loanInput / loanSliderMax) * 100
    : 0;

  /** 借款滑桿變更 → 更新維持率和質押成數 */
  function onLoanSliderInput() {
    if (updatingFrom) return;
    updatingFrom = 'slider';
    // 取整到千位
    loanInput = Math.round(loanInput / 1000) * 1000;
    if (pledgeableMarketValue > 0 && loanInput > 0) {
      const r = Math.min(parseFloat((loanInput / pledgeableMarketValue * 100).toFixed(2)), 60);
      pledgeRatio = Math.max(r, 0.01);
      const total = existingBorrowed + loanInput;
      maintenanceRatio = total > 0 ? Math.round(pledgeableMarketValue / total * 100) : 600;
    } else if (loanInput === 0) {
      pledgeRatio = 0;
      maintenanceRatio = existingBorrowed > 0 ? Math.round(pledgeableMarketValue / existingBorrowed * 100) : 600;
    }
    updatingFrom = '';
  }

  function rateColor(rate) {
    if (isDropWarning) return 'var(--color-warning)';
    if (rate >= 160) return 'var(--color-positive)';
    if (rate >= 140) return 'var(--color-warning)';
    return 'var(--color-negative)';
  }

  function rateStatus(rate) {
    if (isDropWarning && rate >= 160) return t('tools.warning');
    if (rate >= 160) return t('tools.safe');
    if (rate >= 140) return t('tools.warning');
    return t('tools.danger');
  }

  /** 純粹基於數值的顏色/狀態（不受 isDropWarning 影響，用於再質押維持率） */
  function pureRateColor(rate) {
    if (rate >= 160) return 'var(--color-positive)';
    if (rate >= 140) return 'var(--color-warning)';
    return 'var(--color-negative)';
  }

  function pureRateStatus(rate) {
    if (rate >= 160) return t('tools.safe');
    if (rate >= 140) return t('tools.warning');
    return t('tools.danger');
  }

  function handleClose() {
    dispatch('close');
  }

  function handleSubmit() {
    if (!loanInput || loanInput <= 0 || !canPledge) return;
    if (!pledgeRatio || Number.isNaN(Number(pledgeRatio))) return;

    liabilities.addLiability({
      id: crypto.randomUUID(),
      name: symbol,
      category: 'pledge',
      amount: loanInput,
      currency: 'TWD',
      interestRate: null,
      creditLine: pledgeableMarketValue,
      drawdownDate: new Date().toISOString().slice(0, 10),
    });

    showToast(`${symbol} ${t('asset.pledge')} ${formatCurrency(loanInput)}`, 'success');
    dispatch('close');
  }
</script>

<svelte:window on:keydown={(e) => { if (e.key === 'Escape') handleClose(); }} />

<!-- 背景遮罩（禁止點擊外部關閉） -->
<div class="modal-overlay" role="presentation">
  <div class="modal" role="dialog" aria-modal="true">
    <div class="modal-header">
      <h2 class="modal-title">{t('asset.pledge')}
        <span style="font-size: var(--font-size-sm); color: var(--text-secondary); font-weight: 400;">— {symbol} {name}</span>
      </h2>
      <button class="modal-close" on:click={handleClose}><Icon name="x" size={18}/></button>
    </div>

    <div class="modal-body">
      <!-- 股票資訊 + 即時計算結果（左右兩欄） -->
      <div class="pledge-info-card pledge-info-grid">
        <div class="pledge-info-col">
          <div class="pledge-info-row">
            <span>{t('tools.marketValue')}</span>
            <strong>{formatCurrency(pledgeableMarketValue)}</strong>
          </div>
          <div class="pledge-info-row">
            <span>{t('asset.quantity')}</span>
            <strong>{(pledgeableShares * 1000).toLocaleString()} {t('tools.shares')}</strong>
          </div>
          <div class="pledge-info-row">
            <span>{t('tools.available')}（{availablePercent}%）</span>
            <strong style="color: {isOverBorrowed ? 'var(--color-negative)' : 'var(--accent-color)'}">{formatCurrency(maxAvailable)}</strong>
          </div>
          <div class="pledge-info-row">
            <span>{t('tools.borrowed')}（{borrowedPercent}%）</span>
            <strong style="color: {existingBorrowed > 0 ? 'var(--color-warning)' : 'var(--text-muted)'}">{formatCurrency(existingBorrowed)}</strong>
          </div>
        </div>
        <div class="pledge-info-col">
          <div class="pledge-info-row">
            <span>{t('tools.loanAmount')}</span>
            <strong style="color: var(--accent-color)">{formatCurrency(loanInput)}</strong>
          </div>
          <div class="pledge-info-row">
            <span>{t('tools.maintenanceRate')}</span>
            <strong style="color: {rateColor(currentMaintenanceRate)}">
              {currentMaintenanceRate.toFixed(1)}% ({rateStatus(currentMaintenanceRate)})
            </strong>
          </div>
          <div class="pledge-info-row">
            <span>{t('tools.maxDrop')}</span>
            <strong style="color: {isDropWarning ? 'var(--color-warning)' : 'var(--color-positive)'}">
              -{maxDropPercent.toFixed(2)}%
            </strong>
          </div>
          {#if loanInput > 0}
            <div class="pledge-info-row">
              <span class="re-pledge-label">
                {t('tools.rePledgeRate')}
                <span class="info-tooltip-wrap">
                  <Icon name="info" size={12}/>
                  <span class="info-tooltip-text">{t('tools.rePledgeRateDesc', { rate: rePledgeRate.toFixed(1) })}</span>
                </span>
              </span>
              <strong style="color: {pureRateColor(rePledgeRate)}">
                {rePledgeRate.toFixed(1)}% ({pureRateStatus(rePledgeRate)})
              </strong>
            </div>
          {/if}
        </div>
      </div>
      {#if !canPledge}
        <div class="pledge-warning"><Icon name="alert-triangle" size={14}/> {t('tools.cannotPledge')}</div>
      {/if}
      {#if isOverBorrowed}
        <div class="pledge-warning" style="border-color: var(--color-negative); color: var(--color-negative); background: rgba(248, 113, 113, 0.1);">
          <Icon name="alert-triangle" size={14}/> {t('tools.overBorrowLimit')}
          {#if neededSharesFor166 > 0}
            {t('tools.restoreTo166', { shares: neededSharesFor166, quantity: (neededSharesFor166 * 1000).toLocaleString(), amount: formatCurrency(neededSharesFor166 * 1000 * pricePerShare) })}
          {/if}
        </div>
        {/if}

      <!-- 質押參數 -->
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">{t('tools.pledgeRatio')}</label>
          <input class="form-input" type="number" bind:value={pledgeRatio} on:change={onPledgeRatioChange} on:blur={onPledgeRatioBlur} min="1" max="60" step="0.01" disabled={!canPledge} />
        </div>
        <div class="form-group">
          <label class="form-label">{t('tools.loanAmount')}</label>
          <input class="form-input" type="number" bind:value={loanInput} on:change={onLoanInputChange} on:blur={onLoanInputBlur} min="0" max={maxAvailable} step="1000" disabled={!canPledge} />
          <span class="form-hint">{t('tools.loanLimit')}: {formatCurrency(maxAvailable)}</span>
        </div>
      </div>
      {#if isOverLimit}
        <div class="pledge-warning"><Icon name="alert-triangle" size={14}/> {t('tools.pledgeLimitWarning')}</div>
      {/if}

      <div class="form-group">
        <div class="drawdown-slider-header">
          <label class="form-label">{t('tools.loanAmount')}</label>
          <span class="drawdown-percent-display" style="color: {rateColor(currentMaintenanceRate)}">
            {t('tools.maintenanceRate')} {maintenanceRatio}% ({rateStatus(maintenanceRatio)})
          </span>
        </div>
        <input
          type="range"
          class="pledge-slider"
          min="1000"
          max={loanSliderMax}
          step="1000"
          bind:value={loanInput}
          on:input={onLoanSliderInput}
          on:change={onLoanSliderInput}
          disabled={!canPledge}
          style="background: linear-gradient(to right, var(--accent-color) {sliderFillPercent}%, var(--bg-tertiary) {sliderFillPercent}%)"
        />
        <div class="pledge-rate-buttons">
          {#each COMMON_RATES as rate}
            <button
              class="pledge-rate-btn"
              class:active={maintenanceRatio === rate}
              on:click={() => setMaintenanceRate(rate)}
              disabled={!canPledge}
            >
              {rate}%
            </button>
          {/each}
          <div class="pledge-rate-custom">
            <input
              class="form-input pledge-rate-input"
              type="number"
              min={sliderMin}
              step="1"
              placeholder={t('tools.customPercent')}
              on:change={(e) => { const v = parseInt(e.target.value); if (v >= sliderMin) setMaintenanceRate(v); }}
              disabled={!canPledge}
            />
          </div>
        </div>
      </div>
    </div>

    <div class="modal-footer">
      <button class="btn btn-secondary" on:click={handleClose}>{t('common.cancel')}</button>
      <button class="btn btn-primary" on:click={handleSubmit} disabled={!loanInput || loanInput <= 0 || !canPledge || !pledgeRatio || Number.isNaN(Number(pledgeRatio))}>
        {t('asset.pledge')} {formatCurrency(loanInput || 0)}
      </button>
    </div>
  </div>
</div>

<style>
  .pledge-info-card {
    background: var(--bg-tertiary);
    border-radius: var(--border-radius-md);
    padding: var(--spacing-md);
    margin-bottom: var(--spacing-lg);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }
  .pledge-info-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: var(--font-size-sm);
  }
  .pledge-info-row span { color: var(--text-secondary); }
  .pledge-info-row strong { color: var(--text-primary); }

  .re-pledge-label {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .info-tooltip-wrap {
    position: relative;
    display: inline-flex;
    align-items: center;
    cursor: help;
    color: var(--text-muted);
  }
  .info-tooltip-text {
    display: none;
    position: absolute;
    bottom: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%);
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    font-size: 11px;
    font-weight: 400;
    padding: 6px 10px;
    border-radius: 6px;
    white-space: nowrap;
    z-index: 100;
    pointer-events: none;
    box-shadow: var(--shadow-md);
  }
  .info-tooltip-wrap:hover .info-tooltip-text {
    display: block;
  }

  .pledge-info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--spacing-md);
  }

  .pledge-info-col {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  @media (max-width: 480px) {
    .pledge-info-grid {
      grid-template-columns: 1fr;
    }
  }

  .pledge-rate-buttons {
    display: flex;
    gap: var(--spacing-xs);
    flex-wrap: wrap;
    margin-top: var(--spacing-sm);
  }
  .pledge-rate-btn {
    padding: 6px 14px;
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-full);
    background: transparent;
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
    cursor: pointer;
    transition: all 0.15s ease;
    min-height: 36px;
  }
  .pledge-rate-btn:hover { border-color: var(--accent-color); color: var(--accent-color); }
  .pledge-rate-btn:focus-visible { outline: 2px solid var(--accent-color); outline-offset: 2px; }
  .pledge-rate-btn.active { background: var(--accent-color); color: #fff; border-color: var(--accent-color); }

  .pledge-rate-custom {
    display: flex;
    align-items: center;
  }
  .pledge-rate-input {
    width: 72px;
    min-height: 36px;
    padding: 6px 8px;
    font-size: var(--font-size-sm);
    text-align: center;
    border-radius: var(--border-radius-full);
  }

  /* 維持率滑桿 — 填充色為 accent */
  .pledge-slider {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 6px;
    border-radius: 3px;
    outline: none;
    cursor: pointer;
    margin-bottom: var(--spacing-sm);
    /* slider 自行消化所有觸控手勢，避免水平拖動被外層 modal 當成滾動觸發 bounce */
    touch-action: none;
  }
  .pledge-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--accent-color);
    cursor: pointer;
    border: 2px solid var(--bg-secondary);
    box-shadow: 0 0 0 3px var(--accent-light);
    transition: transform 0.15s ease;
  }
  .pledge-slider::-webkit-slider-thumb:hover {
    transform: scale(1.15);
  }
  .pledge-slider::-moz-range-thumb {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--accent-color);
    cursor: pointer;
    border: 2px solid var(--bg-secondary);
  }
  .pledge-slider::-moz-range-track {
    height: 6px;
    border-radius: 3px;
    background: var(--bg-tertiary);
  }

  .pledge-warning {
    margin: var(--spacing-sm) 0;
    padding: var(--spacing-sm) var(--spacing-md);
    background: rgba(255, 145, 0, 0.1);
    border: 1px solid var(--color-warning);
    border-radius: var(--border-radius-sm);
    color: var(--color-warning);
    font-size: var(--font-size-xs);
    font-weight: 600;
  }

  .pledge-result-row span { color: var(--text-secondary); }
</style>
