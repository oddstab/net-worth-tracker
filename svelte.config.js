// SvelteKit 配置 — 使用 adapter-static 以 SPA 模式運行
import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter({
      // SPA fallback：所有路由都導向 index.html，由客戶端路由處理
      fallback: 'index.html'
    })
  }
};

export default config;
