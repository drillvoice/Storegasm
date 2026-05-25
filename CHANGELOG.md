# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

---

## [0.7.1] - 2026-05-25

### Changed
- Empty-spaces prompt in SpaceTreemap replaced with a compact single-row inline hint instead of the tall centered block with a large icon. Includes an × to dismiss it entirely — once dismissed the section collapses so items take up the full view.

---

## [0.7.0] - 2026-05-25

### Added
- Item edit, delete, and move actions are now accessible on mobile via a three-dot menu (⋮) on every item card, replacing the desktop-only hover buttons.
- New "Move to…" action on items opens a dedicated dialog with a space picker — move an item to any space or leave it unassigned without touching other fields.

### Changed
- `ItemCard` action buttons removed from hover-only state; all actions are now reachable on touch devices.

---

## [0.6.2] - 2026-05-25

### Fixed
- Treemap now shows a pulsing skeleton on initial render instead of a blank rectangle while it measures its container width.

### Changed
- Supabase client is now created once per component mount (`useMemo`) instead of on every render, making `useEffect` dependency arrays honest and eliminating a latent infinite-loop risk in Strict Mode.
- `flattenSpaces` extracted from `ItemForm` and `SpaceForm` into `lib/utils` — single source of truth.
- `fetchSpaceBreadcrumb` removed from `lib/db/spaces` — it was never called by the app and fetched all spaces on every invocation.
- Delete confirmations across all pages replaced with a styled `ConfirmDialog` (using existing Dialog primitives) instead of `window.confirm()`.

---

## [0.6.1] - 2026-05-25

### Fixed
- Reparenting a space now moves it to the correct position in the tree immediately — previously the node stayed in its old subtree until a hard reload.
- Edit and delete on search result items are now functional; an item form is shown for editing and the result list updates immediately on mutation.
- Search result `space_path` now shows the full ancestor breadcrumb (e.g. "Bedroom › Under bed › Tub 1") instead of just the immediate parent name.
- `SpaceForm` parent selector no longer offers the space's own descendants as valid parents, preventing circular tree cycles.

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
