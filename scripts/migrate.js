#!/usr/bin/env node
// Applies any pending Drizzle migrations, then gets out of the way.
//
// Runs as part of `npm run build`, which is what the deploy host runs. Before
// this, migrations were a manual step in SETUP.md: v2.0.0 shipped the
// environments tables to production without them, so every environment query
// hit a table that did not exist and the feature looked broken in a fully
// deployed app. Tying migrations to the build means a deploy can no longer
// leave the database a version behind the code.
//
// Skipped (not failed) when DATABASE_URL is absent, so `npm run build` still
// works locally and in CI without a database. Any other failure is fatal —
// shipping a build against a database that rejected its own migrations is the
// exact situation this script exists to prevent.
'use strict';

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// next build loads .env/.env.local itself; this script runs before it, so it
// has to look for the local file the same way drizzle.config.ts does.
const localEnv = path.join(__dirname, '../.env.local');
if (!process.env.DATABASE_URL && fs.existsSync(localEnv)) {
  for (const line of fs.readFileSync(localEnv, 'utf8').split('\n')) {
    const match = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    const value = match[2].trim().replace(/^["'](.*)["']$/, '$1');
    if (!(match[1] in process.env)) process.env[match[1]] = value;
  }
}

if (!process.env.DATABASE_URL) {
  console.log('[migrate] DATABASE_URL not set — skipping migrations.');
  process.exit(0);
}

console.log('[migrate] Applying pending migrations…');

const result = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['drizzle-kit', 'migrate'],
  { stdio: 'inherit', cwd: path.join(__dirname, '..') }
);

if (result.error) {
  console.error('[migrate] Could not run drizzle-kit:', result.error.message);
  process.exit(1);
}

if (result.status !== 0) {
  console.error(
    '[migrate] Migrations failed. The database is not in the shape this ' +
      'build expects — fix the migration before deploying.'
  );
  process.exit(result.status ?? 1);
}

console.log('[migrate] Database is up to date.');
