# Storegasm — Setup Guide

This guide covers the manual steps you need to complete before the app will run end-to-end. Everything else (code, SQL, config) is already in the repo.

---

## Prerequisites

- Node.js 20+
- A free [Neon](https://neon.tech) account (Postgres hosting)
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

## Step 2 — Create a Neon project

1. Go to [neon.tech](https://neon.tech) and sign in.
2. Click **New project**.
3. Choose a name (e.g. `storegasm`) and select the region closest to your Vercel deployment.
4. On the project dashboard, click **Connect** and copy the **pooled** connection string (the host contains `-pooler`). You'll need it in Step 3.

Neon's free tier suspends compute after inactivity but wakes automatically on the next query (~1 s) — no manual intervention needed.

---

## Step 3 — Set up local environment variables

Copy the example file and fill in your values:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
DATABASE_URL=postgresql://...   # the pooled connection string from Step 2
BETTER_AUTH_SECRET=...          # generate with: openssl rand -base64 32
BETTER_AUTH_URL=http://localhost:3000
```

---

## Step 4 — Apply the database migrations

```bash
npm install
npx drizzle-kit migrate
```

This creates the auth tables (user, session, account, verification), the app tables (spaces, items), and the full-text-search triggers. Migrations live in `drizzle/` and are generated from `lib/db/schema.ts`.

---

## Step 5 — Test locally

```bash
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
   - `DATABASE_URL` → your Neon pooled connection string
   - `BETTER_AUTH_SECRET` → the same secret you generated (or a new one for prod)
   - `BETTER_AUTH_URL` → your production URL (e.g. `https://storegasm.vercel.app`)
6. Click **Deploy**.

---

## Step 7 — Replace placeholder icons

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
| `DATABASE_URL` | Neon Postgres pooled connection string (server-only, keep secret) |
| `BETTER_AUTH_SECRET` | Secret used to sign Better Auth sessions (server-only, keep secret) |
| `BETTER_AUTH_URL` | The app's public origin, used for auth callbacks |

---

## Troubleshooting

**Redirected to /login in a loop after signing in**
→ Check that `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` are set and that the browser is accepting cookies. The proxy only checks for the session cookie's presence; the (app) layout validates it for real.

**"No database connection string was provided to `neon()`"**
→ `DATABASE_URL` is missing from `.env.local` (or from Vercel env vars in production).

**Database errors on item/space creation**
→ Make sure `npx drizzle-kit migrate` ran successfully — it must apply both the base DDL migration and the triggers migration.

**Search returns nothing for new items**
→ The `items_search_vector_trigger` didn't get applied. Re-run `npx drizzle-kit migrate` and check the `drizzle/0001_triggers.sql` migration was executed.
