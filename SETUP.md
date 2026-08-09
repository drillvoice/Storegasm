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
RESEND_API_KEY=...              # optional locally — see Step 6
```

Leave `RESEND_API_KEY` out for local development if you like: without it, password reset emails are printed to the terminal running `npm run dev` instead of being sent, and the reset link works fine copied from there.

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

## Step 6 — Set up email (required for password reset)

The app sends exactly one email: the password reset link. Without a provider key, **"Forgot password?" appears to work but no email is sent** — the message is written to the server log instead. That's a deliberate fallback so a self-hosted instance stays recoverable, not a substitute for configuring this.

1. Sign up at [resend.com](https://resend.com). The free tier (3,000 emails/month, 100/day) is far more than password resets need.
2. **Sign up with the same email address you use to log into Storegasm.** This matters — see the note below.
3. Go to **API Keys → Create API Key**. Give it **Sending access** only; it doesn't need full access.
4. Copy the key (it starts with `re_` and is shown once) and set it as `RESEND_API_KEY`.

### Why the signup address matters

The default sender is `Storegasm <onboarding@resend.dev>`, Resend's shared domain. It requires no DNS setup, but it **only delivers to the email address that owns the Resend account**. For a single-user app where both addresses are yours, that's all you need.

If the addresses differ — or you ever add a second user — verify your own domain in Resend (it supplies the DNS records) and set `EMAIL_FROM`:

```env
EMAIL_FROM=Storegasm <no-reply@yourdomain.com>
```

---

## Step 7 — Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in.
2. Click **Add New → Project**.
3. Import your GitHub repository.
4. Vercel auto-detects Next.js — keep all defaults.
5. Before clicking **Deploy**, go to **Environment Variables** and add:
   - `DATABASE_URL` → your Neon pooled connection string
   - `BETTER_AUTH_SECRET` → the same secret you generated (or a new one for prod)
   - `BETTER_AUTH_URL` → your production URL (e.g. `https://storegasm.vercel.app`)
   - `RESEND_API_KEY` → the key from Step 6
   - `EMAIL_FROM` → only if you verified your own domain in Step 6
6. Click **Deploy**.

> **Changing an environment variable later requires a redeploy.** Vercel supplies env vars at build time, so a running deployment won't pick up a new value until you trigger a new deploy.

---

## Step 8 — Replace placeholder icons

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
| `RESEND_API_KEY` | Resend key for the password reset email (server-only, keep secret). The app boots without it, but reset emails are only logged, never sent |
| `EMAIL_FROM` | Sender address for that email. Defaults to `Storegasm <onboarding@resend.dev>`, which only delivers to the Resend account owner — set this once you've verified your own domain |

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

**The password reset email never arrives**
→ Check the server logs (Vercel → your deployment → **Logs**); the failure names itself:
- `[email] RESEND_API_KEY is not set` — the variable is missing, or you set it but haven't redeployed since. The full email, reset link included, is in that same log entry, so you can still get back in.
- `Resend rejected the message (HTTP 403)` — you're on the default `onboarding@resend.dev` sender and the recipient isn't the Resend account owner. Verify a domain and set `EMAIL_FROM`, or re-register Resend under your Storegasm login address (Step 6).
- No email log at all — the address you typed has no account. The form deliberately says the same thing either way, so it can't be used to discover who's registered.

**A reset link says it's invalid or expired**
→ Links last one hour and work once. Request a fresh one. Note that resetting also signs you out everywhere, so other devices will ask you to sign in again.
