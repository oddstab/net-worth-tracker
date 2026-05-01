<!--
  Tools Page — 計算工具箱
  
  四個計算模組：報酬率計算、期貨與槓桿、股票質押、再平衡
  使用手風琴式可折疊區塊，點擊標題展開/收合
-->
<script>
  import { t } from '$lib/services/i18n.js';
  import { tStore } from '$lib/services/i18n.js';
  import Icon from '../../components/Icon.svelte';

  /* 訂閱 tStore 以在語言切換時觸發重新渲染 */
  $: _t = $tStore;

  // ── 手風琴狀態 ──
  let openSection = null;
  function toggle(section) {
    openSection = openSection === section ? null : section;
  }

  // ══════════════════════════════════════════════
  // 1. 報酬率計算
  // ══════════════════════════════════════════════
  let retStartValue = '';
  let retEndValue = '';
  let retYears = '';
  let retPeriodicReturns = '';
  let retResults = null;

  function calcReturns() {
    const sv = parseFloat(retStartValue);
    const ev = parseFloat(retEndValue);
    const yrs = parseFloat(retYears);
    const periodicStr = retPeriodicReturns.trim();

    const results = {};

    // 總報酬率
    if (sv > 0 && ev > 0) {
      results.totalReturn = ((ev - sv) / sv) * 100;
    }

    // CAGR
    if (sv > 0 && ev > 0 && yrs > 0) {
      results.cagr = (Math.pow(ev / sv, 1 / yrs) - 1) * 100;
    }

    // 各期報酬率分析
    if (periodicStr) {
      const rates = periodicStr.split(/[,，]/).map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
      if (rates.length > 0) {
        // 算術平均
        const sum = rates.reduce((a, b) => a + b, 0);
        results.arithmeticReturn = sum / rates.length;

        // 幾何平均
        let product = 1;
        for (const r of rates) {
          product *= (1 + r / 100);
        }
        results.geometricReturn = (Math.pow(product, 1 / rates.length) - 1) * 100;
      }
    }

    retResults = Object.keys(results).length > 0 ? results : null;
  }

  // ══════════════════════════════════════════════
  // 2. 期貨與槓桿
  // ══════════════════════════════════════════════
  let levContractValue = '';
  let levInitialMargin = '';
  let levCurrentEquity = '';
  let levMaintenanceRatio = '';
  let levResults = null;

  function calcLeverage() {
    const cv = parseFloat(levContractValue);
    const im = parseFloat(levInitialMargin);
    const ce = parseFloat(levCurrentEquity);
    const mr = parseFloat(levMaintenanceRatio);

    if (!cv || !ce) return;

    const results = {};

    // 當前槓桿倍率
    results.currentLeverage = cv / ce;

    // 距離斷頭跌幅
    if (mr > 0) {
      results.distanceToLiquidation = (1 - (ce * (mr / 100)) / cv) * 100;
    }

    // 需補繳金額
    if (im > 0 && mr > 0) {
      const maintenanceMargin = cv * (mr / 100);
      results.marginCallAmount = Math.max(0, maintenanceMargin - ce);
    }

    levResults = results;
  }

  // ══════════════════════════════════════════════
  // 3. 股票質押
  // ══════════════════════════════════════════════
  let pledgeStockValue = '';
  let pledgeLoanAmount = '';
  let pledgeShares = '';
  let pledgeOriginalPnl = '';
  let pledgeNewPositionPnl = '';
  let pledgeLoanInterest = '';
  let pledgeOwnCapital = '';
  let pledgeAnnualRate = '';
  let pledgeHoldingDays = '';
  let pledgeResults = null;

  function calcPledge() {
    const smv = parseFloat(pledgeStockValue);
    const la = parseFloat(pledgeLoanAmount);
    const ps = parseFloat(pledgeShares);

    const results = {};

    // 擔保維持率
    if (la > 0) {
      results.maintenanceRate = (smv / la) * 100;
    }

    // 斷頭價格（130%）— 1 張 = 1000 股
    if (ps > 0 && la > 0) {
      results.liquidationPrice = (la * 1.3) / (ps * 1000);
    }

    // 再質押總報酬
    const opnl = parseFloat(pledgeOriginalPnl) || 0;
    const npnl = parseFloat(pledgeNewPositionPnl) || 0;
    const li = parseFloat(pledgeLoanInterest) || 0;
    const oc = parseFloat(pledgeOwnCapital);
    const ar = parseFloat(pledgeAnnualRate) || 0;
    const hd = parseFloat(pledgeHoldingDays) || 0;

    if (oc > 0) {
      const totalRet = ((opnl + npnl - li) / oc) * 100;
      results.rePledgeTotalReturn = totalRet;

      if (hd > 0) {
        results.rePledgeAnnualReturn = (Math.pow(1 + totalRet / 100, 365 / hd) - 1) * 100;
      }
    }

    pledgeResults = Object.keys(results).length > 0 ? results : null;
  }

  /**
   * 擔保維持率顏色
   */
  function pledgeColor(rate) {
    if (rate >= 160) return 'var(--color-positive)';
    if (rate >= 140) return 'var(--color-warning)';
    return 'var(--color-negative)';
  }

  function pledgeStatus(rate) {
    if (rate >= 160) return t('tools.safe');
    if (rate >= 140) return t('tools.warning');
    return t('tools.danger');
  }

  // ══════════════════════════════════════════════
  // 4. 再平衡
  // ══════════════════════════════════════════════
  let rebalanceRows = [
    { name: '', target: '', current: '' },
    { name: '', target: '', current: '' },
    { name: '', target: '', current: '' },
  ];
  let rebalanceResults = null;

  function addRebalanceRow() {
    rebalanceRows = [...rebalanceRows, { name: '', target: '', current: '' }];
  }

  function calcRebalance() {
    const rows = rebalanceRows
      .filter(r => r.name.trim() && r.target && r.current)
      .map(r => ({
        name: r.name.trim(),
        target: parseFloat(r.target),
        current: parseFloat(r.current),
      }));

    if (rows.length === 0) return;

    const totalValue = rows.reduce((sum, r) => sum + r.current, 0);

    rebalanceResults = rows.map(r => {
      const targetAmount = totalValue * r.target / 100;
      const diff = targetAmount - r.current;
      const deviation = r.current > 0
        ? ((r.current - targetAmount) / targetAmount) * 100
        : (targetAmount > 0 ? -100 : 0);
      return {
        name: r.name,
        target: r.target,
        current: r.current,
        targetAmount,
        diff,
        deviation,
        action: diff > 0 ? t('tools.buy') : (diff < 0 ? t('tools.sell') : '—'),
      };
    });
  }
