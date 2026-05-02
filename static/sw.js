/**
 * Service Worker — Net Worth Tracker (SvelteKit SPA)
 *
 * Cache Strategy:
 *  - App Shell (local assets): Cache First
 *  - API requests (TWSE, CoinGecko): Network First (no cache on failure)
 *
 * 從原有 sw.js 遷移至 SvelteKit 架構。
 * SvelteKit 建置後的靜態檔案路徑與原有不同，
 * 因此 App Shell 清單改為動態快取（不預快取具體路徑）。
 */

const CACHE_NAME = 'nwt-app-shell-v6';

/** URL patterns that should use Network First strategy */
const NETWORK_FIRST_PATTERNS = [
  'mis.twse.com.tw',
  'api.coingecko.com',
  'openapi.twse.com.tw',
  'corsproxy.io',
];

// ── Install: activate immediately for new installs ────────────────────────
self.addEventListener('install', (event) => {
  // 不預快取具體路徑，改為在 fetch 時動態快取
  // SvelteKit 建置後的檔案帶有 hash，無法預先列舉
  event.waitUntil(
    caches.open(CACHE_NAME).then(() => {
      console.log('[SW] Cache opened:', CACHE_NAME);
    })
  );
});

// ── Message: allow the app to trigger skipWaiting on demand ───────────────
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ── Activate: clean up old caches ────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// ── Fetch: route requests to appropriate strategy ─────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests
  if (request.method !== 'GET') return;

  // Network First for external API requests
  if (NETWORK_FIRST_PATTERNS.some((pattern) => url.hostname.includes(pattern))) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Network First for navigation (HTML pages) — prevents stale cache
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  // Cache First for static assets (JS/CSS/images with hashes)
  event.respondWith(cacheFirst(request));
});

/**
 * Cache First strategy:
 * 1. Try cache → return if found
 * 2. Fetch from network → cache response → return
 */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    console.warn('[SW] Cache First fetch failed:', request.url, err);
    // Return a basic offline fallback for navigation requests
    if (request.mode === 'navigate') {
      const fallback = await caches.match('/index.html') || await caches.match('/');
      if (fallback) return fallback;
    }
    throw err;
  }
}

/**
 * Network First strategy:
 * 1. Try network → return if successful
 * 2. On failure → return synthetic error response (API data must be fresh)
 */
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    return response;
  } catch (err) {
    console.warn('[SW] Network First fetch failed (API):', request.url, err);
    // Return a synthetic error response so the app can handle it gracefully
    return new Response(
      JSON.stringify({ error: 'Network unavailable' }),
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
