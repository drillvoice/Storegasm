<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Never ship a manual step

**The maintainer will not run manual operational steps, and a change that depends on one is not finished.** Assume nobody reads release notes, opens a SQL console, or remembers a follow-up command.

So: anything a change needs done to a live deployment — database migrations and backfills, data repairs, cache invalidation, seeding — must run automatically as part of `npm run build`, which is what the deploy host runs. Migrations already do, via `scripts/migrate.js`; put new automation alongside it rather than inventing a second mechanism.

Two corollaries:

- **Don't write instructions where you could write code.** Adding a step to SETUP.md is not a substitute for automating it. SETUP.md documents first-time local setup, which is genuinely manual; it is not a place to park deploy-time work.
- **When something truly can't be automated, fail loudly.** Break the build, or surface an error in the UI that names the exact command that fixes it. Silence that depends on someone noticing is the failure mode to design out.

This rule exists because v2.0.0 shipped the environments feature with its migration as a manual step in SETUP.md. Nobody ran it, so the feature was dead on arrival in production — the header stuck on "No environment" and every attempt to create one failed against a table that did not exist. The code was correct the whole time.

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
