<!--
  NavBar.svelte — 導覽列（Telegram 風格）
  
  桌面：固定頂部導覽列
  手機：固定底部膠囊導覽列 + 氣泡切換動畫
-->
<script>
  import { page } from '$app/stores';
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import { t } from '$lib/services/i18n.js';
  import { tStore } from '$lib/services/i18n.js';
  import { theme, toggleTheme } from '$lib/stores/theme.js';
  import Icon from './Icon.svelte';

  const tabs = [
    { href: '/', label: () => t('nav.dashboard'), icon: 'dashboard' },
    { href: '/assets', label: () => t('nav.assets'), icon: 'wallet' },
    { href: '/tools', label: () => t('nav.tools'), icon: 'calculator' },
    { href: '/settings', label: () => t('nav.settings'), icon: 'settings' }
  ];

  function isActive(href, pathname) {
    const fullHref = base + href;
    if (href === '/') return pathname === base || pathname === base + '/';
    return pathname.startsWith(fullHref);
  }

  /** 當前 active tab index（用於氣泡動畫定位） */
  $: activeIndex = tabs.findIndex(tab => isActive(tab.href, $page.url.pathname));

  $: _t = $tStore;

  /**
   * 點擊標題：若已在首頁則捲到頂部，否則導航到首頁。
   */
  function handleTitleClick() {
    const isHome = $page.url.pathname === base || $page.url.pathname === base + '/';
    if (isHome) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      goto(base + '/');
    }
  }
</script>

