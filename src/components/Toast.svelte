<!--
  Toast.svelte — 全域 Toast 通知元件

  支援 success / error 兩種樣式。
  顯示後 2.5 秒自動隱藏。
  透過 toastStore 提供全域 showToast(message, type) 函式。
-->
<script>
  import { toastMessage, toastType, toastVisible } from '$lib/stores/toast.js';

  /* 響應式綁定 store 值 */
  $: message = $toastMessage;
  $: type = $toastType;
  $: visible = $toastVisible;
</script>

{#if visible}
  <div
    class="toast {type}"
    role="status"
    aria-live="polite"
  >
    {message}
  </div>
{/if}
