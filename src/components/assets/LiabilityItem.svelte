<!--
  LiabilityItem.svelte — 單一負債項目

  顯示負債名稱、金額、利率、期數等資訊。
  信貸/房貸：展開/收合還款明細表，提供攤還方式切換按鈕。
  循環型：顯示計息天數計算器。
  所有文字使用 t() 翻譯函式。
-->
<script>
  import { t } from '$lib/services/i18n.js';
  import { tStore } from '$lib/services/i18n.js';
  import { formatCurrency } from '$lib/services/localeFormatter.js';
  import { calculateLoanSchedule, calculateEqualPrincipalSchedule } from '$lib/utils/calculator.js';
  import { showConfirmDialog } from '$lib/stores/confirmDialog.js';
  import { liabilities } from '$lib/stores/liabilities.js';
  import { assets } from '$lib/stores/assets.js';
  import { showToast } from '$lib/stores/toast.js';
  import { createEventDispatcher } from 'svelte';
  import Icon from '../Icon.svelte';

  const dispatch = createEventDispatcher();

  /** 負債物件 */
  export let liability;

  /** USD/TWD 匯率 */
  export let exchangeRate = 31.5;

  /* 訂閱 tStore 以在語言切換時觸發重新渲染 */
  $: _t = $tStore;

  /** 是否為分期型（信貸/房貸） */
  $: isInstallment = (liability.category === 'credit' || liability.category === 'home_loan')
    && liability.interestRate && liability.terms;

  /** 是否為循環型（質押/理財型房貸） */
  $: isRevolving = (liability.category === 'pledge' || liability.category === 'mortgage')
    && liability.interestRate;

  /** TWD 值 */
  $: twdValue = liability.amount * (liability.currency === 'USD' ? exchangeRate : 1);

  /** 質押負債：即時核准額度（根據資產市值計算） */
  $: isPledge = liability.category === 'pledge';
  $: pledgeSymbol = isPledge ? liability.name : '';
  $: pledgeMarketValue = isPledge
    ? $assets
        .filter(a => a.type === 'tw_stock' && a.symbol === pledgeSymbol)
        .reduce((sum, a) => {
          const shares = Math.floor(a.quantity / 1000) * 1000;
          return sum + shares * a.pricePerUnit;
        }, 0)
    : 0;
  /** 即時核准額度 = 可質押市值的 60% */
  $: liveCreditLine = isPledge ? Math.round(pledgeMarketValue * 0.6) : liability.creditLine;
  /** 已借佔可質押市值百分比 */
  $: borrowedPercent = pledgeMarketValue > 0 ? (twdValue / pledgeMarketValue * 100).toFixed(1) : '0.0';

  /** 還款明細是否展開 */
  let scheduleExpanded = false;

  /** 攤還方式：'equal-payment' | 'equal-principal' */
  let loanMode = 'equal-payment';

  /** 格式化月份範圍（start === end 時只顯示單一月份） */
  function monthLabel(start, end) {
    if (start === end) return t('liability.monthN', { start, end }).replace(` ~ ${end}`, '');
    return t('liability.monthN', { start, end });
  }

  /** 等額本息還款明細 */
  $: loanA = isInstallment
    ? calculateLoanSchedule(liability.amount, liability.interestRate, liability.terms)
    : [];

  /** 本金平均攤還明細 */
  $: loanB = isInstallment
    ? calculateEqualPrincipalSchedule(liability.amount, liability.interestRate, liability.terms)
    : [];

  /** 當前顯示的還款明細 */
  $: currentSchedule = loanMode === 'equal-payment' ? loanA : loanB;

  /** 等額本息月付金 */
  $: monthlyPaymentA = loanA.length > 0 ? loanA[0].monthlyPayment : 0;

  /** 等額本息總利息 */
  $: totalInterestA = loanA.length > 0 ? loanA[loanA.length - 1].cumulativeInterest : 0;

  /** 等額本息總還款 */
  $: totalPaymentA = liability.amount + totalInterestA;

  /** 本金平均攤還首期月付 */
  $: monthlyPaymentB = loanB.length > 0 ? loanB[0].monthlyPayment : 0;

  /** 本金平均攤還末期月付 */
  $: lastMonthPaymentB = loanB.length > 0 ? loanB[loanB.length - 1].monthlyPayment : 0;

  /** 本金平均攤還總利息 */
  $: totalInterestB = loanB.length > 0 ? loanB[loanB.length - 1].cumulativeInterest : 0;

  /** 本金平均攤還總還款 */
  $: totalPaymentB = liability.amount + totalInterestB;

  // ─── 循環型計息 ────────────────────────────────────────────────────────

  /** 日息 */
  $: dailyInterest = isRevolving ? liability.amount * liability.interestRate / 100 / 365 : 0;

  /** 月息 */
  $: monthlyInterest = isRevolving ? Math.round(liability.amount * liability.interestRate / 100 / 12) : 0;

  /** 計息天數（從動用日期算到今天） */
  $: defaultDays = (() => {
    const ddDate = liability.drawdownDate || liability.startDate;
    if (!ddDate) return 0;
    const startMs = new Date(ddDate).getTime();
    return Math.max(0, Math.floor((Date.now() - startMs) / 86400000));
  })();

  /** 使用者輸入的計息天數（初始值跟隨 defaultDays） */
  let revolvingDays = 0;
  let daysInitialized = false;
  $: if (!daysInitialized && defaultDays > 0) {
    revolvingDays = defaultDays;
    daysInitialized = true;
  }

  /** 應繳利息 */
  $: accruedInterest = Math.round(dailyInterest * revolvingDays);

  // ─── 格式化 ────────────────────────────────────────────────────────────

  function fmt(n) {
    return formatCurrency(Math.round(n));
  }

  /** 計算月份（從起始日期推算） */
  function getMonthLabel(term) {
    if (!liability.startDate) return '';
    const start = new Date(liability.startDate);
    const d = new Date(start.getFullYear(), start.getMonth() + term, 1);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  // ─── 事件處理 ──────────────────────────────────────────────────────────

  function toggleSchedule() {
    scheduleExpanded = !scheduleExpanded;
  }

  function switchLoanMode(mode) {
    loanMode = mode;
  }

  function handleEdit() {
    dispatch('edit', { id: liability.id });
  }

  function handleDelete() {
    showConfirmDialog(
      t('confirm.deleteTitle'),
      t('confirm.deleteLiability', { name: liability.name }),
      () => {
        liabilities.removeLiability(liability.id);
        showToast(`${liability.name} ${t('common.delete')}`, 'success');
      }
    );
  }
</script>

<div class="liability-item">
  <div class="liability-item-info">
    <div class="liability-item-header">
      <div class="liability-item-name">
        <span class="liability-name">{liability.name}</span>
      </div>
      <div class="liability-item-actions" style="display:flex;gap:var(--spacing-xs);flex-wrap:wrap;">
        {#if isInstallment || isRevolving}
          <button class="btn-sm btn-outline" on:click={toggleSchedule}>
            {#if scheduleExpanded}<Icon name="chart" size={14}/>{:else}<Icon name="chart" size={14}/>{/if} {scheduleExpanded ? t('common.close') : t('liability.paymentBreakdown')}
          </button>
        {/if}
        <button class="btn-sm btn-outline" on:click={handleEdit}><Icon name="edit" size={14}/> {t('common.edit')}</button>
        <button class="btn-sm btn-outline btn-outline-danger" on:click={handleDelete}><Icon name="trash" size={14}/> {t('common.delete')}</button>
      </div>
    </div>

    <div class="liability-item-value">{formatCurrency(twdValue)}</div>

    <!-- 標籤列 -->
    <div class="liability-tags">
      {#if liability.interestRate}
        <span class="liability-tag">{t('liability.interestRate')} {liability.interestRate}%</span>
      {/if}

      {#if isInstallment}
        {#if liability.terms}
          <span class="liability-tag">{liability.terms} {t('liability.terms')}</span>
        {/if}
        {#if liability.startDate}
          <span class="liability-tag">{t('liability.loanDate')} {liability.startDate}</span>
        {/if}
        {#if liability.endDate}
          <span class="liability-tag">{t('liability.repayDate')} {liability.endDate}</span>
        {/if}
        <span class="liability-tag liability-tag-accent">{t('liability.monthlyPayment')} {formatCurrency(monthlyPaymentA)}</span>
        <span class="liability-tag liability-tag-danger">{t('liability.totalInterest')} {formatCurrency(totalInterestA)}</span>
      {/if}

      {#if isRevolving}
        {#if isPledge}
          <span class="liability-tag">{t('liability.creditLineLabel')} {formatCurrency(liveCreditLine)}</span>
          <span class="liability-tag" style="color: {parseFloat(borrowedPercent) > 60 ? 'var(--color-negative)' : parseFloat(borrowedPercent) > 40 ? 'var(--color-warning)' : 'var(--accent-color)'}">
            {t('liability.drawdownRatio')} {borrowedPercent}%
          </span>
        {:else if liability.creditLine}
          <span class="liability-tag">{t('liability.creditLineLabel')} {formatCurrency(liability.creditLine)}</span>
        {/if}
        {#if liability.drawdownDate || liability.startDate}
          <span class="liability-tag">{t('liability.drawdownLabel')} {liability.drawdownDate || liability.startDate}</span>
        {/if}
        <span class="liability-tag liability-tag-accent">{t('liability.monthlyInterest')} {formatCurrency(monthlyInterest)}</span>
      {/if}
    </div>

    <!-- 還款明細（分期型） -->
    {#if isInstallment && scheduleExpanded}
      <div class="loan-schedule">
        <!-- 攤還方式切換 -->
        <div class="loan-mode-toggle">
          <button
            class="loan-mode-btn"
            class:active={loanMode === 'equal-payment'}
            on:click={() => switchLoanMode('equal-payment')}
          >
            {t('liability.equalPayment')}
          </button>
          <button
            class="loan-mode-btn"
            class:active={loanMode === 'equal-principal'}
            on:click={() => switchLoanMode('equal-principal')}
          >
            {t('liability.equalPrincipal')}
          </button>
        </div>

        <!-- 摘要 -->
        <div class="loan-summary-row">
          <div class="loan-summary-item">
            <span class="loan-summary-label">{t('liability.amount')}</span>
            <span class="loan-summary-value">{formatCurrency(liability.amount)}</span>
          </div>
          <div class="loan-summary-item">
            <span class="loan-summary-label">{t('liability.interestRate')}</span>
            <span class="loan-summary-value">{liability.interestRate}%</span>
          </div>
          <div class="loan-summary-item">
            <span class="loan-summary-label">{t('liability.totalPayment')}</span>
            <span class="loan-summary-value">{formatCurrency(loanMode === 'equal-payment' ? totalPaymentA : totalPaymentB)}</span>
          </div>
          <div class="loan-summary-item">
            <span class="loan-summary-label">{t('liability.totalInterest')}</span>
            <span class="loan-summary-value negative">{formatCurrency(loanMode === 'equal-payment' ? totalInterestA : totalInterestB)}</span>
          </div>
        </div>

        <!-- 每期應還本利和 -->
        <div class="loan-payment-breakdown">
          <div class="loan-payment-title">{t('liability.paymentBreakdown')}</div>
          {#if loanMode === 'equal-principal'}
            <div class="loan-payment-row">
              <span class="loan-payment-period">{monthLabel(1, 1)}</span>
              <span class="loan-payment-amount">{formatCurrency(monthlyPaymentB)}</span>
            </div>
            <div class="loan-payment-row">
              <span class="loan-payment-period">{monthLabel(liability.terms, liability.terms)}</span>
              <span class="loan-payment-amount">{formatCurrency(lastMonthPaymentB)}</span>
            </div>
          {:else}
            {#if loanA.length > 0 && loanA[loanA.length - 1].monthlyPayment !== monthlyPaymentA}
              <div class="loan-payment-row">
                <span class="loan-payment-period">{monthLabel(1, liability.terms - 1)}</span>
                <span class="loan-payment-amount">{formatCurrency(monthlyPaymentA)}</span>
              </div>
              <div class="loan-payment-row">
                <span class="loan-payment-period">{monthLabel(liability.terms, liability.terms)}</span>
                <span class="loan-payment-amount">{formatCurrency(loanA[loanA.length - 1].monthlyPayment)}</span>
              </div>
            {:else}
              <div class="loan-payment-row">
                <span class="loan-payment-period">{monthLabel(1, liability.terms)}</span>
                <span class="loan-payment-amount">{formatCurrency(monthlyPaymentA)}</span>
              </div>
            {/if}
          {/if}
        </div>

        <!-- 還款明細表 -->
        <div class="loan-table-wrap">
          <table class="loan-table">
            <thead>
              <tr>
                <th>{t('liability.period')}</th>
                {#if liability.startDate}<th>月份</th>{/if}
                <th>{t('liability.principalPart')}</th>
                <th>{t('liability.interestPart')}</th>
                <th>{t('liability.monthlyPayment')}</th>
                <th>{t('liability.remainingBalance')}</th>
                <th>{t('liability.cumulativeInterest')}</th>
              </tr>
            </thead>
            <tbody>
              {#each currentSchedule as row}
                <tr>
                  <td>{row.period}</td>
                  {#if liability.startDate}<td>{getMonthLabel(row.period)}</td>{/if}
                  <td>{fmt(row.principalPart)}</td>
                  <td>{fmt(row.interestPart)}</td>
                  <td>{fmt(row.monthlyPayment)}</td>
                  <td>{fmt(row.remainingBalance)}</td>
                  <td>{fmt(row.cumulativeInterest)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    {/if}

    <!-- 計息天數計算器（循環型） -->
    {#if isRevolving && scheduleExpanded}
      <div class="loan-schedule">
        <div class="loan-summary-row">
          <div class="loan-summary-item">
            <span class="loan-summary-label">{t('liability.drawdownAmount')}</span>
            <span class="loan-summary-value">{formatCurrency(liability.amount)}</span>
          </div>
          <div class="loan-summary-item">
            <span class="loan-summary-label">{t('liability.interestRate')}</span>
            <span class="loan-summary-value">{liability.interestRate}%</span>
          </div>
          {#if isPledge}
            <div class="loan-summary-item">
              <span class="loan-summary-label">{t('liability.creditLine')}</span>
              <span class="loan-summary-value">{formatCurrency(liveCreditLine)}</span>
            </div>
          {:else if liability.creditLine}
            <div class="loan-summary-item">
              <span class="loan-summary-label">{t('liability.creditLine')}</span>
              <span class="loan-summary-value">{formatCurrency(liability.creditLine)}</span>
            </div>
          {/if}
          <div class="loan-summary-item">
            <span class="loan-summary-label">{t('liability.dailyInterest')}</span>
            <span class="loan-summary-value">{formatCurrency(Math.round(dailyInterest))}</span>
          </div>
        </div>

        <!-- 計息天數互動區 -->
        <div class="revolving-calc">
          <div class="revolving-calc-row">
            <span class="revolving-calc-label">{t('liability.interestDaysCalc')}</span>
            <input
              class="form-input revolving-days-input"
              type="number"
              bind:value={revolvingDays}
              min="0"
              step="1"
            />
            <span class="revolving-calc-unit">天</span>
          </div>
          <div class="revolving-result">
            <span class="revolving-result-label">{t('liability.accruedInterest')}</span>
            <span class="revolving-result-value">{formatCurrency(accruedInterest)}</span>
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>