<!-- 手機版：頂部 banner -->
<div class="mobile-banner">
  <a href="{base}/" class="navbar-title-link" on:click|preventDefault={handleTitleClick}>
    <span class="navbar-title">{t('common.appName')}</span>
  </a>
  <button class="theme-toggle" on:click={toggleTheme} aria-label="Toggle theme">
    {#if $theme === 'dark'}<Icon name="sun" size={18}/>{:else if $theme === 'light'}<Icon name="zap" size={18}/>{:else}<Icon name="moon" size={18}/>{/if}
  </button>
</div>

<!-- 桌面版：頂部導覽列 -->
<nav class="navbar navbar-desktop" aria-label="主導覽列">
  <div class="navbar-brand">
    <a href="{base}/" class="navbar-title-link" on:click|preventDefault={handleTitleClick}>
      <span class="navbar-title">{t('common.appName')}</span>
    </a>
  </div>
  <div class="navbar-tabs" role="tablist">
    {#each tabs as tab}
      <a
        href="{base}{tab.href}"
        class="nav-tab"
        class:active={isActive(tab.href, $page.url.pathname)}
        role="tab"
        aria-selected={isActive(tab.href, $page.url.pathname)}
      >
        <Icon name={tab.icon} size={16}/> {tab.label()}
      </a>
    {/each}
    <button class="theme-toggle" on:click={toggleTheme} aria-label="Toggle theme">
      {#if $theme === 'dark'}<Icon name="sun" size={18}/>{:else if $theme === 'light'}<Icon name="zap" size={18}/>{:else}<Icon name="moon" size={18}/>{/if}
    </button>
  </div>
</nav>

<!-- 手機版：底部膠囊導覽列 -->
<nav class="navbar-mobile-capsule" aria-label="主導覽列">
  <div class="capsule-inner" role="tablist">
    <!-- 氣泡背景指示器 -->
    <div
      class="capsule-bubble"
      style="left: calc(4px + {activeIndex} * (100% - 8px) / {tabs.length}); width: calc((100% - 8px) / {tabs.length});"
    ></div>
    {#each tabs as tab, i}
      <a
        href="{base}{tab.href}"
        class="capsule-tab"
        class:active={isActive(tab.href, $page.url.pathname)}
        role="tab"
        aria-selected={isActive(tab.href, $page.url.pathname)}
      >
        <span class="capsule-icon"><Icon name={tab.icon} size={20}/></span>
        <span class="capsule-label">{tab.label()}</span>
      </a>
    {/each}
  </div>
</nav>

<style>
  .mobile-banner { display: none; }

  @media (max-width: 767px) {
    .mobile-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 48px;
      background-color: var(--bg-secondary);
      border-bottom: 1px solid var(--border-color);
      z-index: 100;
      overscroll-behavior: none;
      padding: 0 var(--spacing-md);
    }
    .mobile-banner .navbar-title {
      font-size: var(--font-size-lg);
      font-weight: 700;
      color: var(--accent-color);
    }
  }

  .navbar-mobile-capsule { display: none; }

  @media (max-width: 767px) {
    .navbar-desktop { display: none !important; }

    .navbar-mobile-capsule {
      display: block;
      position: fixed;
      bottom: 12px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 100;
      width: calc(100% - 24px);
      overscroll-behavior: none;
      max-width: 420px;
    }

    .capsule-inner {
      display: flex;
      align-items: center;
      position: relative;
      overflow: hidden;
      background: rgba(26, 26, 46, 0.75);
      backdrop-filter: blur(20px) saturate(180%);
      -webkit-backdrop-filter: blur(20px) saturate(180%);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 999px;
      padding: 4px;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
    }

    /* Light mode 膠囊：半透明白色 */
    :global([data-theme="light"]) .capsule-inner {
      background: rgba(255, 255, 255, 0.78);
      border: 1px solid rgba(0, 0, 0, 0.06);
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
    }

    /* Brawl 膠囊：巧克力色實心膠囊 + 粗黑邊 + 立體底影（荒野亂鬥 UI 風格） */
    :global([data-theme="brawl"]) .capsule-inner {
      background: #5a3920;
      backdrop-filter: none;
      -webkit-backdrop-filter: none;
      border: 3px solid #1a0a00;
      border-radius: 999px;
      padding: 6px;
      box-shadow: 0 4px 0 #1a0a00, 0 6px 16px rgba(0, 0, 0, 0.45);
    }

    /* 氣泡滑動指示器 — 定位在 padding 內部，跟 flex 子元素對齊 */
    .capsule-bubble {
      position: absolute;
      top: 4px;
      bottom: 4px;
      background: var(--accent-light);
      border-radius: 999px;
      transition: left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      z-index: 0;
      pointer-events: none;
    }

    /* Brawl 氣泡：深綠 + 粗黑邊，活躍分頁才顯眼 */
    :global([data-theme="brawl"]) .capsule-bubble {
      top: 6px;
      bottom: 6px;
      background: #1a7a10;
      border: 2px solid #1a0a00;
      box-shadow: inset 0 -2px 0 rgba(0, 0, 0, 0.25);
    }

    /* Brawl 分頁：金棕色文字，活躍分頁亮金黃 */
    :global([data-theme="brawl"]) .capsule-tab {
      color: #c89030;
      font-weight: 700;
    }
    :global([data-theme="brawl"]) .capsule-tab.active {
      color: #ffee8a;
      font-weight: 800;
      text-shadow: 1px 1px 0 #1a0a00;
    }

    .capsule-tab {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1px;
      padding: 6px 0;
      border-radius: 999px;
      text-decoration: none;
      color: var(--text-muted);
      font-size: 10px;
      font-weight: 500;
      transition: color 0.25s ease;
      position: relative;
      z-index: 1;
      -webkit-tap-highlight-color: transparent;
      min-width: 0;
    }

    .capsule-tab:active { transform: scale(0.92); }

    .capsule-tab.active {
      color: var(--accent-color);
      font-weight: 600;
    }

    .capsule-icon { font-size: 18px; line-height: 1; }
    .capsule-label { line-height: 1; white-space: nowrap; }
  }

  @media (min-width: 768px) {
    .navbar-mobile-capsule { display: none !important; }
  }

  a { text-decoration: none; }

  .navbar-title-link {
    text-decoration: none;
    -webkit-tap-highlight-color: transparent;
  }

  .theme-toggle {
    background: transparent;
    border: none;
    font-size: 1.2rem;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: var(--border-radius-sm);
    transition: background var(--transition-fast), filter var(--transition-fast);
    line-height: 1;
    color: var(--text-secondary);
    margin-left: var(--spacing-sm);
  }
  .theme-toggle:hover { background: var(--bg-hover); }
  :global([data-theme="dark"]) .theme-toggle {
    color: #fbbf24;
    filter: drop-shadow(0 0 6px rgba(251, 191, 36, 0.6));
  }
  :global([data-theme="brawl"]) .theme-toggle {
    color: #ffd84a;
    filter: drop-shadow(0 0 6px rgba(255, 216, 74, 0.6));
  }
</style>
