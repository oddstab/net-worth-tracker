<!--
  LiabilityList.svelte — 負債清單

  按分類分組顯示（信貸、房貸、質押借款、理財型房貸、其他），每組顯示小計金額。
  所有文字使用 t() 翻譯函式。
-->
<script>
  import { createEventDispatcher } from 'svelte';
  import { t } from '$lib/services/i18n.js';
  import { tStore } from '$lib/services/i18n.js';
  import { formatCurrency } from '$lib/services/localeFormatter.js';
  import { calculateTotals } from '$lib/utils/calculator.js';
  import LiabilityItem from './LiabilityItem.svelte';

  const dispatch = createEventDispatcher();

  /** 負債陣列 */
  export let liabilities = [];

  /** 資產陣列（用於計算 totals） */
  export let assets = [];

  /** USD/TWD 匯率 */
  export let exchangeRate = 31.5;

  /* 訂閱 tStore 以在語言切換時觸發重新渲染 */
  $: _t = $tStore;

  /** 分類順序與標籤對照 */
  const CATEGORY_ORDER = ['credit', 'home_loan', 'pledge', 'mortgage', 'other'];

  /** 分類標籤 i18n key 對照 */
  const CATEGORY_KEYS = {
    credit: 'liability.credit',
    home_loan: 'liability.homeLoan',
    pledge: 'liability.pledge',
    mortgage: 'liability.mortgage',
    other: 'liability.other',
  };

  /** 計算各分類小計 */
  $: totals = calculateTotals(assets, liabilities, exchangeRate);

  /** 各分類小計對照 */
  $: subtotals = {
    credit: totals.creditTotal,
    home_loan: totals.homeLoanTotal,
    pledge: totals.pledgeTotal,
    mortgage: totals.mortgageTotal,
    other: totals.otherLiabilityTotal,
  };

  /** 依分類分組 */
  $: groupedLiabilities = CATEGORY_ORDER.map(cat => ({
    category: cat,
    label: t(CATEGORY_KEYS[cat]),
    items: liabilities.filter(l => l.category === cat),
    subtotal: subtotals[cat] || 0,
  })).filter(g => g.items.length > 0);

  /** 編輯負債 */
  function handleEdit(e) {
    dispatch('editLiability', e.detail);
  }
</script>

{#each groupedLiabilities as group (group.category)}
  <div class="liability-category">
    <div class="category-header">
      <h3 class="category-title">{group.label}</h3>
      <span class="category-subtotal">{formatCurrency(group.subtotal)}</span>
    </div>
    <div class="category-items">
      {#each group.items as liability (liability.id)}
        <LiabilityItem
          {liability}
          {exchangeRate}
          on:edit={handleEdit}
        />
      {/each}
    </div>
  </div>
{/each}
