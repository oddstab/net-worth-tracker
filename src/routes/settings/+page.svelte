<!--
  settings/+page.svelte — 設定頁面

  組合所有設定區塊元件：
  - CurrencySwitcher（顯示貨幣切換）
  - ExchangeRateSection（匯率設定）
  - DataManagement（資料匯出/匯入）
  - DiagnosticTools（診斷工具）
  - LanguageSelector（語言選擇器）
  - GoogleIntegration（Google Sheets 整合，Task 19.2 實作）

  所有文字使用 t() 翻譯函式。
-->
<script>
  import CurrencySwitcher from '../../components/settings/CurrencySwitcher.svelte';
  import ExchangeRateSection from '../../components/settings/ExchangeRateSection.svelte';
  import DataManagement from '../../components/settings/DataManagement.svelte';
  import DiagnosticTools from '../../components/settings/DiagnosticTools.svelte';
  import LanguageSelector from '../../components/settings/LanguageSelector.svelte';
  import GoogleIntegration from '../../components/settings/GoogleIntegration.svelte';
  import { t } from '$lib/services/i18n.js';
  import Icon from '../../components/Icon.svelte';
  import { showToast } from '$lib/stores/toast.js';

  /** PWA 安裝 */
  let canInstall = false;

  $: if (typeof window !== 'undefined') {
    canInstall = !!window.__pwaInstallPrompt;
  }

  async function handleInstallPWA() {
    const prompt = window.__pwaInstallPrompt;
    if (!prompt) {
      showToast(t('pwa.notSupported'), 'error');
      return;
    }
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') {
      showToast(t('pwa.installed'), 'success');
    }
    window.__pwaInstallPrompt = null;
    canInstall = false;
  }
</script>

<div class="page-container">
  <div class="settings-grid">
    <div class="settings-col-left">
      <CurrencySwitcher />
      <ExchangeRateSection />
      <DataManagement />
      <GoogleIntegration />
    </div>
    <div class="settings-col-right">
      <LanguageSelector />
      <DiagnosticTools />
      <section class="settings-section">
        <h2 class="settings-section-title">{t('settings.about')}</h2>
        <p style="font-size: var(--font-size-sm); color: var(--text-secondary); margin-bottom: var(--spacing-md);">
          {t('common.appName')} v2026.05.03<br/>
          {t('settings.aboutDesc')}
        </p>
        <button class="btn btn-primary" style="width: 100%;" on:click={handleInstallPWA}>
          <Icon name="download" size={16}/> {t('pwa.install')}
        </button>
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