</script>

<div class="tools-page">
  <h1 class="page-title">{t('tools.title')}</h1>

  <!-- ═══ 1. 報酬率計算 ═══ -->
  <div class="settings-section tool-section">
    <button class="tool-header" on:click={() => toggle('returns')} aria-expanded={openSection === 'returns'}>
      <div class="tool-header-text">
        <span class="tool-icon"><Icon name="trending-up" size={24}/></span>
        <div>
          <div class="tool-title">{t('tools.returns')}</div>
          <div class="tool-desc">{t('tools.returnsDesc')}</div>
        </div>
      </div>
      <span class="tool-chevron" class:open={openSection === 'returns'}><Icon name="chevron-down" size={18}/></span>
    </button>

    {#if openSection === 'returns'}
      <div class="tool-body">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">{t('tools.startValue')}</label>
            <input class="form-input" type="number" bind:value={retStartValue} placeholder="1000000" />
          </div>
          <div class="form-group">
            <label class="form-label">{t('tools.endValue')}</label>
            <input class="form-input" type="number" bind:value={retEndValue} placeholder="1500000" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">{t('tools.years')}</label>
          <input class="form-input" type="number" bind:value={retYears} placeholder="3" />
        </div>
        <div class="form-group">
          <label class="form-label">{t('tools.periodicReturns')}</label>
          <input class="form-input" type="text" bind:value={retPeriodicReturns} placeholder="10, -5, 8, 12" />
        </div>
        <button class="btn btn-primary tool-calc-btn" on:click={calcReturns}>{t('tools.calculate')}</button>

        {#if retResults}
          <div class="tool-results">
            {#if retResults.totalReturn !== undefined}
              <div class="result-row">
                <span class="result-label">{t('tools.totalReturn')}</span>
                <span class="result-value">{retResults.totalReturn.toFixed(2)}%</span>
              </div>
            {/if}
            {#if retResults.cagr !== undefined}
              <div class="result-row">
                <span class="result-label">{t('tools.cagr')}</span>
                <span class="result-value">{retResults.cagr.toFixed(2)}%</span>
              </div>
            {/if}
            {#if retResults.arithmeticReturn !== undefined}
              <div class="result-row">
                <span class="result-label">{t('tools.arithmeticReturn')}</span>
                <span class="result-value">{retResults.arithmeticReturn.toFixed(2)}%</span>
              </div>
            {/if}
            {#if retResults.geometricReturn !== undefined}
              <div class="result-row">
                <span class="result-label">{t('tools.geometricReturn')}</span>
                <span class="result-value">{retResults.geometricReturn.toFixed(2)}%</span>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    {/if}
  </div>

  <!-- ═══ 2. 期貨與槓桿 ═══ -->
  <div class="settings-section tool-section">
    <button class="tool-header" on:click={() => toggle('leverage')} aria-expanded={openSection === 'leverage'}>
      <div class="tool-header-text">
        <span class="tool-icon"><Icon name="zap" size={24}/></span>
        <div>
          <div class="tool-title">{t('tools.leverage')}</div>
          <div class="tool-desc">{t('tools.leverageDesc')}</div>
        </div>
      </div>
      <span class="tool-chevron" class:open={openSection === 'leverage'}><Icon name="chevron-down" size={18}/></span>
    </button>

    {#if openSection === 'leverage'}
      <div class="tool-body">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">{t('tools.contractValue')}</label>
            <input class="form-input" type="number" bind:value={levContractValue} placeholder="5000000" />
          </div>
          <div class="form-group">
            <label class="form-label">{t('tools.initialMargin')}</label>
            <input class="form-input" type="number" bind:value={levInitialMargin} placeholder="500000" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">{t('tools.currentEquity')}</label>
            <input class="form-input" type="number" bind:value={levCurrentEquity} placeholder="450000" />
          </div>
          <div class="form-group">
            <label class="form-label">{t('tools.maintenanceRatio')}</label>
            <input class="form-input" type="number" bind:value={levMaintenanceRatio} placeholder="25" />
          </div>
        </div>
        <button class="btn btn-primary tool-calc-btn" on:click={calcLeverage}>{t('tools.calculate')}</button>

        {#if levResults}
          <div class="tool-results">
            <div class="result-row">
              <span class="result-label">{t('tools.currentLeverage')}</span>
              <span class="result-value">{levResults.currentLeverage.toFixed(2)}x</span>
            </div>
            {#if levResults.distanceToLiquidation !== undefined}
              <div class="result-row">
                <span class="result-label">{t('tools.distanceToLiquidation')}</span>
                <span class="result-value" style="color: {levResults.distanceToLiquidation < 10 ? 'var(--color-negative)' : 'var(--color-positive)'}">{levResults.distanceToLiquidation.toFixed(2)}%</span>
              </div>
            {/if}
            {#if levResults.marginCallAmount !== undefined}
              <div class="result-row">
                <span class="result-label">{t('tools.marginCallAmount')}</span>
                <span class="result-value" style="color: {levResults.marginCallAmount > 0 ? 'var(--color-negative)' : 'var(--color-positive)'}">
                  NT${Math.round(levResults.marginCallAmount).toLocaleString('zh-TW')}
                </span>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    {/if}
  </div>

  <!-- ═══ 3. 股票質押 ═══ -->
  <div class="settings-section tool-section">
    <button class="tool-header" on:click={() => toggle('pledge')} aria-expanded={openSection === 'pledge'}>
      <div class="tool-header-text">
        <span class="tool-icon"><Icon name="bank" size={24}/></span>
        <div>
          <div class="tool-title">{t('tools.pledge')}</div>
          <div class="tool-desc">{t('tools.pledgeDesc')}</div>
        </div>
      </div>
      <span class="tool-chevron" class:open={openSection === 'pledge'}><Icon name="chevron-down" size={18}/></span>
    </button>

    {#if openSection === 'pledge'}
      <div class="tool-body">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">{t('tools.stockMarketValue')}</label>
            <input class="form-input" type="number" bind:value={pledgeStockValue} placeholder="3000000" />
          </div>
          <div class="form-group">
            <label class="form-label">{t('tools.loanAmount')}</label>
            <input class="form-input" type="number" bind:value={pledgeLoanAmount} placeholder="1800000" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">{t('tools.pledgeShares')}</label>
          <input class="form-input" type="number" bind:value={pledgeShares} placeholder="30" />
        </div>

        <hr class="tool-divider" />

        <div class="tool-subtitle">{t('tools.rePledgeReturn')}</div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">{t('tools.originalPnl')}</label>
            <input class="form-input" type="number" bind:value={pledgeOriginalPnl} placeholder="200000" />
          </div>
          <div class="form-group">
            <label class="form-label">{t('tools.newPositionPnl')}</label>
            <input class="form-input" type="number" bind:value={pledgeNewPositionPnl} placeholder="150000" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">{t('tools.loanInterest')}</label>
            <input class="form-input" type="number" bind:value={pledgeLoanInterest} placeholder="36000" />
          </div>
          <div class="form-group">
            <label class="form-label">{t('tools.ownCapital')}</label>
            <input class="form-input" type="number" bind:value={pledgeOwnCapital} placeholder="1200000" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">{t('tools.annualRate')}</label>
            <input class="form-input" type="number" bind:value={pledgeAnnualRate} placeholder="2.5" />
          </div>
          <div class="form-group">
            <label class="form-label">{t('tools.holdingDays')}</label>
            <input class="form-input" type="number" bind:value={pledgeHoldingDays} placeholder="180" />
          </div>
        </div>
        <button class="btn btn-primary tool-calc-btn" on:click={calcPledge}>{t('tools.calculate')}</button>

        {#if pledgeResults}
          <div class="tool-results">
            {#if pledgeResults.maintenanceRate !== undefined}
              <div class="result-row">
                <span class="result-label">{t('tools.maintenanceRate')}</span>
                <span class="result-value" style="color: {pledgeColor(pledgeResults.maintenanceRate)}">
                  {pledgeResults.maintenanceRate.toFixed(1)}%
                  <span class="result-badge" style="background: {pledgeColor(pledgeResults.maintenanceRate)}">{pledgeStatus(pledgeResults.maintenanceRate)}</span>
                </span>
              </div>
            {/if}
            {#if pledgeResults.liquidationPrice !== undefined}
              <div class="result-row">
                <span class="result-label">{t('tools.liquidationPrice')}</span>
                <span class="result-value">NT${pledgeResults.liquidationPrice.toFixed(2)}</span>
              </div>
            {/if}
            {#if pledgeResults.rePledgeTotalReturn !== undefined}
              <div class="result-row">
                <span class="result-label">{t('tools.rePledgeTotalReturn')}</span>
                <span class="result-value" style="color: {pledgeResults.rePledgeTotalReturn >= 0 ? 'var(--color-positive)' : 'var(--color-negative)'}">
                  {pledgeResults.rePledgeTotalReturn.toFixed(2)}%
                </span>
              </div>
            {/if}
            {#if pledgeResults.rePledgeAnnualReturn !== undefined}
              <div class="result-row">
                <span class="result-label">{t('tools.rePledgeAnnualReturn')}</span>
                <span class="result-value" style="color: {pledgeResults.rePledgeAnnualReturn >= 0 ? 'var(--color-positive)' : 'var(--color-negative)'}">
                  {pledgeResults.rePledgeAnnualReturn.toFixed(2)}%
                </span>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    {/if}
  </div>

  <!-- ═══ 4. 再平衡 ═══ -->
  <div class="settings-section tool-section">
    <button class="tool-header" on:click={() => toggle('rebalance')} aria-expanded={openSection === 'rebalance'}>
      <div class="tool-header-text">
        <span class="tool-icon"><Icon name="scale" size={24}/></span>
        <div>
          <div class="tool-title">{t('tools.rebalance')}</div>
          <div class="tool-desc">{t('tools.rebalanceDesc')}</div>
        </div>
      </div>
      <span class="tool-chevron" class:open={openSection === 'rebalance'}><Icon name="chevron-down" size={18}/></span>
    </button>

    {#if openSection === 'rebalance'}
      <div class="tool-body">
        <div class="rebalance-table-header">
          <span class="rb-col-name">{t('tools.assetName')}</span>
          <span class="rb-col-target">{t('tools.targetAllocation')}</span>
          <span class="rb-col-current">{t('tools.currentValue')}</span>
        </div>
        {#each rebalanceRows as row, i}
          <div class="rebalance-row">
            <input class="form-input rb-input-name" type="text" bind:value={row.name} placeholder={`${t('tools.assetName')} ${i + 1}`} />
            <input class="form-input rb-input-num" type="number" bind:value={row.target} placeholder="%" />
            <input class="form-input rb-input-num" type="number" bind:value={row.current} placeholder="0" />
          </div>
        {/each}
        <button class="btn btn-secondary tool-add-btn" on:click={addRebalanceRow}>+ {t('tools.addAssetRow')}</button>
        <button class="btn btn-primary tool-calc-btn" on:click={calcRebalance}>{t('tools.calculate')}</button>

        {#if rebalanceResults}
          <div class="rebalance-results">
            <div class="rb-result-header">
              <span class="rb-res-name">{t('tools.assetName')}</span>
              <span class="rb-res-num">{t('tools.deviation')}</span>
              <span class="rb-res-num">{t('tools.action')}</span>
              <span class="rb-res-num">{t('liability.amount')}</span>
            </div>
            {#each rebalanceResults as r}
              <div class="rb-result-row">
                <span class="rb-res-name">{r.name}</span>
                <span class="rb-res-num" style="color: {Math.abs(r.deviation) > 10 ? 'var(--color-warning)' : 'var(--text-secondary)'}">
                  {r.deviation > 0 ? '+' : ''}{r.deviation.toFixed(1)}%
                </span>
                <span class="rb-res-num" style="color: {r.diff > 0 ? 'var(--color-positive)' : (r.diff < 0 ? 'var(--color-negative)' : 'var(--text-muted)')}">
                  {r.action}
                </span>
                <span class="rb-res-num" style="color: {r.diff > 0 ? 'var(--color-positive)' : (r.diff < 0 ? 'var(--color-negative)' : 'var(--text-muted)')}">
                  {r.diff >= 0 ? '+' : ''}{Math.round(r.diff).toLocaleString('zh-TW')}
                </span>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .tools-page {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  .page-title {
    font-size: var(--font-size-2xl);
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: var(--spacing-sm);
  }

  /* ── 手風琴 ── */
  .tool-section {
    padding: 0;
    overflow: hidden;
  }

  .tool-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: var(--spacing-lg);
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--text-primary);
    text-align: left;
    transition: background-color var(--transition-fast);
  }

  .tool-header:hover {
    background-color: var(--bg-hover);
  }

  .tool-header:active {
    transform: none;
  }

  .tool-header-text {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
  }

  .tool-icon {
    font-size: 1.5rem;
    line-height: 1;
    flex-shrink: 0;
  }

  .tool-title {
    font-size: var(--font-size-base);
    font-weight: 600;
    color: var(--text-primary);
  }

  .tool-desc {
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
    margin-top: 2px;
  }

  .tool-chevron {
    font-size: var(--font-size-lg);
    color: var(--text-muted);
    transition: transform var(--transition-base);
    flex-shrink: 0;
  }

  .tool-chevron.open {
    transform: rotate(180deg);
  }

  .tool-body {
    padding: 0 var(--spacing-lg) var(--spacing-lg);
    border-top: 1px solid var(--border-color);
    padding-top: var(--spacing-lg);
  }

  .tool-calc-btn {
    width: 100%;
    margin-top: var(--spacing-md);
  }

  .tool-add-btn {
    width: 100%;
    margin-top: var(--spacing-sm);
  }

  .tool-divider {
    border: none;
    border-top: 1px solid var(--border-color);
    margin: var(--spacing-lg) 0;
  }

  .tool-subtitle {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--accent-color);
    margin-bottom: var(--spacing-md);
  }

  /* ── 結果區 ── */
  .tool-results {
    margin-top: var(--spacing-lg);
    background: var(--bg-tertiary);
    border-radius: var(--border-radius-md);
    padding: var(--spacing-md);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .result-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-xs) 0;
  }

  .result-label {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
  }

  .result-value {
    font-size: var(--font-size-base);
    font-weight: 700;
    color: var(--accent-color);
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
  }

  .result-badge {
    font-size: var(--font-size-xs);
    font-weight: 600;
    color: #fff;
    padding: 2px 8px;
    border-radius: var(--border-radius-full);
  }

  /* ── 再平衡表格 ── */
  .rebalance-table-header {
    display: flex;
    gap: var(--spacing-sm);
    padding-bottom: var(--spacing-xs);
    border-bottom: 1px solid var(--border-color);
    margin-bottom: var(--spacing-sm);
  }

  .rebalance-table-header span {
    font-size: var(--font-size-xs);
    color: var(--text-muted);
    font-weight: 600;
  }

  .rb-col-name { flex: 2; }
  .rb-col-target { flex: 1; text-align: center; }
  .rb-col-current { flex: 1; text-align: center; }

  .rebalance-row {
    display: flex;
    gap: var(--spacing-sm);
    margin-bottom: var(--spacing-sm);
  }

  .rb-input-name { flex: 2; }
  .rb-input-num { flex: 1; text-align: right; }

  .rebalance-results {
    margin-top: var(--spacing-lg);
    background: var(--bg-tertiary);
    border-radius: var(--border-radius-md);
    overflow: hidden;
  }

  .rb-result-header {
    display: flex;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
  }

  .rb-result-header span {
    font-size: var(--font-size-xs);
    color: var(--text-muted);
    font-weight: 600;
  }

  .rb-result-row {
    display: flex;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    border-bottom: 1px solid var(--border-color);
  }

  .rb-result-row:last-child {
    border-bottom: none;
  }

  .rb-res-name {
    flex: 2;
    font-size: var(--font-size-sm);
    color: var(--text-primary);
    font-weight: 500;
  }

  .rb-res-num {
    flex: 1;
    font-size: var(--font-size-sm);
    text-align: right;
    font-weight: 600;
  }
</style>
