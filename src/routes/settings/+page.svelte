<!--
  settings/+page.svelte — 設定頁面

  組合所有設定區塊元件：
  - ExchangeRateSection（匯率設定）
  - DataManagement（資料匯出/匯入）
  - DiagnosticTools（診斷工具）
  - LanguageSelector（語言選擇器）
  - GoogleIntegration（Google Sheets 整合，Task 19.2 實作）

  所有文字使用 t() 翻譯函式。
-->
<script>
  import ExchangeRateSection from '../../components/settings/ExchangeRateSection.svelte';
  import DataManagement from '../../components/settings/DataManagement.svelte';
  import DiagnosticTools from '../../components/settings/DiagnosticTools.svelte';
  import LanguageSelector from '../../components/settings/LanguageSelector.svelte';
  import GoogleIntegration from '../../components/settings/GoogleIntegration.svelte';
  import { t } from '$lib/services/i18n.js';
</script>

<div class="page-container">
  <div class="settings-grid">
    <div class="settings-col-left">
      <ExchangeRateSection />
      <DataManagement />
      <GoogleIntegration />
    </div>
    <div class="settings-col-right">
      <LanguageSelector />
      <DiagnosticTools />
      <section class="settings-section">
        <h2 class="settings-section-title">{t('settings.about')}</h2>
        <p style="font-size: var(--font-size-sm); color: var(--text-secondary);">
          {t('common.appName')} v1.0.0<br/>
          {t('settings.aboutDesc')}
        </p>
      </section>
    </div>
  </div>
</div>

<style>
  .settings-grid {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  .settings-col-left, .settings-col-right {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  @media (min-width: 1024px) {
    .settings-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--spacing-md);
      align-items: start;
    }
  }
</style>
