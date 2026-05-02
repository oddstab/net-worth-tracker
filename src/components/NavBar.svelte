<!--
  NavBar.svelte — 導覽列（Telegram 風格）
  
  桌面：固定頂部導覽列
  手機：固定底部膠囊導覽列 + 氣泡切換動畫
-->
<script>
  import { page } from '$app/stores';
  import { base } from '$app/paths';
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
</script>

<!-- 手機版：頂部 banner -->
<div class="mobile-banner">
  <span class="navbar-title">{t('common.appName')}</span>
  <button class="theme-toggle" on:click={toggleTheme} aria-label="Toggle theme">
    {#if $theme === 'dark'}<Icon name="sun" size={18}/>{:else}<Icon name="moon" size={18}/>{/if}
  </button>
</div>

<!-- 桌面版：頂部導覽列 -->
<nav class="navbar navbar-desktop" aria-label="主導覽列">
  <div class="navbar-brand">
    <span class="navbar-title">{t('common.appName')}</span>
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
      {#if $theme === 'dark'}<Icon name="sun" size={18}/>{:else}<Icon name="moon" size={18}/>{/if}
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
      justify-content: center;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 48px;
      background-color: var(--bg-secondary);
      border-bottom: 1px solid var(--border-color);
      z-index: 100;
      overscroll-behavior: none;
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
  }
  .theme-toggle:hover { background: var(--bg-hover); }
  :global([data-theme="dark"]) .theme-toggle {
    color: #fbbf24;
    filter: drop-shadow(0 0 6px rgba(251, 191, 36, 0.6));
  }
</style>
