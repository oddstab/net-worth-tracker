// SvelteKit 配置 — 使用 adapter-static 以 SPA 模式運行
import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter({
      // GitHub Pages 用 404.html 作為 SPA fallback
      fallback: '404.html',
      pages: 'build',
      assets: 'build'
    }),
    paths: {
      base: '/net-worth-tracker'
    }
  }
};

export default config;
