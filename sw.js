const CACHE = 'kdigo-aki-v3';
const ASSETS = [
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// ── Install：預快取所有資源，app 首次載入後即可 100% 離線運作 ───────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ── Activate：清除舊版 cache，接管所有分頁 ──────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch：Stale-While-Revalidate ──────────────────────────────────
// 立即回傳快取（零延遲），同時背景更新快取供下次使用。
// 離線時自動回傳快取，無需任何額外處理。
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    caches.open(CACHE).then(async cache => {
      const cached = await cache.match(event.request);

      const networkFetch = fetch(event.request)
        .then(response => {
          if (response.ok) cache.put(event.request, response.clone());
          return response;
        })
        .catch(() => null);

      // 有快取 → 立即回傳，背景更新
      // 無快取 → 等待網路（首次訪問）
      return cached ?? networkFetch;
    })
  );
});
