# Storegasm

Know where everything lives. Storegasm tracks what you keep and where you keep it: nested **spaces** (a bedroom, the box under the bed, the tub inside it) holding **items**, grouped into **environments** (a house, an office, a studio). You can search everything as you type, and move a whole box, with everything inside it, to a new place in one step.

It's a Next.js app backed by Postgres. For first-time setup (Neon, auth secrets, Vercel), see **[SETUP.md](./SETUP.md)**.

## Stack

- **Next.js 16** (App Router), **React 19**, Tailwind CSS 4, Radix UI.
- **Neon Postgres** through **Drizzle ORM** over Neon's HTTP driver.
- **Better Auth** for email-and-password sign-in, with the session cached in a signed cookie.
- **TanStack Query** for client caching, persisted to localStorage.

## How it fits together

| Where | What |
|-------|------|
| `lib/db/` | The data layer. Every query takes the session user's id and filters by it. `schema.ts` holds the tables and the foreign keys that keep spaces and items in their owner's environment. |
| `lib/actions/` | Server actions for writes. Each one resolves the user from the session and validates its arguments (`lib/validation.ts`) before calling `lib/db`. |
| `app/api/` | GET routes for reads, which the browser can run in parallel, unlike server actions. `lib/api/client.ts` is the client side of them. |
| `lib/server-data.ts` | First-render data loading. Pages start their queries on the server and stream them to the client's hooks under the keys in `lib/query-keys.ts`. |
| `app/(app)/` | The signed-in pages. The layout checks the session and loads the environments; each page prefetches its data and renders a client view from `components/`. |
| `hooks/` | Client data hooks: queries and optimistic mutations over the server actions. |
| `drizzle/` | SQL migrations. `npm run build` applies them before building (`scripts/migrate.js`). |

## Scripts

```bash
npm run dev          # local dev server
npm test             # unit tests (Vitest)
npm run test:integration  # data layer against a real Postgres (needs TEST_DATABASE_URL)
npm run lint         # ESLint
npm run build        # apply migrations, then build
npm run db:migrate   # apply migrations on their own
```

CI (`.github/workflows/ci.yml`) runs lint, typecheck, unit tests and a build on every pull request. It also migrates an empty Postgres from scratch, checks that the migrations match `schema.ts`, and runs the integration tests against the result.

## Contributing

Every user-visible change gets a version bump and a CHANGELOG entry, and nothing may depend on a manual deploy step. See [AGENTS.md](./AGENTS.md) for both rules.
