<!--
  ConfirmDialog.svelte — 自訂確認對話框

  取代瀏覽器原生 confirm()。
  透過 confirmDialogStore 控制顯示/隱藏與回呼。
  所有文字使用 t() 翻譯函式。
-->
<script>
  import { t } from '$lib/services/i18n.js';
  import { tStore } from '$lib/services/i18n.js';
  import { onDestroy } from 'svelte';
  import { lockScroll, unlockScroll } from '$lib/utils/scrollLock.js';
  import Icon from './Icon.svelte';
  import {
    confirmVisible,
    confirmTitle,
    confirmMessage,
    confirmOnConfirm,
    hideConfirmDialog
  } from '$lib/stores/confirmDialog.js';

  // ── Modal 開啟時鎖定背景滾動 ──
  $: if ($confirmVisible) {
    lockScroll();
  } else {
    unlockScroll();
  }
  onDestroy(() => {
    unlockScroll();
  });

  /** 使用者確認 */
  function handleConfirm() {
    const callback = $confirmOnConfirm;
    hideConfirmDialog();
    if (typeof callback === 'function') {
      callback();
    }
  }

  /** 使用者取消 */
  function handleCancel() {
    hideConfirmDialog();
  }

  /**
   * 按下 Escape 鍵時關閉對話框
   * @param {KeyboardEvent} e
   */
  function handleKeydown(e) {
    if (e.key === 'Escape' && $confirmVisible) {
      handleCancel();
    }
  }

  /* 訂閱 tStore 以在語言切換時觸發重新渲染 */
  $: _t = $tStore;
</script>

<svelte:window on:keydown={handleKeydown} />

{#if $confirmVisible}
  <!-- 背景遮罩（禁止點擊外部關閉） -->
  <div
    class="modal-overlay"
    role="presentation"
  >
    <!-- 對話框本體 -->
    <div
      class="modal"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-message"
    >
      <div class="modal-header">
        <h2 class="modal-title" id="confirm-dialog-title">
          {$confirmTitle || t('confirm.deleteTitle')}
        </h2>
        <button
          class="modal-close"
          on:click={handleCancel}
          aria-label={t('common.close')}
        >
          <Icon name="x" size={18}/>
        </button>
      </div>

      <div class="modal-body" style="padding-bottom: var(--spacing-lg);">
        <p id="confirm-dialog-message" style="margin-bottom: var(--spacing-md);">{$confirmMessage}</p>
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" on:click={handleCancel}>
          {t('common.cancel')}
        </button>
        <button class="btn btn-danger" on:click={handleConfirm}>
          {t('common.confirm')}
        </button>
      </div>
    </div>
  </div>
{/if}
