/**
 * theme.js — 主題 store（深色/淺色/Brawl Stars 模式）
 */
import { writable } from 'svelte/store';

const STORAGE_KEY = 'nwt_theme';
const DEFAULT_THEME = 'dark';

/** 支援的主題列表（循環切換順序） */
export const THEMES = ['dark', 'light', 'brawl'];

function getInitialTheme() {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && THEMES.includes(saved)) return saved;
  }
  return DEFAULT_THEME;
}

export const theme = writable(getInitialTheme());

theme.subscribe(($theme) => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, $theme);
  }
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', $theme);
  }
});

/**
 * 循環切換主題：dark → light → brawl → dark
 */
export function toggleTheme() {
  theme.update(t => {
    const idx = THEMES.indexOf(t);
    return THEMES[(idx + 1) % THEMES.length];
  });
}
