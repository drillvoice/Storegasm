<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Versioning workflow

**Every meaningful code change must include a version bump and a CHANGELOG entry.**

## Semver rules

| Change type | Bump | Example |
|-------------|------|---------|
| Bug fix, small UI tweak, non-breaking improvement | `patch` | 0.5.0 → 0.5.1 |
| New feature, meaningful UX addition, backward-compatible capability | `minor` | 0.5.1 → 0.6.0 |
| Breaking change, architecture change, incompatible data/API change | `major` | 0.6.0 → 1.0.0 |

Do **not** bump versions arbitrarily. Chores (deps, CI config, test fixes with no user-visible effect) may skip a version bump.

## Single source of truth

`package.json` → `version` field. Everything else derives from it:

- `NEXT_PUBLIC_APP_VERSION` is injected at build time by `next.config.ts`
- `sw.js` `CACHE_VERSION` is updated automatically when you run `npm version`
- The footer in `app/(app)/layout.tsx` reads the env var at runtime

## Release workflow

```bash
# 1. Make your changes and stage them
# 2. Update CHANGELOG.md — add an entry under [Unreleased] or a new version block
# 3. Run the version bump (this commits package.json + sw.js + CHANGELOG.md together)
npm version patch   # or minor / major
# 4. Push the branch + the new tag
git push && git push --tags
```

The `npm version` command:
1. Bumps `package.json`
2. Runs `scripts/sync-version.js` → updates `sw.js` `CACHE_VERSION`
3. Stages `public/sw.js` and `CHANGELOG.md`
4. Creates a single git commit (`v0.x.y`) and a matching git tag

## CHANGELOG format

Follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Sections per release: **Added**, **Changed**, **Fixed**, **Removed**. Move items from `[Unreleased]` into the new version block when releasing.

## Version display

The version shown in the app footer (`v0.x.y`) comes from `NEXT_PUBLIC_APP_VERSION`, which is baked in at build time from `package.json`. If the footer shows an old version, the old build is still being served — not a code bug.
