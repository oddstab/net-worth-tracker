<!--
  BackgroundImageSetting.svelte — 背景圖片設定（多圖輪播版）

  支援：
  - 上傳多張圖片
  - 拖曳排序
  - 刪除單張
  - 調整透明度
  - 設定自動切換秒數（0 = 不切換）
-->
<script>
  import { t } from '$lib/services/i18n.js';
  import { showToast } from '$lib/stores/toast.js';
  import {
    backgroundImages,
    backgroundOpacity,
    backgroundInterval,
    backgroundEnabled,
    modalOpacity,
    addBackgroundImages,
    removeBackgroundImage,
    clearAllBackgroundImages,
    reorderBackgroundImages,
    startSlideshow
  } from '$lib/stores/backgroundImage.js';
  import Icon from '../Icon.svelte';

  /** 允許的圖片格式 */
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

  /** 隱藏的 file input 參考 */
  let fileInput;

  /** 拖曳中的索引 */
  let dragIndex = -1;

  /** 拖曳目標索引 */
  let dragOverIndex = -1;

  function triggerUpload() {
    fileInput?.click();
  }

  /**
   * 處理多檔案選擇。
   */
  function handleFileChange(event) {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const validFiles = [];
    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        showToast(t('settings.imageFormatError'), 'error');
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) {
      event.target.value = '';
      return;
    }

    // 讀取所有有效檔案
    let loaded = 0;
    const results = [];
    for (const file of validFiles) {
      const reader = new FileReader();
      reader.onload = (e) => {
        results.push(e.target.result);
        loaded++;
        if (loaded === validFiles.length) {
          addBackgroundImages(results);
          showToast(t('settings.imageUploaded'), 'success');
        }
      };
      reader.readAsDataURL(file);
    }

    event.target.value = '';
  }

  function handleRemoveOne(index) {
    removeBackgroundImage(index);
  }

  function handleRemoveAll() {
    clearAllBackgroundImages();
    showToast(t('settings.imageRemoved'), 'success');
  }

  function handleOpacityChange(event) {
    backgroundOpacity.set(parseFloat(event.target.value));
  }

  function handleModalOpacityChange(event) {
    modalOpacity.set(parseFloat(event.target.value));
  }

  function handleToggleEnabled() {
    backgroundEnabled.update(v => !v);
  }

  function handleIntervalChange(event) {
    const val = parseInt(event.target.value, 10);
    backgroundInterval.set(isNaN(val) || val < 0 ? 0 : val);
    startSlideshow();
  }

  // ── 防誤觸：滑桿需長按 300ms 才啟動拖動 ──
  /** 是否已解鎖滑桿（長按後才允許拖動） */
  let sliderUnlocked = false;
  /** 長按計時器 */
  let sliderLockTimer = null;
  /** 長按啟動門檻（毫秒） */
  const SLIDER_LOCK_DELAY = 300;

  /**
   * touchstart：開始計時，到達門檻後解鎖滑桿。
   * 在解鎖前阻止 input 事件傳遞。
   */
  function onSliderTouchStart(event) {
    sliderUnlocked = false;
    sliderLockTimer = setTimeout(() => {
      sliderUnlocked = true;
      // 給予觸覺回饋（如果瀏覽器支援）
      if (navigator.vibrate) navigator.vibrate(10);
    }, SLIDER_LOCK_DELAY);
  }

  /**
   * touchend / touchcancel：清除計時器並重新鎖定。
   */
  function onSliderTouchEnd() {
    clearTimeout(sliderLockTimer);
    sliderLockTimer = null;
    // 延遲重新鎖定，讓最後一次 input 事件能正常觸發
    setTimeout(() => { sliderUnlocked = false; }, 50);
  }

  /**
   * 包裝 input handler：只有解鎖後才允許更新值。
   */
  function guardedOpacityChange(event) {
    if (!sliderUnlocked) {
      // 還原為目前值，阻止誤觸改變
      event.target.value = $backgroundOpacity;
      return;
    }
    handleOpacityChange(event);
  }

  function guardedModalOpacityChange(event) {
    if (!sliderUnlocked) {
      event.target.value = 1 - $modalOpacity;
      return;
    }
    modalOpacity.set(1 - parseFloat(event.target.value));
  }

  function guardedIntervalChange(event) {
    if (!sliderUnlocked) {
      event.target.value = $backgroundInterval;
      return;
    }
    handleIntervalChange(event);
  }

  // ── 拖曳排序 ──
  function onDragStart(index) {
    dragIndex = index;
  }

  function onDragOver(event, index) {
    event.preventDefault();
    dragOverIndex = index;
  }

  function onDragEnd() {
    if (dragIndex >= 0 && dragOverIndex >= 0 && dragIndex !== dragOverIndex) {
      const imgs = [...$backgroundImages];
      const [moved] = imgs.splice(dragIndex, 1);
      imgs.splice(dragOverIndex, 0, moved);
      reorderBackgroundImages(imgs);
    }
    dragIndex = -1;
    dragOverIndex = -1;
  }

  // ── 按鈕排序（手機友善）──
  function moveUp(index) {
    if (index <= 0) return;
    const imgs = [...$backgroundImages];
    [imgs[index - 1], imgs[index]] = [imgs[index], imgs[index - 1]];
    reorderBackgroundImages(imgs);
  }

  function moveDown(index) {
    if (index >= $backgroundImages.length - 1) return;
    const imgs = [...$backgroundImages];
    [imgs[index], imgs[index + 1]] = [imgs[index + 1], imgs[index]];
    reorderBackgroundImages(imgs);
  }
