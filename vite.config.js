// Vite 配置 — 整合 SvelteKit 插件與 Vitest 測試設定
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    // 使用 jsdom 模擬瀏覽器環境（localStorage、DOM 等）
    environment: 'jsdom',

    // 全域設定檔（修正 Node.js v22+ 內建 localStorage 不完整問題）
    setupFiles: ['tests/setup.js'],

    // 測試檔案路徑
    include: ['tests/**/*.test.js', 'src/**/*.test.js'],

    // 覆蓋率設定
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/lib/**/*.js'],
      exclude: ['src/lib/i18n/**']
    },

    // 全域測試 API
    globals: true
  }
});
