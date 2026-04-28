/**
 * Service Worker — Net Worth Tracker
 *
 * Cache Strategy:
 *  - App Shell (local assets + Chart.js CDN): Cache First
 *  - API requests (TWSE, CoinGecko): Network First (no cache on failure)
 */

const CACHE_NAME = 'nwt-app-shell-v3';

/** App Shell assets to pre-cache on install */
const APP_SHELL = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/app.js',
  '/js/state.js',
  '/js/storage.js',
  '/js/priceFetcher.js',
  '/js/snapshotManager.js',
  '/js/calculator.js',
  '/js/ui/dashboard.js',
  '/js/ui/assetList.js',
  '/js/ui/trendChart.js',
  '/js/ui/modal.js',
  '/js/ui/settings.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
];

/** URL patterns that should use Network First strategy */
const NETWORK_FIRST_PATTERNS = [
  'mis.twse.com.tw',
  'api.coingecko.com',
];

// ── Install: pre-cache App Shell ──────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Cache what we can; ignore individual failures so install succeeds
      return Promise.allSettled(
        APP_SHELL.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('[SW] Failed to cache:', url, err);
          })
        )
      );
    }).then(() => {
      // Activate immediately without waiting for old SW to be released
      return self.skipWaiting();
    })
  );
});

// ── Activate: clean up old caches ────────────────────────────
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

// ── Fetch: route requests to appropriate strategy ─────────────
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

  // Cache First for App Shell assets
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
      const fallback = await caches.match('/index.html');
      if (fallback) return fallback;
    }
    throw err;
  }
}

/**
 * Network First strategy:
 * 1. Try network → return if successful
 * 2. On failure → do NOT fall back to cache (API data must be fresh)
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
