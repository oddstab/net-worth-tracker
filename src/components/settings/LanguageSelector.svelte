<!--
  LanguageSelector.svelte — 語言選擇器

  列出五種語言的原生名稱：繁體中文、简体中文、日本語、English、한국어。
  選擇後立即切換語言並重新渲染所有 UI 字串，無需重新載入頁面。
-->
<script>
  import { locale } from '$lib/stores/locale.js';
  import { SUPPORTED_LOCALES, LOCALE_NAMES, setLocale, t } from '$lib/services/i18n.js';

  /**
   * 處理語言選擇變更。
   * @param {Event} event
   */
  function handleChange(event) {
    setLocale(event.target.value);
  }
</script>

<section class="settings-section">
  <h2 class="settings-section-title">{t('settings.language')}</h2>
  <div class="settings-row">
    <select
      class="form-input"
      value={$locale}
      on:change={handleChange}
      aria-label={t('settings.language')}
    >
      {#each SUPPORTED_LOCALES as loc}
        <option value={loc}>{LOCALE_NAMES[loc]}</option>
      {/each}
    </select>
  </div>
</section>
