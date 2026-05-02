<!--
  +page.svelte — 資產清單頁面

  組合 AssetList、LiabilityList 元件。
  訂閱 assets、liabilities、exchangeRate stores。
  提供新增/編輯資產與負債的 Modal 開啟邏輯。
  所有文字使用 t() 翻譯函式。
-->
<script>
  import { t } from '$lib/services/i18n.js';
  import { tStore } from '$lib/services/i18n.js';
  import { assets } from '$lib/stores/assets.js';
  import { liabilities } from '$lib/stores/liabilities.js';
  import { exchangeRate } from '$lib/stores/exchangeRate.js';
  import { pendingModal, clearPendingModal } from '$lib/stores/modalState.js';
  import { tdccStore } from '$lib/stores/tdcc.js';
  import AssetList from '../../components/assets/AssetList.svelte';
  import LiabilityList from '../../components/assets/LiabilityList.svelte';
  import AssetModal from '../../components/modals/AssetModal.svelte';
  import LiabilityModal from '../../components/modals/LiabilityModal.svelte';
  import PledgeModal from '../../components/modals/PledgeModal.svelte';

  /* 訂閱 tStore 以在語言切換時觸發重新渲染 */
  $: _t = $tStore;

  // ─── TDCC 集保排名 ─────────────────────────────────────────────────────

  /** 取得台股資產清單供 TDCC 查詢 */
  $: twStocks = $assets
    .filter(a => a.type === 'tw_stock' && a.symbol)
    .reduce((acc, a) => {
      const existing = acc.find(s => s.symbol === a.symbol);
      if (existing) {
        existing.quantity += a.quantity;
      } else {
        acc.push({ symbol: a.symbol, quantity: a.quantity });
      }
      return acc;
    }, []);

  /** 資產變動時重新計算 TDCC 排名（API 資料有快取，不會重複呼叫） */
  $: if (twStocks.length > 0) {
    tdccStore.fetchRankings(twStocks);
  }

  // ─── Modal 狀態 ────────────────────────────────────────────────────────

  /** 資產 Modal 是否開啟 */
  let assetModalOpen = false;

  /** 編輯中的資產（null 表示新增） */
  let editingAsset = null;

  /** 預填資料（針對已存在資產新增，鎖定代號/名稱等） */
  let presetAsset = null;

  /** 負債 Modal 是否開啟 */
  let liabilityModalOpen = false;

  /** 編輯中的負債（null 表示新增） */
  let editingLiability = null;

  /** 質押 Modal 狀態 */
  let pledgeModalOpen = false;
  let pledgeData = null;

  // ─── 資產 Modal 操作 ──────────────────────────────────────────────────

  /** 開啟新增資產 Modal */
  function openAddAsset() {
    editingAsset = null;
    presetAsset = null;
    assetModalOpen = true;
  }

  /** 開啟編輯資產 Modal */
  function handleEditAsset(e) {
    const { id } = e.detail;
    const found = $assets.find(a => a.id === id);
    if (found) {
      editingAsset = found;
      assetModalOpen = true;
    }
  }

  /** 開啟新增相同股票 Modal（預填代號與名稱，鎖定欄位） */
  function handleAddSameStock(e) {
    editingAsset = null;
    presetAsset = e.detail;
    assetModalOpen = true;
  }

  /** 關閉資產 Modal */
  function closeAssetModal() {
    assetModalOpen = false;
    editingAsset = null;
    presetAsset = null;
  }

  // ─── 負債 Modal 操作 ──────────────────────────────────────────────────

  /** 開啟新增負債 Modal */
  function openAddLiability() {
    editingLiability = null;
    liabilityModalOpen = true;
  }

  /** 處理質押事件：開啟質押 Modal */
  function handlePledge(e) {
    pledgeData = e.detail;
    pledgeModalOpen = true;
  }

  /** 開啟編輯負債 Modal */
  function handleEditLiability(e) {
    const { id } = e.detail;
    const found = $liabilities.find(l => l.id === id);
    if (found) {
      editingLiability = found;
      liabilityModalOpen = true;
    }
  }

  /** 關閉負債 Modal */
  function closeLiabilityModal() {
    liabilityModalOpen = false;
    editingLiability = null;
  }

  /** 是否為空狀態 */
  $: isEmpty = $assets.length === 0 && $liabilities.length === 0;

  // ─── 監聽 FAB 觸發的全域 Modal 請求 ────────────────────────────────────
  $: if ($pendingModal === 'asset') {
    openAddAsset();
    clearPendingModal();
  }
  $: if ($pendingModal === 'liability') {
    openAddLiability();
    clearPendingModal();
  }
</script>

<div id="page-assets">
  {#if isEmpty}
    <!-- 空狀態提示 -->
    <div class="empty-state">
      <p>{t('asset.emptyState')}</p>
    </div>
  {:else}
    <!-- 資產清單 -->
    <AssetList
      assets={$assets}
      exchangeRate={$exchangeRate}
      on:editAsset={handleEditAsset}
      on:addSameStock={handleAddSameStock}
      on:pledge={handlePledge}
    />

    <!-- 負債清單 -->
    <LiabilityList
      liabilities={$liabilities}
      assets={$assets}
      exchangeRate={$exchangeRate}
      on:editLiability={handleEditLiability}
    />
  {/if}
</div>

<!-- 資產 Modal -->
{#if assetModalOpen}
  <AssetModal asset={editingAsset} preset={presetAsset} on:close={closeAssetModal} />
{/if}

<!-- 負債 Modal -->
{#if liabilityModalOpen}
  <LiabilityModal liability={editingLiability} on:close={closeLiabilityModal} />
{/if}

<!-- 質押 Modal -->
{#if pledgeModalOpen && pledgeData}
  <PledgeModal
    symbol={pledgeData.symbol}
    name={pledgeData.name}
    marketValue={pledgeData.marketValue}
    quantity={pledgeData.quantity}
    on:close={() => { pledgeModalOpen = false; pledgeData = null; }}
  />
{/if}
