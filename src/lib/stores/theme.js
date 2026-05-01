/**
 * theme.js — 主題 store（深色/淺色模式）
 */
import { writable } from 'svelte/store';

const STORAGE_KEY = 'nwt_theme';
const DEFAULT_THEME = 'dark';

function getInitialTheme() {
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_THEME;
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

export function toggleTheme() {
  theme.update(t => t === 'dark' ? 'light' : 'dark');
}
