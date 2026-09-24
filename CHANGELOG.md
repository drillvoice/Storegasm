# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

---

## [2.2.0] - 2026-09-24

### Changed
- **The database enforces the environment rules.** A space or item can only be in an environment its owner owns, a space's parent must be in the same environment, and an item must be in its space's environment. These used to be checked by the app before every write, and are now foreign keys, so no write can break them. Most requests make one fewer database round trip as a result, and moving a space to another environment is a single update that the database carries through to everything inside it.
- The migration (applied automatically on deploy) first repairs any rows that already break these rules, so it applies cleanly to existing data. On a healthy database it changes nothing.

### Fixed
- An environment's "last updated" time now changes when it is renamed or archived. It previously stayed at the time the environment was created.
- Opening a brand-new account in two tabs at once can no longer create two "My Home" environments.

## [2.1.3] - 2026-09-24

### Changed
- **Pages load faster.** Every request used to check the session with a database query before doing its real work. That check now reads a signed session cookie and goes to the database at most every five minutes. The browser also no longer asks the server who you are before loading anything: the page is served already knowing. One side effect is that a session signed out from another device, for example by a password reset, can keep working for up to five minutes.

## [2.1.2] - 2026-09-24

### Fixed
- **Server actions validate what they're sent.** Every action now checks its arguments before touching the database. Previously an edit request could carry fields the app never sends — such as the owner or the environment of a row — and they were written as-is. Anything unexpected is now refused with a message saying what was wrong.
- **A space can no longer be moved inside itself.** Editing a space's parent now refuses the space itself or anything nested in it. The form already hid those choices, but two tabs working from out-of-date trees could together create a loop, after which those spaces vanished from the dashboard and any search matching an item inside them hung. Any loop that already exists is broken on display: its spaces appear at the top level, and search shows their breadcrumbs.

### Changed
- **Vercel preview builds no longer apply migrations.** A preview shares the production `DATABASE_URL` by default, so migrating there would apply an unmerged branch's schema to production. Set `MIGRATE_PREVIEWS=true` for the Preview environment if your previews have their own database (as with Neon's Vercel integration). Production builds migrate as before.

## [2.1.1] - 2026-09-23

### Fixed
- **Long location dropdowns can be scrolled.** The dropdown's height cap used Tailwind v3 syntax that Tailwind v4 silently ignores, so a long list of spaces ran off the bottom of the screen with no way to reach the rest. It is now capped to the space available (at most 20rem) and scrolls. This applies to every dropdown in the app.

### Changed
- **Nested spaces are indented under their parents** in the Location, Move to and Parent space dropdowns. The indentation was previously done with leading spaces, which the browser collapsed, so every space looked top-level.

## [2.1.0] - 2026-09-12

### Added
- **Migrations run on build.** `npm run build` now applies any pending database migrations before building, so a deploy can no longer put new code in front of a database that is a version behind it. `npm run db:migrate` runs the same step on its own. With no `DATABASE_URL` set the step is skipped, not failed, so a build without a database still works.

### Fixed
- **Environments could not be created on a database that hadn't been migrated.** v2.0.0 shipped the environments tables as a manual migration step, so a deployment that missed it had a header stuck on "No environment" and a New environment form that failed on every attempt. The migration now runs as part of the build (above), and the failure is legible if it ever happens again (below).
- Database errors no longer reach the screen as a wall of SQL. Drizzle reports a failed statement as "Failed query: insert into …" with the actual reason tucked away underneath; the data layer now unwraps it, so what you see is what the database said. A missing table or column — the signature of an unapplied migration — is reported as exactly that, with the command that fixes it.
- A failure to load the environment list is now shown. The switcher reads "Environment unavailable" and the dashboard explains why, instead of silently showing "No environment" over an empty page while every scoped query waited for an environment that was never coming.

---

## [2.0.0] - 2026-09-01

### Added
- **Environments.** Your spaces now live in a named place — a house, an office, a studio — and you can have more than one. A switcher in the header decides which one you're looking at; the dashboard, search, the unassigned bucket and every space picker follow it. Existing accounts get a single environment called "My Home" holding everything they already had.
- **Move a space to another environment.** "Move to…" on any space takes it, everything nested inside it, and all its items to another environment in one operation — the "this box of books comes with me to the new house" move. Moving an item into a space in another environment moves the item there too.
- **Archive an environment.** The house you moved out of drops off the switcher but keeps its contents, so "where did that live before?" stays answerable. Archived environments can be restored, and deleting one tells you how many spaces and items it would destroy first.
- **Search across every environment.** Search is scoped to the environment you're in, with an "All environments" toggle that spans the lot and labels each result with the place it's in — how you check whether something is still at the old address.

### Changed
- **Breaking (data).** `spaces` and `items` each gain a required `environment_id`. The `0002_environments` migration creates the table and backfills every existing row, so no data is lost, but the schema and the server action signatures both change — an older build will not run against a migrated database.
- The dashboard heading now names the environment you're in rather than reading "Your spaces".

### Fixed
- Editing, moving or deleting an item from the search page now refreshes the dashboard and space pages. Previously those mutations bypassed the cache invalidation and left stale data on screen until a reload.

---

## [1.1.0] - 2026-08-09

### Added
- **Password reset.** A "Forgot password?" link on the login page now sends a reset link by email, and the link opens a page where you choose a new password. Previously a forgotten password locked you out of your account for good.
- Optional email delivery via Resend, configured with `RESEND_API_KEY` and `EMAIL_FROM`. With no key set, the reset email is written to the server log instead, so a self-hosted instance can still recover an account.

