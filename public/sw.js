'use strict';

// Managed automatically — run `npm version patch|minor|major` to bump.
// sync-version.js updates this to match package.json before each release commit.
const CACHE_VERSION = 'v0.9.1';
const CACHE_NAME = `storegasm-${CACHE_VERSION}`;
const OFFLINE_URL = '/offline.html';

// ─── Install ────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.add(OFFLINE_URL))
      .then(() => self.skipWaiting())
  );
});

// ─── Activate ───────────────────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith('storegasm-') && k !== CACHE_NAME)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function shouldBypass(url, request) {
  if (request.method !== 'GET') return true;
  if (!url.protocol.startsWith('http')) return true;
  // Never intercept Supabase or any cross-origin requests.
  if (url.origin !== self.location.origin) return true;
  // Let Next.js API routes always hit the network.
  if (url.pathname.startsWith('/api/')) return true;
  // Let auth callbacks always hit the network.
  if (url.pathname.startsWith('/auth/')) return true;
  return false;
}

function isNextStaticAsset(url) {
  // /_next/static/ files are content-hashed and immutable; safe to cache forever.
  return url.pathname.startsWith('/_next/static/');
}

function isStaticPublicAsset(url) {
  return (
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.json' ||
    url.pathname === '/offline.html'
  );
}

// ─── Fetch ──────────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const { request } = event;

  if (shouldBypass(url, request)) return;

  // Navigation: network-first so pages are always fresh; fall back to offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(OFFLINE_URL).then(
          (r) =>
            r ??
            new Response('You are offline.', {
              status: 503,
              headers: { 'Content-Type': 'text/plain' },
            })
        )
      )
    );
    return;
  }

  // Next.js static chunks: cache-first (immutable, content-hashed).
  if (isNextStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Public static assets (icons, manifest): stale-while-revalidate.
  if (isStaticPublicAsset(url)) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(request).then((cached) => {
          const networkFetch = fetch(request).then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          });
          // Return cached immediately if we have it; refresh in background.
          return cached ?? networkFetch;
        })
      )
    );
    return;
  }

  // Everything else: network-only. This covers page RSC payloads, HMR, etc.
});
