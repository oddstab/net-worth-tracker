<!--
  FAB.svelte — 浮動操作按鈕（Floating Action Button）

  點擊展開選單，提供「新增資產」與「新增負債」兩個選項。
  最小觸控目標 44px（由 CSS 變數 --fab-size: 56px 保證）。
  所有文字使用 t() 翻譯函式。
-->
<script>
  import { t } from '$lib/services/i18n.js';
  import { tStore } from '$lib/services/i18n.js';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { requestAddAsset, requestAddLiability } from '$lib/stores/modalState.js';
  import Icon from './Icon.svelte';

  /** 選單是否展開 */
  let menuOpen = false;

  /** 切換選單開關 */
  function toggleMenu(e) {
    e.stopPropagation();
    menuOpen = !menuOpen;
  }

  /** 關閉選單 */
  function closeMenu() {
    menuOpen = false;
  }

  /** 新增資產：若不在資產頁則先導航過去，再觸發 Modal */
  function handleAddAsset() {
    closeMenu();
    requestAddAsset();
    if ($page.url.pathname !== '/assets') {
      goto('/assets');
    }
  }

  /** 新增負債：若不在資產頁則先導航過去，再觸發 Modal */
  function handleAddLiability() {
    closeMenu();
    requestAddLiability();
    if ($page.url.pathname !== '/assets') {
      goto('/assets');
    }
  }

  /* 訂閱 tStore 以在語言切換時觸發重新渲染 */
  $: _t = $tStore;
</script>

<!-- 點擊頁面其他區域時關閉選單 -->
<svelte:window on:click={closeMenu} />

<div class="fab-container">
  {#if menuOpen}
    <div class="fab-menu" role="menu">
      <button
        class="fab-menu-item"
        role="menuitem"
        on:click|stopPropagation={handleAddAsset}
      >
        <span class="fab-menu-icon"><Icon name="trending-up" size={18}/></span>
        <span class="fab-menu-label">{t('fab.addAsset')}</span>
      </button>
      <button
        class="fab-menu-item"
        role="menuitem"
        on:click|stopPropagation={handleAddLiability}
      >
        <span class="fab-menu-icon"><Icon name="credit-card" size={18}/></span>
        <span class="fab-menu-label">{t('fab.addLiability')}</span>
      </button>
    </div>
  {/if}

  <button
    class="fab"
    on:click={toggleMenu}
    aria-label={t('fab.addAssetOrLiability')}
    aria-expanded={menuOpen}
    aria-haspopup="true"
  >
    <span class="fab-icon">{#if menuOpen}<Icon name="x" size={24}/>{:else}<Icon name="plus" size={24}/>{/if}</span>
  </button>
</div>