### Changed
- Resetting a password now signs out every other device, since a reset is also the recovery path after a compromised password.
- `/forgot-password` and `/reset-password` are reachable without a session — anyone who needs them is by definition unable to sign in.

---

## [1.0.1] - 2026-07-12

### Added
- Show/hide password toggle on the login and signup forms, so you can check what you typed (especially on mobile keyboards).

---

## [1.0.0] - 2026-07-11

### Changed
- **Breaking:** Migrated the entire backend from Supabase to Neon Postgres. Data access moved from browser-side Supabase queries (anon key + RLS) to server actions using Drizzle ORM; per-user isolation is now enforced in server code from the session.
- **Breaking:** Replaced Supabase Auth with Better Auth (email + password, sessions stored in our own database). Existing users must sign up again — password hashes could not be ported. Email verification is disabled.
- Full-text item search reimplemented with `websearch_to_tsquery` against the same tsvector columns; behavior is unchanged.

### Fixed
- Infinite re-render loop on the search page caused by `useItemSearch` returning a new empty array every render (present since 0.10.0).

### Removed
- Supabase dependencies (`@supabase/supabase-js`, `@supabase/ssr`), client factories, the auth callback route, and the `supabase/` migrations directory (superseded by `drizzle/`).
- The Supabase keepalive GitHub Actions workflow — Neon's free tier wakes automatically on query, so no keepalive is needed.

---

## [0.10.0] - 2026-05-29

### Changed
- Migrated all client data fetching to React Query (`@tanstack/react-query`), replacing the hand-rolled localStorage cache and `SpacesContext`. The cache is persisted to localStorage (stale-while-revalidate) and version-busted on deploy, matching the previous instant-load behavior.
- Mutations now invalidate related queries, so a change made in one view (e.g. adding or moving an item) is reflected in other views without a manual refresh. The tag list is now cached instead of refetched on every navigation.

### Removed
- `lib/cache.ts` and `contexts/SpacesContext.tsx`, now superseded by the React Query client and its persister.

---

## [0.9.5] - 2026-05-29

### Fixed
- localStorage cache entries are now stamped with the app version. After an update, entries written by an older version are discarded instead of being deserialized into a possibly-incompatible shape, preventing a stale-cache crash on first paint.

---

## [0.9.4] - 2026-05-29

### Fixed
- Signing out now clears the localStorage cache, so one user's spaces and items are no longer left readable on a shared device.
- Moving an item to a different space (via edit or the move dialog) now removes it from the current space's list immediately, instead of leaving a stale copy until the next refresh.
- Optimistic temp IDs now use `crypto.randomUUID()` instead of a timestamp, removing a collision risk when two records are added in the same millisecond.

### Changed
- Optimistic create/edit/delete now write through to the localStorage cache, so returning to a page after a change shows the latest data instead of a stale snapshot.

### Removed
- Dead sign-out `<form action>` (the route never existed) and unused tree/test helpers.

---

## [0.9.3] - 2026-05-28

### Added
- localStorage stale-while-revalidate cache for spaces, items, and tags. On return visits the dashboard renders instantly from cache while Supabase revalidates in the background — no loading spinner.

---

## [0.9.2] - 2026-05-26

### Fixed
- New spaces now appear immediately in the treemap without requiring a page refresh. Previously, adding the first child space to a location would leave a permanent grey placeholder because the ResizeObserver was never attached to the container div (it hadn't been rendered yet during the empty state).

---

## [0.9.1] - 2026-05-26

### Changed
- Add/Edit Space dialog now anchors to the top of the viewport (matching the Add Item dialog), so it stays visible when the mobile keyboard opens. Also tightened form spacing, shrunk description to a single-row textarea, and placed Cancel/Submit buttons side-by-side.

---

## [0.9.0] - 2026-05-25

### Added
- PWA install prompt banner: captures `beforeinstallprompt` and shows a dismissible bottom sheet so users can install Storegasm from Chrome without hunting for the address-bar icon. Dismissal is snoozed for 30 days via localStorage.

---

## [0.8.2] - 2026-05-25

### Fixed
- Description textarea in the Add/Edit item dialog now correctly renders as a single row. The Textarea component's `min-h-[80px]` default was overriding `rows={1}`; overridden with `min-h-0`.

---

## [0.8.1] - 2026-05-25

### Changed
- Add item / edit item dialog now opens anchored to the top of the screen instead of centred, keeping it fully visible when the mobile keyboard is open.
- Description field reduced to a single row.
- Cancel and submit buttons are now always displayed side-by-side on the same row.
- Reduced padding and form spacing so all fields fit without scrolling on typical mobile viewports.

---

## [0.8.0] - 2026-05-25

### Added
- Tag autocomplete suggestions in the item add/edit form. As the user types a tag, existing tags that match (substring match) are shown in a dropdown beneath the input. Arrow keys navigate the list; Enter or click selects a suggestion; Escape dismisses it.

---

## [0.7.3] - 2026-05-25

### Changed
- Item list now uses a two-column grid layout across the space detail, dashboard, and search pages.
- Package icon removed from item cards — it was identical for every item and wasted space.
- Card layout restructured: name wraps up to two lines with the ⋮ menu anchored to the top-right corner.

---

## [0.7.2] - 2026-05-25

### Changed
- Item cards are now more compact: reduced padding (`px-3 py-2`), smaller icon, description truncated to a single line, tighter tag margin. Gap between cards reduced from `space-y-2` to `space-y-1`. Applies across the space detail, dashboard, and search pages.

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
