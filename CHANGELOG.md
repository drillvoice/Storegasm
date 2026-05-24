# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

---

## [0.6.0] - 2026-05-24

### Added
- Treemap display on space detail pages — sub-spaces inside any space now render as an interactive treemap, matching the top-level dashboard view. Tiles are clickable, support add/edit/delete via the context menu, and can be nested further.

---

## [0.5.0] - 2026-05-24

### Added
- App versioning and changelog system (this file)
- Version badge in app footer — always visible in the installed PWA
- `scripts/sync-version.js` — automatically keeps `sw.js` `CACHE_VERSION` in sync
  with `package.json` whenever `npm version` is run
- `NEXT_PUBLIC_APP_VERSION` env var embedded at build time via `next.config.ts`
- Contributor versioning workflow documented in `AGENTS.md`

---

## [0.4.0] - 2026-05-24

### Added
- Production-ready PWA: custom service worker (`sw.js`) with network-first
  navigation, immutable cache for `/_next/static/` assets, and stale-while-
  revalidate for icons/manifest
- Offline fallback page (`/offline.html`)
- Security headers on all responses (X-Content-Type-Options, X-Frame-Options,
  Referrer-Policy)
- `no-cache` header on `sw.js` to prevent stale service worker serving
- `ServiceWorkerRegistration` component that skips registration in development
- Apple Web App meta tags and touch icon for iOS home-screen install

---

## [0.3.0] - 2026-05-24

### Changed
- Replaced per-page data fetching with a shared `SpacesContext` — eliminates
  redundant network requests and navigation lag
- Optimistic mutations for space create/edit/delete — UI responds instantly
  without waiting for Supabase round-trips

---

## [0.2.0] - 2026-05-24

### Added
- Treemap visualisation on the dashboard showing space hierarchy by item count
- Full space management: create, edit, delete (with nested child spaces)
- Full item management: create, edit, delete, assign to spaces, tagging
- Search page for finding items across all spaces
- `ItemCard` and `SpaceTreemap` components

---

## [0.1.0] - 2026-05-24

### Added
- Initial project setup from Create Next App
- Supabase authentication (login, sign-up, OAuth callback, sign-out)
- Next.js App Router with route groups: `(app)` (authenticated) and `(auth)`
- Supabase SSR client utilities and middleware session refresh
- Base UI component library (shadcn/ui + Tailwind CSS v4)
- PWA manifest and app icons
