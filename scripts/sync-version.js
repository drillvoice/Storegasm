#!/usr/bin/env node
// Runs as the `version` npm lifecycle hook (after package.json is bumped,
// before the git commit). Keeps sw.js CACHE_VERSION in sync so every deploy
// gets a fresh service worker cache automatically.
'use strict';

const fs = require('fs');
const path = require('path');

const CACHE_VERSION_RE = /const CACHE_VERSION = '[^']*'/;
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
const swPath = path.join(__dirname, '../public/sw.js');
const sw = fs.readFileSync(swPath, 'utf8');

if (!CACHE_VERSION_RE.test(sw)) {
  console.error('[sync-version] Could not find CACHE_VERSION line in sw.js');
  process.exit(1);
}

const target = `const CACHE_VERSION = 'v${pkg.version}'`;
const updated = sw.replace(CACHE_VERSION_RE, target);

if (updated === sw) {
  console.log(`[sync-version] sw.js already at v${pkg.version} — no change needed`);
} else {
  fs.writeFileSync(swPath, updated);
  console.log(`[sync-version] sw.js CACHE_VERSION → v${pkg.version}`);
}