</script>

<section class="settings-section">
  <h2 class="settings-section-title">{t('settings.backgroundImage')}</h2>
  <p class="settings-desc">{t('settings.backgroundImageDesc')}</p>

  <!-- 開關 -->
  <div class="bg-toggle-row">
    <span class="bg-toggle-label">{t('settings.bgEnabled')}</span>
    <button
      class="bg-toggle-btn"
      class:active={$backgroundEnabled}
      on:click={handleToggleEnabled}
      aria-label="Toggle background"
    >
      <span class="bg-toggle-knob"></span>
    </button>
  </div>

  <!-- 隱藏的 file input（支援多選） -->
  <input
    bind:this={fileInput}
    type="file"
    accept="image/jpeg,image/png,image/webp"
    multiple
    on:change={handleFileChange}
    class="visually-hidden"
    aria-hidden="true"
  />

  {#if $backgroundImages.length > 0}
    <!-- 圖片列表 -->
    <div class="bg-list">
      {#each $backgroundImages as img, i (img.slice(0, 50) + i)}
        <div
          class="bg-item"
          class:dragging={dragIndex === i}
          class:drag-over={dragOverIndex === i && dragIndex !== i}
          draggable="true"
          on:dragstart={() => onDragStart(i)}
          on:dragover={(e) => onDragOver(e, i)}
          on:dragend={onDragEnd}
          role="listitem"
        >
          <img src={img} alt="背景 {i + 1}" class="bg-thumb" />
          <span class="bg-item-index">#{i + 1}</span>
          <div class="bg-item-actions">
            <button class="btn-icon" on:click={() => moveUp(i)} disabled={i === 0} aria-label="上移" title="上移">
              <Icon name="chevron-up" size={14}/>
            </button>
            <button class="btn-icon" on:click={() => moveDown(i)} disabled={i === $backgroundImages.length - 1} aria-label="下移" title="下移">
              <Icon name="chevron-down" size={14}/>
            </button>
            <button class="btn-icon btn-delete" on:click={() => handleRemoveOne(i)} aria-label="刪除" title="刪除">
              <Icon name="x" size={14}/>
            </button>
          </div>
        </div>
      {/each}
    </div>

    <!-- 透明度滑桿 -->
    <div class="opacity-control">
      <div class="opacity-header">
        <label class="form-label" for="bg-opacity-slider">{t('settings.opacity')}</label>
        <span class="opacity-value">{Math.round($backgroundOpacity * 100)}%</span>
      </div>
      <input
        id="bg-opacity-slider"
        type="range"
        min="0.01"
        max="0.9"
        step="0.01"
        value={$backgroundOpacity}
        on:input={guardedOpacityChange}
        on:touchstart={onSliderTouchStart}
        on:touchend={onSliderTouchEnd}
        on:touchcancel={onSliderTouchEnd}
        class="drawdown-slider"
        style="background: linear-gradient(to right, var(--accent-color) {($backgroundOpacity - 0.01) / 0.89 * 100}%, var(--bg-tertiary) {($backgroundOpacity - 0.01) / 0.89 * 100}%);"
      />
      <span class="form-hint">{t('settings.sliderHint')}</span>
    </div>

    <!-- Modal 透明度滑桿 -->
    <div class="opacity-control">
      <div class="opacity-header">
        <label class="form-label" for="modal-opacity-slider">{t('settings.modalOpacity')}</label>
        <span class="opacity-value">{Math.round((1 - $modalOpacity) * 100)}%</span>
      </div>
      <input
        id="modal-opacity-slider"
        type="range"
        min="0"
        max="0.5"
        step="0.01"
        value={1 - $modalOpacity}
        on:input={guardedModalOpacityChange}
        on:touchstart={onSliderTouchStart}
        on:touchend={onSliderTouchEnd}
        on:touchcancel={onSliderTouchEnd}
        class="drawdown-slider"
        style="background: linear-gradient(to right, var(--accent-color) {(1 - $modalOpacity) / 0.5 * 100}%, var(--bg-tertiary) {(1 - $modalOpacity) / 0.5 * 100}%);"
      />
      <span class="form-hint">{t('settings.modalOpacityHint')}</span>
    </div>

    <!-- 切換間隔 -->
    {#if $backgroundImages.length > 1}
      <div class="interval-control">
        <div class="opacity-header">
          <label class="form-label" for="bg-interval-input">{t('settings.switchInterval')}</label>
          <span class="opacity-value">{$backgroundInterval}s</span>
        </div>
        <div class="interval-row">
          <input
            id="bg-interval-input"
            type="range"
            min="0"
            max="60"
            step="1"
            value={$backgroundInterval}
            on:input={guardedIntervalChange}
            on:touchstart={onSliderTouchStart}
            on:touchend={onSliderTouchEnd}
            on:touchcancel={onSliderTouchEnd}
            class="drawdown-slider"
            style="background: linear-gradient(to right, var(--accent-color) {$backgroundInterval / 60 * 100}%, var(--bg-tertiary) {$backgroundInterval / 60 * 100}%);"
          />
        </div>
        <span class="form-hint">{t('settings.switchIntervalHint')}</span>
      </div>
    {/if}

    <!-- 操作按鈕 -->
    <div class="bg-actions">
      <button class="btn btn-secondary" on:click={triggerUpload}>
        <Icon name="upload" size={16} /> {t('settings.uploadImage')}
      </button>
      <button class="btn btn-secondary btn-danger-outline" on:click={handleRemoveAll}>
        <Icon name="trash-2" size={16} /> {t('settings.removeAllImages')}
      </button>
    </div>
  {:else}
    <button class="btn btn-primary" style="width: 100%;" on:click={triggerUpload}>
      <Icon name="upload" size={16} /> {t('settings.uploadImage')}
    </button>
  {/if}
</section>

<style>
  .settings-desc {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    margin-bottom: var(--spacing-md);
  }

  .bg-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    margin-bottom: var(--spacing-md);
    max-height: 280px;
    overflow-y: auto;
  }

  .bg-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-xs) var(--spacing-sm);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-sm);
    background: var(--bg-tertiary);
    cursor: grab;
    transition: opacity 0.15s, border-color 0.15s;
  }

  .bg-item:active { cursor: grabbing; }

  .bg-item.dragging {
    opacity: 0.4;
  }

  .bg-item.drag-over {
    border-color: var(--accent-color);
  }

  .bg-thumb {
    width: 48px;
    height: 32px;
    object-fit: cover;
    border-radius: 4px;
    flex-shrink: 0;
  }

  .bg-item-index {
    font-size: var(--font-size-xs);
    color: var(--text-muted);
    min-width: 24px;
  }

  .bg-item-actions {
    margin-left: auto;
    display: flex;
    gap: 2px;
    flex-shrink: 0;
  }

  .bg-item-actions .btn-icon {
    min-width: 28px;
    min-height: 28px;
    padding: 2px;
  }

  .opacity-control, .interval-control {
    margin-bottom: var(--spacing-md);
  }

  .opacity-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--spacing-sm);
  }

  .opacity-header .form-label {
    margin-bottom: 0;
  }

  .opacity-value {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--accent-color);
    min-width: 40px;
    text-align: right;
  }

  .interval-row {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .interval-row .drawdown-slider {
    flex: 1;
  }

  .bg-actions {
    display: flex;
    gap: var(--spacing-sm);
  }

  .bg-actions .btn {
    flex: 1;
  }

  .btn-danger-outline {
    color: var(--color-negative);
    border-color: var(--color-negative);
  }

  .btn-danger-outline:hover {
    background-color: var(--color-negative);
    color: #fff;
  }

  /* Toggle switch */
  .bg-toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--spacing-md);
  }

  .bg-toggle-label {
    font-size: var(--font-size-sm);
    font-weight: 500;
    color: var(--text-primary);
  }

  .bg-toggle-btn {
    position: relative;
    width: 48px;
    height: 26px;
    border-radius: 13px;
    border: none;
    background: var(--bg-hover);
    cursor: pointer;
    transition: background 0.2s ease;
    padding: 0;
  }

  .bg-toggle-btn.active {
    background: var(--accent-color);
  }

  .bg-toggle-knob {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #fff;
    transition: transform 0.2s ease;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  }

  .bg-toggle-btn.active .bg-toggle-knob {
    transform: translateX(22px);
  }
</style>
