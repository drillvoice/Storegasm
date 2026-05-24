# Storegasm — Setup Guide

This guide covers the manual steps you need to complete before the app will run end-to-end. Everything else (code, SQL, config) is already in the repo.

---

## Prerequisites

- Node.js 20+
- A free [Supabase](https://supabase.com) account
- A free [Vercel](https://vercel.com) account
- A [GitHub](https://github.com) account (for Vercel deployment)

---

## Step 1 — Clone the repo and push to GitHub

If you haven't already:

```bash
git init
git add .
git commit -m "Initial commit"
# Create a new GitHub repo, then:
git remote add origin https://github.com/YOUR_USERNAME/storegasm.git
git push -u origin main
```

---

## Step 2 — Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and sign in.
2. Click **New project**.
3. Choose a name (e.g. `storegasm`), set a strong database password, and select the region closest to you.
4. Wait for the project to finish provisioning (~1 min).
5. Go to **Project Settings → API**.
6. Copy two values — you'll need them in Step 4:
   - **Project URL** (e.g. `https://abcdefgh.supabase.co`)
   - **anon public** key

---

## Step 3 — Apply the database migrations

You can apply the migrations in two ways:

### Option A: Supabase SQL Editor (easiest, no CLI needed)

1. In your Supabase project, go to **SQL Editor**.
2. Open and run each file in order:
   - `supabase/migrations/001_create_spaces.sql`
   - `supabase/migrations/002_create_items.sql`
   - `supabase/migrations/003_rls_policies.sql`

### Option B: Supabase CLI

```bash
# Install the CLI (macOS)
brew install supabase/tap/supabase

# Link to your project (get the project ref from the Supabase dashboard URL)
supabase link --project-ref YOUR_PROJECT_REF

# Push all migrations
supabase db push
```

---

## Step 4 — Set up local environment variables

Copy the example file and fill in your values:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

---

## Step 5 — Test locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You should be redirected to `/login`. Create an account, and you're in!

Run the test suite:

```bash
npm test
```

---

## Step 6 — Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in.
2. Click **Add New → Project**.
3. Import your GitHub repository.
4. Vercel auto-detects Next.js — keep all defaults.
5. Before clicking **Deploy**, go to **Environment Variables** and add:
   - `NEXT_PUBLIC_SUPABASE_URL` → your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → your Supabase anon key
6. Click **Deploy**.

---

## Step 7 (Optional) — Connect Supabase ↔ Vercel integration

This automatically syncs Supabase env vars to Vercel, so you never manually copy them again.

1. In your Supabase project, go to **Project Settings → Integrations**.
2. Find **Vercel** and click **Connect**.
3. Follow the OAuth flow — select your Vercel team and the storegasm project.
4. Done — future Supabase rotations auto-update Vercel.

---

## Step 8 — Update the auth callback URL in Supabase

Supabase needs to know your production URL for email confirmation links to work correctly.

1. Go to **Authentication → URL Configuration** in Supabase.
2. Set **Site URL** to your Vercel domain (e.g. `https://storegasm.vercel.app`).
3. Add `https://storegasm.vercel.app/auth/callback` to **Redirect URLs**.

---

## Step 9 — Replace placeholder icons

The `/public/icons/` folder contains placeholder SVG files. Replace them with real PNG icons before shipping:

| File | Size |
|------|------|
| `icon-192.png` | 192×192 px |
| `icon-512.png` | 512×512 px |

Use [Maskable.app](https://maskable.app) to ensure the icons look correct as adaptive icons on Android.

---

## Environment variable reference

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase public anon key (safe to expose) |

---

## Troubleshooting

**"Redirect URL not allowed" error on sign-up**
→ Add `http://localhost:3000/api/auth/callback` to Supabase Redirect URLs for local dev.

**Login works but I'm immediately logged out**
→ The middleware session refresh is misconfigured. Make sure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set correctly in `.env.local`.

**Database errors on item/space creation**
→ Check that you ran all three SQL migrations in order. Also confirm RLS is enabled (Migration 003).
